import crypto from "node:crypto";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { createSapClient } from "@oobe-protocol-labs/synapse-sap-sdk";
import {
  GLOBAL_REGISTRY_ADDRESS,
  isAcceptedPaymentToken,
  MAINNET_SAP_PROGRAM_ID,
  MIN_AGENT_STAKE_LAMPORTS,
  SAP_PROGRAM_ADDRESS,
  USDC_MINT_MAINNET,
} from "@oobe-protocol-labs/synapse-sap-sdk/constants";
import {
  deriveAgent,
  deriveAgentStats,
  deriveCapabilityIndex,
  deriveEscrow,
  deriveGlobalRegistry,
  derivePricingMenu,
  deriveProtocolIndex,
  deriveSettlementReceipt,
  deriveStake,
  deriveTool,
  deriveVault,
  deriveVaultDelegate,
} from "@oobe-protocol-labs/synapse-sap-sdk/pda";

export const PUBLIC_SOLANA_MAINNET_RPC = "https://api.mainnet-beta.solana.com";
export const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export interface SapAgentIdentityBundle {
  programId: string;
  globalRegistryPda: string;
  globalRegistryBump: number;
  ownerWallet: string;
  agentPda: string;
  agentBump: number;
  agentStatsPda: string;
  pricingMenuPda: string;
  memoryVaultPda: string;
  memoryVaultBump: number;
  stakePda: string;
  subAgentDelegatePda?: string;
  registeredTools: Array<{
    toolName: string;
    toolNameSha256: string;
    toolPda: string;
    bump: number;
  }>;
  capabilityIndexes: Array<{
    capability: string;
    indexPda: string;
  }>;
  protocolIndexes: Array<{
    protocol: string;
    indexPda: string;
  }>;
  minAgentStakeSol: number;
  usdcMainnetAccepted: boolean;
}

export interface SapLiveMainnetSnapshot {
  rpcEndpoint: string;
  slot: number;
  sapProgramExecutable: boolean;
  sapProgramOwner: string | null;
  globalRegistryExists: boolean;
  globalRegistryDataBytes: number;
  agentWallet: string;
  agentWalletLamports: number;
  agentWalletSol: number;
  agentAccountDeployed: boolean;
  memoryVaultDeployed: boolean;
}

export function sha256Bytes(input: string): Uint8Array {
  return new Uint8Array(crypto.createHash("sha256").update(input, "utf8").digest());
}

export function deriveSapAgentBundle(
  ownerWallet: string,
  options: {
    subAgentDelegateWallet?: string;
    toolNames?: string[];
    capabilities?: string[];
    protocols?: string[];
  } = {}
): SapAgentIdentityBundle {
  const ownerPk = new PublicKey(ownerWallet);
  const [globalPda, globalBump] = deriveGlobalRegistry(MAINNET_SAP_PROGRAM_ID);
  const [agentPda, agentBump] = deriveAgent(ownerPk, MAINNET_SAP_PROGRAM_ID);
  const [agentStatsPda] = deriveAgentStats(agentPda, MAINNET_SAP_PROGRAM_ID);
  const [pricingMenuPda] = derivePricingMenu(agentPda, MAINNET_SAP_PROGRAM_ID);
  const [vaultPda, vaultBump] = deriveVault(agentPda, MAINNET_SAP_PROGRAM_ID);
  const [stakePda] = deriveStake(agentPda, MAINNET_SAP_PROGRAM_ID);

  let subAgentDelegatePda: string | undefined;
  if (options.subAgentDelegateWallet) {
    const delPk = new PublicKey(options.subAgentDelegateWallet);
    const [dPda] = deriveVaultDelegate(vaultPda, delPk, MAINNET_SAP_PROGRAM_ID);
    subAgentDelegatePda = dPda.toBase58();
  }

  const defaultTools = options.toolNames ?? [
    "shield_audit_token_mint",
    "reclaim_empty_atas_tx",
    "mandate_evaluate_execution",
    "multihopper_plan_and_quote",
    "jupiter_build_guarded_swap",
    "ace_research_conviction_brief",
  ];

  const registeredTools = defaultTools.map((toolName) => {
    const hash = sha256Bytes(toolName);
    const [tPda, tBump] = deriveTool(agentPda, hash, MAINNET_SAP_PROGRAM_ID);
    return {
      toolName,
      toolNameSha256: Buffer.from(hash).toString("hex"),
      toolPda: tPda.toBase58(),
      bump: tBump,
    };
  });

  const capabilities = options.capabilities ?? [
    "autonomous-capital-allocation",
    "pre-trade-rug-shield",
    "programmable-multihop-routing",
    "ata-rent-compounding",
  ];
  const capabilityIndexes = capabilities.map((capability) => {
    const [idxPda] = deriveCapabilityIndex(sha256Bytes(capability), MAINNET_SAP_PROGRAM_ID);
    return { capability, indexPda: idxPda.toBase58() };
  });

  const protocols = options.protocols ?? ["oobe-sap-v2", "multihopper-v1", "jupiter-v6", "x402-solana"];
  const protocolIndexes = protocols.map((protocol) => {
    const [pPda] = deriveProtocolIndex(sha256Bytes(protocol), MAINNET_SAP_PROGRAM_ID);
    return { protocol, indexPda: pPda.toBase58() };
  });

  return {
    programId: SAP_PROGRAM_ADDRESS,
    globalRegistryPda: globalPda.toBase58(),
    globalRegistryBump: globalBump,
    ownerWallet: ownerPk.toBase58(),
    agentPda: agentPda.toBase58(),
    agentBump,
    agentStatsPda: agentStatsPda.toBase58(),
    pricingMenuPda: pricingMenuPda.toBase58(),
    memoryVaultPda: vaultPda.toBase58(),
    memoryVaultBump: vaultBump,
    stakePda: stakePda.toBase58(),
    subAgentDelegatePda,
    registeredTools,
    capabilityIndexes,
    protocolIndexes,
    minAgentStakeSol: Number(MIN_AGENT_STAKE_LAMPORTS) / LAMPORTS_PER_SOL,
    usdcMainnetAccepted: isAcceptedPaymentToken(USDC_MINT_MAINNET),
  };
}

export function deriveSapAntiReplayReceipt(
  agentWallet: string,
  depositorWallet: string,
  serviceHashBytes: Uint8Array
): {
  escrowPda: string;
  settlementReceiptPda: string;
  receiptBump: number;
} {
  const [agentPda] = deriveAgent(new PublicKey(agentWallet), MAINNET_SAP_PROGRAM_ID);
  const [escrowPda] = deriveEscrow(agentPda, new PublicKey(depositorWallet), MAINNET_SAP_PROGRAM_ID);
  const [receiptPda, receiptBump] = deriveSettlementReceipt(
    escrowPda,
    serviceHashBytes,
    MAINNET_SAP_PROGRAM_ID
  );
  return {
    escrowPda: escrowPda.toBase58(),
    settlementReceiptPda: receiptPda.toBase58(),
    receiptBump,
  };
}

export async function inspectSapMainnetState(
  agentWallet: string,
  rpcUrl: string = PUBLIC_SOLANA_MAINNET_RPC
): Promise<SapLiveMainnetSnapshot> {
  const client = createSapClient(rpcUrl);
  const conn: Connection = client.connection;
  const ownerPk = new PublicKey(agentWallet);
  const [agentPda] = deriveAgent(ownerPk, MAINNET_SAP_PROGRAM_ID);
  const [vaultPda] = deriveVault(agentPda, MAINNET_SAP_PROGRAM_ID);

  const [slot, accounts] = await Promise.all([
    conn.getSlot("confirmed"),
    conn.getMultipleAccountsInfo(
      [
        MAINNET_SAP_PROGRAM_ID,
        new PublicKey(GLOBAL_REGISTRY_ADDRESS),
        ownerPk,
        agentPda,
        vaultPda,
      ],
      "confirmed"
    ),
  ]);

  const [progAcc, globalAcc, walletAcc, agentAcc, vaultAcc] = accounts;

  return {
    rpcEndpoint: rpcUrl,
    slot,
    sapProgramExecutable: Boolean(progAcc?.executable),
    sapProgramOwner: progAcc?.owner ? progAcc.owner.toBase58() : null,
    globalRegistryExists: Boolean(globalAcc),
    globalRegistryDataBytes: globalAcc?.data ? globalAcc.data.length : 0,
    agentWallet: ownerPk.toBase58(),
    agentWalletLamports: walletAcc?.lamports ?? 0,
    agentWalletSol: Number(((walletAcc?.lamports ?? 0) / LAMPORTS_PER_SOL).toFixed(9)),
    agentAccountDeployed: Boolean(agentAcc),
    memoryVaultDeployed: Boolean(vaultAcc),
  };
}

export function buildSapMandateAnchorTx(params: {
  payer: PublicKey;
  recipientVaultOrTreasury: PublicKey;
  lamports: number;
  mandateId: string;
  serviceHashHex: string;
  recentBlockhash: string;
  signer?: Keypair;
}): {
  transactionBase64: string;
  instructionCount: number;
  memoPayload: string;
  isSigned: boolean;
} {
  const bundle = deriveSapAgentBundle(params.payer.toBase58());
  const memoPayload = JSON.stringify({
    proto: "OOBE-SAP-v2",
    program: bundle.programId,
    agentPda: bundle.agentPda,
    vaultPda: bundle.memoryVaultPda,
    mandateId: params.mandateId,
    serviceHash: params.serviceHashHex.slice(0, 32),
  });

  const ixs: TransactionInstruction[] = [];
  if (params.lamports > 0) {
    ixs.push(
      SystemProgram.transfer({
        fromPubkey: params.payer,
        toPubkey: params.recipientVaultOrTreasury,
        lamports: params.lamports,
      })
    );
  }
  ixs.push(
    new TransactionInstruction({
      programId: MEMO_PROGRAM_ID,
      keys: [{ pubkey: params.payer, isSigner: true, isWritable: false }],
      data: Buffer.from(memoPayload, "utf8"),
    })
  );

  const msgV0 = new TransactionMessage({
    payerKey: params.payer,
    recentBlockhash: params.recentBlockhash,
    instructions: ixs,
  }).compileToV0Message();

  const vtx = new VersionedTransaction(msgV0);
  if (params.signer) {
    vtx.sign([params.signer]);
  }

  return {
    transactionBase64: Buffer.from(vtx.serialize()).toString("base64"),
    instructionCount: ixs.length,
    memoPayload,
    isSigned: Boolean(params.signer),
  };
}
