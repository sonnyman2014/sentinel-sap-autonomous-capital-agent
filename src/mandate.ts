import crypto from "node:crypto";
import { Keypair, PublicKey } from "@solana/web3.js";
import { MAX_DELEGATE_DURATION_SECS } from "@oobe-protocol-labs/synapse-sap-sdk/constants";
import bs58 from "bs58";

export type AllowedProtocol =
  | "jupiter"
  | "multihopper"
  | "spl-rent-reclaim"
  | "sap-escrow"
  | "kamino"
  | "orca"
  | "raydium"
  | "meteora"
  | "ace-mcp";

export interface CapitalMandate {
  mandateId: string;
  agentWallet: string;
  treasuryWallet: string;
  maxSingleTxUsd: number;
  maxDailySpendUsd: number;
  minConvictionScore: number;
  maxSlippageBps: number;
  minLiquidityUsd: number;
  allowedProtocols: AllowedProtocol[];
  deniedMints: string[];
  antiCircularTransfer: boolean;
  createdAtIso: string;
}

export interface SubAgentDelegationPolicy {
  delegateWallet: string;
  vaultPda: string;
  maxDelegatedUsd: number;
  allowedProtocols: AllowedProtocol[];
  expiresAtUnix: number;
  issuedAtUnix: number;
}

export interface ExecutionIntent {
  intentId: string;
  protocol: AllowedProtocol;
  actorWallet: string;
  recipientWallet?: string;
  destinationWallets?: string[];
  intermediateHopWallets?: string[];
  tokenMint: string;
  amountUsd: number;
  slippageBps?: number;
  convictionScore?: number;
  poolLiquidityUsd?: number;
  timestampUnix?: number;
}

export interface MandateEvaluation {
  allowed: boolean;
  mandateId: string;
  intentId: string;
  reasons: string[];
  remainingDailyBudgetUsd: number;
  serviceHashHex: string;
  serviceHashBytes: Uint8Array;
  evaluatedAtIso: string;
}

export interface SpendRecord {
  intentId: string;
  amountUsd: number;
  timestampUnix: number;
  serviceHashHex: string;
}

export const DEFAULT_TREASURY_WALLET = "89Sv5FvnMNRid1bn8y2Ti1vJPSxWxgiW9GSLsPpBnKK1";

export function createDefaultMandate(
  agentWallet: string = DEFAULT_TREASURY_WALLET,
  overrides: Partial<CapitalMandate> = {}
): CapitalMandate {
  return {
    mandateId: overrides.mandateId ?? "mandate-sentinel-sap-v1",
    agentWallet,
    treasuryWallet: overrides.treasuryWallet ?? DEFAULT_TREASURY_WALLET,
    maxSingleTxUsd: overrides.maxSingleTxUsd ?? 250,
    maxDailySpendUsd: overrides.maxDailySpendUsd ?? 1000,
    minConvictionScore: overrides.minConvictionScore ?? 80,
    maxSlippageBps: overrides.maxSlippageBps ?? 100,
    minLiquidityUsd: overrides.minLiquidityUsd ?? 25_000,
    allowedProtocols: overrides.allowedProtocols ?? [
      "jupiter",
      "multihopper",
      "spl-rent-reclaim",
      "sap-escrow",
      "kamino",
      "orca",
      "raydium",
      "meteora",
      "ace-mcp",
    ],
    deniedMints: overrides.deniedMints ?? [],
    antiCircularTransfer: overrides.antiCircularTransfer ?? true,
    createdAtIso: overrides.createdAtIso ?? new Date().toISOString(),
  };
}

export class CapitalMandateEngine {
  private readonly mandate: CapitalMandate;
  private readonly spendLedger: SpendRecord[] = [];
  private readonly delegations = new Map<string, SubAgentDelegationPolicy>();

  constructor(mandate: CapitalMandate) {
    new PublicKey(mandate.agentWallet);
    new PublicKey(mandate.treasuryWallet);
    this.mandate = mandate;
  }

  getMandate(): CapitalMandate {
    return { ...this.mandate };
  }

  registerSubAgentDelegate(policy: SubAgentDelegationPolicy): SubAgentDelegationPolicy {
    new PublicKey(policy.delegateWallet);
    new PublicKey(policy.vaultPda);
    if (policy.delegateWallet === this.mandate.agentWallet) {
      throw new Error("Sub-agent delegate wallet must be distinct from root agent wallet");
    }
    const duration = policy.expiresAtUnix - policy.issuedAtUnix;
    if (duration <= 0 || duration > MAX_DELEGATE_DURATION_SECS) {
      throw new Error(
        `Delegation duration (${duration}s) must be within (0, ${MAX_DELEGATE_DURATION_SECS}] seconds`
      );
    }
    if (policy.maxDelegatedUsd <= 0 || policy.maxDelegatedUsd > this.mandate.maxDailySpendUsd) {
      throw new Error("Sub-agent delegated budget must be positive and within root daily spend cap");
    }
    this.delegations.set(policy.delegateWallet, { ...policy });
    return policy;
  }

  getRolling24hSpendUsd(nowUnix: number = Math.floor(Date.now() / 1000)): number {
    const cutoff = nowUnix - 86_400;
    return this.spendLedger
      .filter((r) => r.timestampUnix >= cutoff)
      .reduce((acc, r) => acc + r.amountUsd, 0);
  }

  computeServiceHash(intent: ExecutionIntent): Uint8Array {
    const canonical = JSON.stringify({
      mandateId: this.mandate.mandateId,
      intentId: intent.intentId,
      protocol: intent.protocol,
      actorWallet: intent.actorWallet,
      recipientWallet: intent.recipientWallet ?? null,
      destinationWallets: intent.destinationWallets ?? [],
      tokenMint: intent.tokenMint,
      amountUsd: Number(intent.amountUsd.toFixed(6)),
    });
    return new Uint8Array(crypto.createHash("sha256").update(canonical).digest());
  }

  evaluate(intent: ExecutionIntent, commitSpend: boolean = false): MandateEvaluation {
    const reasons: string[] = [];
    const nowUnix = intent.timestampUnix ?? Math.floor(Date.now() / 1000);

    try {
      new PublicKey(intent.actorWallet);
      new PublicKey(intent.tokenMint);
      if (intent.recipientWallet) new PublicKey(intent.recipientWallet);
      for (const d of intent.destinationWallets ?? []) new PublicKey(d);
      for (const h of intent.intermediateHopWallets ?? []) new PublicKey(h);
    } catch {
      reasons.push("INVALID_SOLANA_PUBLIC_KEY");
    }

    if (!this.mandate.allowedProtocols.includes(intent.protocol)) {
      reasons.push(`PROTOCOL_NOT_ALLOWED:${intent.protocol}`);
    }

    if (this.mandate.deniedMints.includes(intent.tokenMint)) {
      reasons.push(`TOKEN_MINT_DENIED:${intent.tokenMint}`);
    }

    // Check actor authority (root agent or active sub-agent delegate)
    if (intent.actorWallet !== this.mandate.agentWallet) {
      const del = this.delegations.get(intent.actorWallet);
      if (!del) {
        reasons.push(`UNAUTHORIZED_ACTOR:${intent.actorWallet}`);
      } else {
        if (nowUnix > del.expiresAtUnix) {
          reasons.push("SUB_AGENT_DELEGATION_EXPIRED");
        }
        if (!del.allowedProtocols.includes(intent.protocol)) {
          reasons.push(`SUB_AGENT_PROTOCOL_FORBIDDEN:${intent.protocol}`);
        }
        if (intent.amountUsd > del.maxDelegatedUsd) {
          reasons.push(
            `SUB_AGENT_CAP_EXCEEDED:${intent.amountUsd.toFixed(2)}>${del.maxDelegatedUsd.toFixed(2)}`
          );
        }
      }
    }

    if (intent.amountUsd < 0) {
      reasons.push("NEGATIVE_AMOUNT_USD");
    }

    if (intent.amountUsd > this.mandate.maxSingleTxUsd) {
      reasons.push(
        `SINGLE_TX_LIMIT_EXCEEDED:${intent.amountUsd.toFixed(2)}>${this.mandate.maxSingleTxUsd.toFixed(2)}`
      );
    }

    const spent24h = this.getRolling24hSpendUsd(nowUnix);
    if (spent24h + intent.amountUsd > this.mandate.maxDailySpendUsd) {
      reasons.push(
        `DAILY_SPEND_CAP_EXCEEDED:${(spent24h + intent.amountUsd).toFixed(2)}>${this.mandate.maxDailySpendUsd.toFixed(2)}`
      );
    }

    if (
      intent.slippageBps !== undefined &&
      intent.slippageBps > this.mandate.maxSlippageBps
    ) {
      reasons.push(`SLIPPAGE_TOO_HIGH:${intent.slippageBps}>${this.mandate.maxSlippageBps}bps`);
    }

    // Enforce conviction & liquidity guardrails for swaps/trades
    if (intent.protocol !== "spl-rent-reclaim") {
      if (
        intent.convictionScore !== undefined &&
        intent.convictionScore < this.mandate.minConvictionScore
      ) {
        reasons.push(
          `CONVICTION_BELOW_FLOOR:${intent.convictionScore}<${this.mandate.minConvictionScore}`
        );
      }
      if (
        intent.poolLiquidityUsd !== undefined &&
        intent.poolLiquidityUsd < this.mandate.minLiquidityUsd
      ) {
        reasons.push(
          `LIQUIDITY_BELOW_FLOOR:${intent.poolLiquidityUsd}<${this.mandate.minLiquidityUsd}`
        );
      }
    }

    // Anti-circular / anti-wash-trading enforcement (OOBE & MultiHopper competition rule)
    if (this.mandate.antiCircularTransfer && intent.protocol !== "spl-rent-reclaim") {
      const forbiddenSelfSet = new Set([this.mandate.agentWallet, intent.actorWallet]);
      if (intent.recipientWallet && forbiddenSelfSet.has(intent.recipientWallet)) {
        reasons.push("ANTI_CIRCULAR_SELF_TRANSFER_BLOCKED");
      }
      for (const dest of intent.destinationWallets ?? []) {
        if (forbiddenSelfSet.has(dest)) {
          reasons.push(`ANTI_CIRCULAR_DESTINATION_BLOCKED:${dest}`);
        }
      }
      const hopSet = new Set<string>();
      for (const hop of intent.intermediateHopWallets ?? []) {
        if (forbiddenSelfSet.has(hop) || hop === intent.recipientWallet) {
          reasons.push(`ANTI_CIRCULAR_HOP_COLLISION:${hop}`);
        }
        if (hopSet.has(hop)) {
          reasons.push(`DUPLICATE_INTERMEDIATE_HOP:${hop}`);
        }
        hopSet.add(hop);
      }
    }

    const serviceHashBytes = this.computeServiceHash(intent);
    const serviceHashHex = Buffer.from(serviceHashBytes).toString("hex");

    if (this.spendLedger.some((r) => r.serviceHashHex === serviceHashHex)) {
      reasons.push("REPLAY_SERVICE_HASH_DETECTED");
    }

    const allowed = reasons.length === 0;
    let postSpend24h = spent24h;
    if (allowed && commitSpend && intent.amountUsd > 0) {
      this.spendLedger.push({
        intentId: intent.intentId,
        amountUsd: intent.amountUsd,
        timestampUnix: nowUnix,
        serviceHashHex,
      });
      postSpend24h += intent.amountUsd;
    }

    return {
      allowed,
      mandateId: this.mandate.mandateId,
      intentId: intent.intentId,
      reasons,
      remainingDailyBudgetUsd: Math.max(0, Number((this.mandate.maxDailySpendUsd - postSpend24h).toFixed(6))),
      serviceHashHex,
      serviceHashBytes,
      evaluatedAtIso: new Date(nowUnix * 1000).toISOString(),
    };
  }

  signMandateAttestation(evaluation: MandateEvaluation, signer: Keypair): {
    signerPubkey: string;
    signatureBase58: string;
    payloadSha256: string;
  } {
    const message = Buffer.from(
      `SENTINEL_SAP_MANDATE_V1:${evaluation.mandateId}:${evaluation.intentId}:${evaluation.allowed}:${evaluation.serviceHashHex}`,
      "utf8"
    );
    const payloadSha256 = crypto.createHash("sha256").update(message).digest("hex");
    // Sign deterministically using Node's Ed25519 private key derived from Solana 64-byte secretKey seed
    const seed32 = signer.secretKey.slice(0, 32);
    const pkcs8Prefix = Buffer.from("302e020100300506032b657004220420", "hex");
    const privateKeyObj = crypto.createPrivateKey({
      key: Buffer.concat([pkcs8Prefix, Buffer.from(seed32)]),
      format: "der",
      type: "pkcs8",
    });
    const sig = crypto.sign(null, message, privateKeyObj);
    return {
      signerPubkey: signer.publicKey.toBase58(),
      signatureBase58: bs58.encode(sig),
      payloadSha256,
    };
  }

  static verifyMandateAttestation(
    evaluation: MandateEvaluation,
    signerPubkey: string,
    signatureBase58: string
  ): boolean {
    const message = Buffer.from(
      `SENTINEL_SAP_MANDATE_V1:${evaluation.mandateId}:${evaluation.intentId}:${evaluation.allowed}:${evaluation.serviceHashHex}`,
      "utf8"
    );
    const pubBytes = new PublicKey(signerPubkey).toBytes();
    const spkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
    const publicKeyObj = crypto.createPublicKey({
      key: Buffer.concat([spkiPrefix, Buffer.from(pubBytes)]),
      format: "der",
      type: "spki",
    });
    const sigBytes = Buffer.from(bs58.decode(signatureBase58));
    return crypto.verify(null, message, publicKeyObj, sigBytes);
  }
}
