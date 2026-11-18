import crypto from "node:crypto";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, VersionedTransaction } from "@solana/web3.js";

export const MULTIHOPPER_MAINNET_BASE = "https://multihopper.com/api/v1";
export const MULTIHOPPER_DEVNET_BASE = "https://devnet.multihopper.com/api/v1";
export const MULTIHOPPER_SERVER_CARD_URL =
  "https://www.multihopper.com/.well-known/mcp/server-card.json";

export const HOP_BUNDLE_CATEGORIES = [
  "cex",
  "dex",
  "exchanges",
  "kol",
  "contracts",
  "mix",
] as const;

export type HopBundleCategory = (typeof HOP_BUNDLE_CATEGORIES)[number];

export type CustomHopSpec =
  | { wallet: string; waitSeconds: number }
  | { bundle: HopBundleCategory; waitSeconds: number };

export interface CustomRouteSpec {
  hops: CustomHopSpec[];
}

export interface MultiDestinationShare {
  wallet: string;
  amountRaw: string;
}

export interface TransferCreateRequest {
  tokenMint: string;
  amountRaw: string;
  amountTokens: string;
  sourceOwner: string;
  tokenDecimals?: number;
  externalId?: string;
  recipientWallet?: string;
  destinations?: MultiDestinationShare[];
  hops?: number;
  arrivalSeconds?: number;
  route?: CustomRouteSpec;
}

export interface RouteValidationResult {
  valid: boolean;
  errors: string[];
  hopCount: number;
  destinationCount: number;
  totalWaitSeconds: number;
}

export interface RouteEconomicsSummary {
  principalUsd: number;
  qualifyingCompetitionVolumeUsd: number;
  fullRateFeeBps: number;
  totalProtocolFeeUsd: number;
  partnerRevenueShareBps: number;
  partnerRevenueShareUsd: number;
  competitionPoolContributionUsd: number;
  hopCount: number;
  destinationCount: number;
  estimatedHopAtaRentLamports: number;
  estimatedHopAtaRentSol: number;
}

export interface PreparedTxBundle {
  routeInitTxs: string[];
  dispersionInitTxs: string[];
  recentBlockhash: string;
  lastValidBlockHeight: number;
  resume?: {
    routeAlreadyDeployed?: boolean;
    existingHopCount?: number;
    totalHops?: number;
    orchestratorAlreadyInitialized?: boolean;
    completedStepIndices?: number[];
    totalSteps?: number;
    keeperAlreadyFunded?: boolean;
    nothingToDo?: boolean;
  };
}

export interface SignedTxBundleResult {
  signedOrderedTxsBase64: string[];
  routeInitSignedCount: number;
  dispersionInitSignedCount: number;
  nothingToDo: boolean;
  signerPubkey: string;
}

export interface MultiHopperServerCard {
  schema_version: string;
  name: string;
  version: string;
  transport: { type: string; url: string };
  tools: Array<{ name: string; description: string }>;
}

const HOP_ATA_RENT_LAMPORTS = 1_900_000; // ~0.0019 SOL per TRM-screened hop per OpenAPI spec
const MAX_WAIT_SECONDS = 2_592_000; // 30 days
const MIN_WAIT_SECONDS = 20;

export function validateMultiHopperRequest(req: TransferCreateRequest): RouteValidationResult {
  const errors: string[] = [];

  try {
    new PublicKey(req.tokenMint);
    new PublicKey(req.sourceOwner);
  } catch {
    errors.push("MH_INVALID_MINT_OR_SOURCE_OWNER_PUBKEY");
  }

  let totalRaw = 0n;
  try {
    totalRaw = BigInt(req.amountRaw);
    if (totalRaw <= 0n) errors.push("MH_AMOUNT_RAW_MUST_BE_POSITIVE");
  } catch {
    errors.push("MH_AMOUNT_RAW_INVALID_BIGINT");
  }

  const hasSingle = Boolean(req.recipientWallet);
  const hasMulti = Array.isArray(req.destinations) && req.destinations.length > 0;
  if (hasSingle === hasMulti) {
    errors.push("MH_PROVIDE_EXACTLY_ONE_OF_RECIPIENT_OR_DESTINATIONS");
  }

  const destinationWallets = new Set<string>();
  if (hasSingle && req.recipientWallet) {
    try {
      new PublicKey(req.recipientWallet);
    } catch {
      errors.push("MH_INVALID_RECIPIENT_PUBKEY");
    }
    if (req.recipientWallet === req.sourceOwner) {
      errors.push("MH_SELF_TRANSFER_EXCLUDED");
    }
    destinationWallets.add(req.recipientWallet);
  }

  if (hasMulti && req.destinations) {
    if (req.destinations.length < 1 || req.destinations.length > 20) {
      errors.push("MH_DESTINATIONS_COUNT_OUT_OF_RANGE_1_TO_20");
    }
    let shareSum = 0n;
    for (const d of req.destinations) {
      try {
        new PublicKey(d.wallet);
      } catch {
        errors.push(`MH_INVALID_DESTINATION_PUBKEY:${d.wallet}`);
      }
      if (d.wallet === req.sourceOwner) {
        errors.push(`MH_SELF_DESTINATION_EXCLUDED:${d.wallet}`);
      }
      if (destinationWallets.has(d.wallet)) {
        errors.push(`MH_DUPLICATE_DESTINATION_WALLET:${d.wallet}`);
      }
      destinationWallets.add(d.wallet);
      try {
        const s = BigInt(d.amountRaw);
        if (s <= 0n) errors.push(`MH_NON_POSITIVE_DESTINATION_SHARE:${d.wallet}`);
        shareSum += s;
      } catch {
        errors.push(`MH_INVALID_DESTINATION_SHARE:${d.wallet}`);
      }
    }
    if (totalRaw > 0n && shareSum !== totalRaw) {
      errors.push(
        `MH_DESTINATION_SHARES_SUM_MISMATCH:${shareSum.toString()}!=${totalRaw.toString()}`
      );
    }
  }

  let hopCount = req.hops ?? 3;
  let totalWaitSeconds = 0;

  if (req.route) {
    hopCount = req.route.hops.length;
    const minHops = hasMulti ? 3 : 2;
    const maxHops = hasMulti ? 10 : 9;
    if (hopCount < minHops || hopCount > maxHops) {
      errors.push(
        `MH_018_CUSTOM_HOP_COUNT_OUT_OF_RANGE:${hopCount}_EXPECTED_${minHops}_TO_${maxHops}`
      );
    }

    const seenHopWallets = new Set<string>();
    for (let i = 0; i < req.route.hops.length; i++) {
      const h = req.route.hops[i];
      if (h.waitSeconds < MIN_WAIT_SECONDS || h.waitSeconds > MAX_WAIT_SECONDS) {
        errors.push(`MH_018_HOP_WAIT_OUT_OF_BOUNDS:index_${i}:${h.waitSeconds}`);
      }
      totalWaitSeconds += h.waitSeconds;

      if ("wallet" in h) {
        try {
          new PublicKey(h.wallet);
        } catch {
          errors.push(`MH_018_INVALID_HOP_WALLET:index_${i}`);
        }
        if (h.wallet === req.sourceOwner || destinationWallets.has(h.wallet)) {
          errors.push(`MH_018_HOP_COLLIDES_WITH_ENDPOINT:${h.wallet}`);
        }
        if (seenHopWallets.has(h.wallet)) {
          errors.push(`MH_018_DUPLICATE_HOP_WALLET:${h.wallet}`);
        }
        seenHopWallets.add(h.wallet);
      } else if ("bundle" in h) {
        if (!HOP_BUNDLE_CATEGORIES.includes(h.bundle)) {
          errors.push(`MH_018_INVALID_HOP_BUNDLE:${String(h.bundle)}`);
        }
        if (hasMulti && i === req.route.hops.length - 1) {
          errors.push("MH_018_MULTI_DESTINATION_LAST_HOP_MUST_BE_EXPLICIT_WALLET");
        }
      }
    }

    if (totalWaitSeconds > MAX_WAIT_SECONDS) {
      errors.push(`MH_018_CUMULATIVE_WAIT_EXCEEDS_30_DAYS:${totalWaitSeconds}`);
    }
  } else if (req.hops !== undefined && (req.hops < 3 || req.hops > 10)) {
    errors.push(`MH_STANDARD_HOPS_OUT_OF_RANGE_3_TO_10:${req.hops}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    hopCount,
    destinationCount: destinationWallets.size,
    totalWaitSeconds,
  };
}

export function calculateRouteEconomics(params: {
  principalUsd: number;
  hopCount: number;
  destinationCount?: number;
}): RouteEconomicsSummary {
  const destCount = params.destinationCount ?? 1;
  const fullRateFeeBps = 50; // 0.50%
  const partnerRevenueShareBps = 25; // 0.25% ($2,500 per $1,000,000 routed)
  const totalProtocolFeeUsd = Number(((params.principalUsd * fullRateFeeBps) / 10_000).toFixed(6));
  const partnerRevenueShareUsd = Number(
    ((params.principalUsd * partnerRevenueShareBps) / 10_000).toFixed(6)
  );
  const competitionPoolContributionUsd = Number(
    (totalProtocolFeeUsd - partnerRevenueShareUsd).toFixed(6)
  );
  const extraDispersionSteps = destCount > 1 ? destCount : 0;
  const estimatedHopAtaRentLamports =
    (params.hopCount + extraDispersionSteps) * HOP_ATA_RENT_LAMPORTS;

  return {
    principalUsd: params.principalUsd,
    qualifyingCompetitionVolumeUsd: params.principalUsd,
    fullRateFeeBps,
    totalProtocolFeeUsd,
    partnerRevenueShareBps,
    partnerRevenueShareUsd,
    competitionPoolContributionUsd,
    hopCount: params.hopCount,
    destinationCount: destCount,
    estimatedHopAtaRentLamports,
    estimatedHopAtaRentSol: Number((estimatedHopAtaRentLamports / LAMPORTS_PER_SOL).toFixed(6)),
  };
}

export function signPreparedTxBundle(
  bundle: PreparedTxBundle,
  sourceSigner: Keypair
): SignedTxBundleResult {
  if (bundle.resume?.nothingToDo) {
    return {
      signedOrderedTxsBase64: [],
      routeInitSignedCount: 0,
      dispersionInitSignedCount: 0,
      nothingToDo: true,
      signerPubkey: sourceSigner.publicKey.toBase58(),
    };
  }

  const signBase64List = (b64List: string[]): string[] =>
    b64List.map((rawB64) => {
      const txBytes = Buffer.from(rawB64, "base64");
      const vtx = VersionedTransaction.deserialize(txBytes);
      vtx.sign([sourceSigner]);
      const serialized = vtx.serialize();
      if (vtx.signatures.length === 0 || vtx.signatures[0].every((b) => b === 0)) {
        throw new Error(
          "Failed to attach valid Ed25519 signature to prepared MultiHopper transaction"
        );
      }
      return Buffer.from(serialized).toString("base64");
    });

  const signedRoute = signBase64List(bundle.routeInitTxs);
  const signedDispersion = signBase64List(bundle.dispersionInitTxs);

  return {
    signedOrderedTxsBase64: [...signedRoute, ...signedDispersion],
    routeInitSignedCount: signedRoute.length,
    dispersionInitSignedCount: signedDispersion.length,
    nothingToDo: false,
    signerPubkey: sourceSigner.publicKey.toBase58(),
  };
}

export class MultiHopperClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(
    options: {
      apiKey?: string;
      environment?: "mainnet" | "devnet";
      baseUrl?: string;
      fetchImpl?: typeof fetch;
    } = {}
  ) {
    this.apiKey = options.apiKey ?? process.env.MULTIHOPPER_API_KEY;
    const isTestKey = this.apiKey?.startsWith("mh_test_");
    const env = options.environment ?? (isTestKey ? "devnet" : "mainnet");
    this.baseUrl =
      options.baseUrl ?? (env === "devnet" ? MULTIHOPPER_DEVNET_BASE : MULTIHOPPER_MAINNET_BASE);
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async discoverServerCard(
    cardUrl: string = MULTIHOPPER_SERVER_CARD_URL
  ): Promise<MultiHopperServerCard> {
    const res = await this.fetchImpl(cardUrl, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      throw new Error(`MultiHopper MCP server card discovery failed: HTTP ${res.status}`);
    }
    return (await res.json()) as MultiHopperServerCard;
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (this.apiKey) {
      headers["x-api-key"] = this.apiKey;
    }
    return headers;
  }

  async estimateTransfer(params: {
    tokenMint: string;
    amountRaw: string;
    tokenDecimals?: number;
    hops?: number;
    destinationCount?: number;
    arrivalSeconds?: number;
    route?: CustomRouteSpec;
  }): Promise<Record<string, unknown>> {
    const res = await this.fetchImpl(`${this.baseUrl}/transfers/estimate`, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(params),
    });
    const body = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(
        `MultiHopper /transfers/estimate HTTP ${res.status}: ${JSON.stringify(body)}`
      );
    }
    return body;
  }

  async createTransfer(req: TransferCreateRequest): Promise<Record<string, unknown>> {
    const check = validateMultiHopperRequest(req);
    if (!check.valid) {
      throw new Error(`Invalid MultiHopper transfer request: ${check.errors.join("; ")}`);
    }
    const payload = {
      ...req,
      externalId:
        req.externalId ??
        `sentinel-sap-${crypto
          .createHash("sha256")
          .update(JSON.stringify(req))
          .digest("hex")
          .slice(0, 16)}`,
    };
    const res = await this.fetchImpl(`${this.baseUrl}/transfers`, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(payload),
    });
    const body = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(`MultiHopper /transfers HTTP ${res.status}: ${JSON.stringify(body)}`);
    }
    return body;
  }

  async prepareTransfer(transferId: number | string): Promise<PreparedTxBundle> {
    const res = await this.fetchImpl(`${this.baseUrl}/transfers/${transferId}/prepare`, {
      method: "POST",
      headers: this.buildHeaders(),
    });
    const body = (await res.json()) as PreparedTxBundle & { error?: unknown };
    if (!res.ok) {
      throw new Error(`MultiHopper /prepare HTTP ${res.status}: ${JSON.stringify(body)}`);
    }
    return body;
  }

  async confirmBroadcast(
    transferId: number | string,
    signatures: string[]
  ): Promise<Record<string, unknown>> {
    const res = await this.fetchImpl(
      `${this.baseUrl}/transfers/${transferId}/confirm-broadcast`,
      {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify({ signatures }),
      }
    );
    const body = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(
        `MultiHopper /confirm-broadcast HTTP ${res.status}: ${JSON.stringify(body)}`
      );
    }
    return body;
  }

  async prepareRentReclaim(transferId: number | string): Promise<Record<string, unknown>> {
    const res = await this.fetchImpl(
      `${this.baseUrl}/transfers/${transferId}/reclaim-rent/prepare`,
      {
        method: "POST",
        headers: this.buildHeaders(),
      }
    );
    const body = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(
        `MultiHopper /reclaim-rent/prepare HTTP ${res.status}: ${JSON.stringify(body)}`
      );
    }
    return body;
  }

  async getUsage(): Promise<Record<string, unknown>> {
    const res = await this.fetchImpl(`${this.baseUrl}/usage`, {
      method: "GET",
      headers: this.buildHeaders(),
    });
    const body = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(`MultiHopper /usage HTTP ${res.status}: ${JSON.stringify(body)}`);
    }
    return body;
  }
}
