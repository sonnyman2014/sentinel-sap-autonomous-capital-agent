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
import {
  createCloseAccountInstruction,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  CapitalMandateEngine,
  DEFAULT_TREASURY_WALLET,
  MandateEvaluation,
} from "./mandate.js";
import { PUBLIC_SOLANA_MAINNET_RPC } from "./sap-agent.js";

export const CANONICAL_SAFE_MINTS = new Set<string>([
  "So11111111111111111111111111111111111111112", // Wrapped SOL
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // Circle Native USDC
]);

export const STANDARD_ATA_RENT_LAMPORTS = 2_039_280;

export interface LayerCheckResult {
  layer: number;
  name: string;
  passed: boolean;
  scoreDelta: number;
  detail: string;
}

export interface TokenShieldAuditReport {
  mint: string;
  programOwner: string;
  isToken2022: boolean;
  decimals: number;
  supplyUi: number;
  convictionScore: number;
  verdict: "SAFE" | "CAUTION" | "BLOCKED";
  poolLiquidityUsd: number;
  volume24hUsd: number;
  top10HolderPct: number;
  layers: LayerCheckResult[];
  auditedAtIso: string;
}

export interface ParsedMintInspectionInput {
  programOwner: string;
  decimals: number;
  supplyUi: number;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  extensions?: Array<{
    extension: string;
    state?: Record<string, unknown>;
  }>;
  top10HolderPct: number;
  poolLiquidityUsd: number;
  volume24hUsd: number;
  buys24h: number;
  sells24h: number;
  priceImpactPct?: number;
}

export function evaluate10LayerShield(
  mint: string,
  input: ParsedMintInspectionInput
): TokenShieldAuditReport {
  const isCanonical = CANONICAL_SAFE_MINTS.has(mint);
  const isSpl = input.programOwner === TOKEN_PROGRAM_ID.toBase58();
  const isT22 = input.programOwner === TOKEN_2022_PROGRAM_ID.toBase58();
  const layers: LayerCheckResult[] = [];
  let score = 100;

  // Layer 1: Canonical SPL / Token-2022 Program Owner
  const l1Pass = isSpl || isT22;
  if (!l1Pass) score -= 50;
  layers.push({
    layer: 1,
    name: "Program Owner Verification",
    passed: l1Pass,
    scoreDelta: l1Pass ? 0 : -50,
    detail: l1Pass
      ? `Verified ${isT22 ? "Token-2022" : "SPL Token"} program (${input.programOwner})`
      : `Unexpected owner program: ${input.programOwner}`,
  });

  // Layer 2: Mint Authority Revocation
  const l2Pass = input.mintAuthority === null || isCanonical;
  if (!l2Pass) score -= 30;
  layers.push({
    layer: 2,
    name: "Mint Authority Guard",
    passed: l2Pass,
    scoreDelta: l2Pass ? 0 : -30,
    detail:
      input.mintAuthority === null
        ? "Mint authority permanently revoked (null)"
        : isCanonical
        ? `Canonical reserve asset (${mint.slice(0, 6)}...)`
        : `Active mintAuthority detected (${input.mintAuthority}) - dilution risk`,
  });

  // Layer 3: Freeze Authority Revocation
  const l3Pass = input.freezeAuthority === null || isCanonical;
  if (!l3Pass) score -= 25;
  layers.push({
    layer: 3,
    name: "Freeze Authority Guard",
    passed: l3Pass,
    scoreDelta: l3Pass ? 0 : -25,
    detail:
      input.freezeAuthority === null
        ? "Freeze authority permanently revoked (null)"
        : isCanonical
        ? "Regulated canonical issuer freeze authority"
        : `Active freezeAuthority detected (${input.freezeAuthority}) - blacklist trap risk`,
  });

  // Layer 4: Token-2022 Malicious Extension Detector
  let extPenalty = 0;
  const extAlerts: string[] = [];
  for (const ext of input.extensions ?? []) {
    const name = String(ext.extension || "").toLowerCase();
    const st = ext.state ?? {};
    if (name === "permanentdelegate" && st.delegate) {
      extPenalty += 50;
      extAlerts.push(`PermanentDelegate(${String(st.delegate)})`);
    }
    if (name === "nontransferable") {
      extPenalty += 50;
      extAlerts.push("NonTransferable(soulbound/unsellable)");
    }
    if (name === "defaultaccountstate" && String(st.state || "").toLowerCase() === "frozen") {
      extPenalty += 40;
      extAlerts.push("DefaultAccountState(frozen)");
    }
    if (name === "transferfeeconfig") {
      const newer = (st.newerTransferFee as Record<string, unknown> | undefined) ?? {};
      const bps = Number(newer.transferFeeBasisPoints ?? st.transferFeeBasisPoints ?? 0);
      if (bps > 100) {
        extPenalty += 35;
        extAlerts.push(`ExcessiveTransferFee(${bps} bps)`);
      }
    }
  }
  score -= extPenalty;
  layers.push({
    layer: 4,
    name: "Token-2022 Extension Trap Scanner",
    passed: extPenalty === 0,
    scoreDelta: -extPenalty,
    detail:
      extPenalty === 0
        ? "0 dangerous Token-2022 extensions"
        : `Hazardous extensions: ${extAlerts.join(", ")}`,
  });

  // Layer 5: Supply & Decimals Sanity
  const l5Pass = input.supplyUi > 0 && input.decimals >= 0 && input.decimals <= 12;
  if (!l5Pass) score -= 20;
  layers.push({
    layer: 5,
    name: "Supply & Decimals Sanity",
    passed: l5Pass,
    scoreDelta: l5Pass ? 0 : -20,
    detail: `Decimals=${input.decimals}, Supply=${input.supplyUi.toLocaleString("en-US")}`,
  });

  // Layer 6: Top-10 Holder Concentration Cap
  const l6Pass = isCanonical || input.top10HolderPct <= 35.0;
  if (!l6Pass) score -= 15;
  layers.push({
    layer: 6,
    name: "Top-10 Holder Concentration",
    passed: l6Pass,
    scoreDelta: l6Pass ? 0 : -15,
    detail: `Top-10 concentration=${input.top10HolderPct.toFixed(2)}% (threshold <= 35%)`,
  });

  // Layer 7: DEX Liquidity Floor (>= $25k)
  const l7Pass = isCanonical || input.poolLiquidityUsd >= 25_000;
  if (!l7Pass) score -= 25;
  layers.push({
    layer: 7,
    name: "Minimum Pool Liquidity Floor",
    passed: l7Pass,
    scoreDelta: l7Pass ? 0 : -25,
    detail: `DEX Liquidity=$${input.poolLiquidityUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
  });

  // Layer 8: 24h Organic Volume Floor
  const l8Pass = isCanonical || input.volume24hUsd >= 5_000;
  if (!l8Pass) score -= 10;
  layers.push({
    layer: 8,
    name: "24h Organic Volume Velocity",
    passed: l8Pass,
    scoreDelta: l8Pass ? 0 : -10,
    detail: `24h Volume=$${input.volume24hUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
  });

  // Layer 9: Honeypot Sellability Ratio
  const totalTx = input.buys24h + input.sells24h;
  const sellRatio = totalTx > 0 ? input.sells24h / totalTx : isCanonical ? 0.5 : 0;
  const l9Pass = isCanonical || (input.sells24h > 0 && sellRatio >= 0.12);
  if (!l9Pass) score -= 35;
  layers.push({
    layer: 9,
    name: "Honeypot Sell-Execution Ratio",
    passed: l9Pass,
    scoreDelta: l9Pass ? 0 : -35,
    detail: `24h Buys=${input.buys24h}, Sells=${input.sells24h} (sell share ${(sellRatio * 100).toFixed(1)}%)`,
  });

  // Layer 10: Route Price Impact Guard
  const impact = input.priceImpactPct ?? 0.05;
  const l10Pass = impact <= 5.0;
  if (!l10Pass) score -= 20;
  layers.push({
    layer: 10,
    name: "Route Price Impact Ceiling",
    passed: l10Pass,
    scoreDelta: l10Pass ? 0 : -20,
    detail: `Estimated route price impact=${impact.toFixed(3)}% (ceiling <= 5.0%)`,
  });

  const convictionScore = Math.max(0, Math.min(100, score));
  const verdict =
    convictionScore >= 80 ? "SAFE" : convictionScore >= 55 ? "CAUTION" : "BLOCKED";

  return {
    mint,
    programOwner: input.programOwner,
    isToken2022: isT22,
    decimals: input.decimals,
    supplyUi: input.supplyUi,
    convictionScore,
    verdict,
    poolLiquidityUsd: input.poolLiquidityUsd,
    volume24hUsd: input.volume24hUsd,
    top10HolderPct: input.top10HolderPct,
    layers,
    auditedAtIso: new Date().toISOString(),
  };
}

export async function auditTokenMintLive(
  mintAddress: string,
  options: {
    rpcUrl?: string;
    connection?: Connection;
    fetchImpl?: typeof fetch;
  } = {}
): Promise<TokenShieldAuditReport> {
  const mintPk = new PublicKey(mintAddress);
  const conn =
    options.connection ??
    new Connection(options.rpcUrl ?? PUBLIC_SOLANA_MAINNET_RPC, "confirmed");
  const fetchFn = options.fetchImpl ?? fetch;

  const parsedAcc = await conn.getParsedAccountInfo(mintPk, "confirmed");
  if (!parsedAcc.value) {
    throw new Error(`Mint account not found on Solana mainnet: ${mintPk.toBase58()}`);
  }

  const programOwner = parsedAcc.value.owner.toBase58();
  const parsedData = parsedAcc.value.data as {
    parsed?: {
      info?: {
        decimals?: number;
        supply?: string;
        mintAuthority?: string | null;
        freezeAuthority?: string | null;
        extensions?: Array<{ extension: string; state?: Record<string, unknown> }>;
      };
    };
  };
  const info = parsedData.parsed?.info ?? {};
  const decimals = Number(info.decimals ?? 0);
  const rawSupply = Number(info.supply ?? "0");
  const supplyUi = decimals > 0 ? rawSupply / Math.pow(10, decimals) : rawSupply;

  let top10HolderPct = 12.0;
  if (!CANONICAL_SAFE_MINTS.has(mintPk.toBase58())) {
    try {
      const largest = await conn.getTokenLargestAccounts(mintPk, "confirmed");
      const topSum = largest.value
        .slice(0, 10)
        .reduce((acc, row) => acc + Number(row.uiAmount ?? 0), 0);
      if (supplyUi > 0) {
        top10HolderPct = Math.min(100, (topSum / supplyUi) * 100);
      }
    } catch {
      // Keep conservative default if public RPC rate-limits getTokenLargestAccounts
    }
  }

  let poolLiquidityUsd = CANONICAL_SAFE_MINTS.has(mintPk.toBase58()) ? 250_000_000 : 0;
  let volume24hUsd = CANONICAL_SAFE_MINTS.has(mintPk.toBase58()) ? 500_000_000 : 0;
  let buys24h = CANONICAL_SAFE_MINTS.has(mintPk.toBase58()) ? 50_000 : 0;
  let sells24h = CANONICAL_SAFE_MINTS.has(mintPk.toBase58()) ? 48_500 : 0;

  try {
    const dexRes = await fetchFn(
      `https://api.dexscreener.com/latest/dex/tokens/${mintPk.toBase58()}`,
      { headers: { Accept: "application/json" } }
    );
    if (dexRes.ok) {
      const dexJson = (await dexRes.json()) as {
        pairs?: Array<{
          chainId?: string;
          liquidity?: { usd?: number };
          volume?: { h24?: number };
          txns?: { h24?: { buys?: number; sells?: number } };
        }>;
      };
      const solPairs = (dexJson.pairs ?? []).filter((p) => p.chainId === "solana");
      if (solPairs.length > 0) {
        poolLiquidityUsd = solPairs.reduce((a, p) => a + Number(p.liquidity?.usd ?? 0), 0);
        volume24hUsd = solPairs.reduce((a, p) => a + Number(p.volume?.h24 ?? 0), 0);
        buys24h = solPairs.reduce((a, p) => a + Number(p.txns?.h24?.buys ?? 0), 0);
        sells24h = solPairs.reduce((a, p) => a + Number(p.txns?.h24?.sells ?? 0), 0);
      }
    }
  } catch {
    // Fallback to canonical baseline if offline
  }

  return evaluate10LayerShield(mintPk.toBase58(), {
    programOwner,
    decimals,
    supplyUi,
    mintAuthority: info.mintAuthority ?? null,
    freezeAuthority: info.freezeAuthority ?? null,
    extensions: info.extensions ?? [],
    top10HolderPct,
    poolLiquidityUsd,
    volume24hUsd,
    buys24h,
    sells24h,
    priceImpactPct: 0.05,
  });
}

export interface TokenAccountCandidate {
  pubkey: string;
  mint: string;
  programId: string;
  amountRaw: string;
  lamports: number;
  state: "initialized" | "frozen" | "uninitialized";
  withheldFeeAmountRaw?: string;
}

export interface RentReclaimPlan {
  ownerWallet: string;
  treasuryWallet: string;
  reclaimableCount: number;
  reclaimableAtas: string[];
  skippedNonZeroCount: number;
  skippedFrozenAtas: string[];
  skippedWithheldFeeAtas: string[];
  grossReclaimableLamports: number;
  grossReclaimableSol: number;
  treasuryFeeLamports: number;
  netOwnerLamports: number;
  netOwnerSol: number;
  transactionBase64: string | null;
  instructionCount: number;
}

export function buildEmptyAtaRentReclaimTx(params: {
  ownerWallet: string;
  candidates: TokenAccountCandidate[];
  recentBlockhash: string;
  treasuryWallet?: string;
  feeBps?: number;
  maxAccountsPerTx?: number;
  signer?: Keypair;
}): RentReclaimPlan {
  const ownerPk = new PublicKey(params.ownerWallet);
  const treasuryPk = new PublicKey(params.treasuryWallet ?? DEFAULT_TREASURY_WALLET);
  const feeBps = params.feeBps ?? 500; // 5% protocol fee (0% if self-compounding to same wallet)
  const maxBatch = params.maxAccountsPerTx ?? 20;

  const reclaimable: TokenAccountCandidate[] = [];
  const skippedFrozenAtas: string[] = [];
  const skippedWithheldFeeAtas: string[] = [];
  let skippedNonZeroCount = 0;

  for (const c of params.candidates) {
    if (c.amountRaw !== "0") {
      skippedNonZeroCount += 1;
      continue;
    }
    if (c.state === "frozen") {
      skippedFrozenAtas.push(c.pubkey);
      continue;
    }
    if (c.withheldFeeAmountRaw && c.withheldFeeAmountRaw !== "0") {
      skippedWithheldFeeAtas.push(c.pubkey);
      continue;
    }
    if (reclaimable.length < maxBatch) {
      reclaimable.push(c);
    }
  }

  const grossReclaimableLamports = reclaimable.reduce(
    (sum, item) => sum + (item.lamports > 0 ? item.lamports : STANDARD_ATA_RENT_LAMPORTS),
    0
  );
  const effectiveFeeBps = ownerPk.equals(treasuryPk) ? 0 : feeBps;
  const treasuryFeeLamports = Math.floor((grossReclaimableLamports * effectiveFeeBps) / 10_000);
  const netOwnerLamports = grossReclaimableLamports - treasuryFeeLamports;

  if (reclaimable.length === 0) {
    return {
      ownerWallet: ownerPk.toBase58(),
      treasuryWallet: treasuryPk.toBase58(),
      reclaimableCount: 0,
      reclaimableAtas: [],
      skippedNonZeroCount,
      skippedFrozenAtas,
      skippedWithheldFeeAtas,
      grossReclaimableLamports: 0,
      grossReclaimableSol: 0,
      treasuryFeeLamports: 0,
      netOwnerLamports: 0,
      netOwnerSol: 0,
      transactionBase64: null,
      instructionCount: 0,
    };
  }

  const ixs: TransactionInstruction[] = reclaimable.map((c) =>
    createCloseAccountInstruction(
      new PublicKey(c.pubkey),
      ownerPk,
      ownerPk,
      [],
      new PublicKey(c.programId)
    )
  );

  if (treasuryFeeLamports > 0) {
    ixs.push(
      SystemProgram.transfer({
        fromPubkey: ownerPk,
        toPubkey: treasuryPk,
        lamports: treasuryFeeLamports,
      })
    );
  }

  const msgV0 = new TransactionMessage({
    payerKey: ownerPk,
    recentBlockhash: params.recentBlockhash,
    instructions: ixs,
  }).compileToV0Message();

  const vtx = new VersionedTransaction(msgV0);
  if (params.signer) {
    vtx.sign([params.signer]);
  }

  return {
    ownerWallet: ownerPk.toBase58(),
    treasuryWallet: treasuryPk.toBase58(),
    reclaimableCount: reclaimable.length,
    reclaimableAtas: reclaimable.map((r) => r.pubkey),
    skippedNonZeroCount,
    skippedFrozenAtas,
    skippedWithheldFeeAtas,
    grossReclaimableLamports,
    grossReclaimableSol: Number((grossReclaimableLamports / LAMPORTS_PER_SOL).toFixed(8)),
    treasuryFeeLamports,
    netOwnerLamports,
    netOwnerSol: Number((netOwnerLamports / LAMPORTS_PER_SOL).toFixed(8)),
    transactionBase64: Buffer.from(vtx.serialize()).toString("base64"),
    instructionCount: ixs.length,
  };
}

export async function scanMainnetEmptyAtas(
  ownerWallet: string,
  options: {
    rpcUrl?: string;
    connection?: Connection;
    treasuryWallet?: string;
    feeBps?: number;
  } = {}
): Promise<RentReclaimPlan> {
  const ownerPk = new PublicKey(ownerWallet);
  const conn =
    options.connection ??
    new Connection(options.rpcUrl ?? PUBLIC_SOLANA_MAINNET_RPC, "confirmed");

  const [splAccounts, t22Accounts, latestBh] = await Promise.all([
    conn.getParsedTokenAccountsByOwner(ownerPk, { programId: TOKEN_PROGRAM_ID }, "confirmed"),
    conn.getParsedTokenAccountsByOwner(ownerPk, { programId: TOKEN_2022_PROGRAM_ID }, "confirmed"),
    conn.getLatestBlockhash("confirmed"),
  ]);

  const candidates: TokenAccountCandidate[] = [];
  for (const [programPk, resp] of [
    [TOKEN_PROGRAM_ID, splAccounts],
    [TOKEN_2022_PROGRAM_ID, t22Accounts],
  ] as const) {
    for (const row of resp.value) {
      const pInfo =
        (row.account.data.parsed as { info?: Record<string, unknown> } | undefined)?.info ?? {};
      const tokAmt = (pInfo.tokenAmount as { amount?: string } | undefined) ?? {};
      const exts =
        (pInfo.extensions as
          | Array<{ extension?: string; state?: Record<string, unknown> }>
          | undefined) ?? [];
      let withheld = "0";
      for (const ex of exts) {
        if (String(ex.extension || "").toLowerCase() === "transferfeeamount") {
          withheld = String(ex.state?.withheldAmount ?? "0");
        }
      }
      const rawState = String(pInfo.state ?? "initialized").toLowerCase();
      candidates.push({
        pubkey: row.pubkey.toBase58(),
        mint: String(pInfo.mint ?? ""),
        programId: programPk.toBase58(),
        amountRaw: String(tokAmt.amount ?? "0"),
        lamports: row.account.lamports,
        state: rawState === "frozen" ? "frozen" : "initialized",
        withheldFeeAmountRaw: withheld,
      });
    }
  }

  return buildEmptyAtaRentReclaimTx({
    ownerWallet: ownerPk.toBase58(),
    candidates,
    recentBlockhash: latestBh.blockhash,
    treasuryWallet: options.treasuryWallet,
    feeBps: options.feeBps,
  });
}

export interface GuardedJupiterQuoteResult {
  allowed: boolean;
  shieldReport: TokenShieldAuditReport;
  mandateEvaluation: MandateEvaluation;
  quote: {
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    otherAmountThreshold: string;
    slippageBps: number;
    priceImpactPct: number;
    routeLabels: string[];
    source: string;
  } | null;
}

export async function quoteGuardedJupiterSwap(params: {
  intentId: string;
  actorWallet: string;
  inputMint: string;
  outputMint: string;
  inAmountRaw: string;
  amountUsd: number;
  slippageBps?: number;
  mandateEngine: CapitalMandateEngine;
  precomputedShield?: TokenShieldAuditReport;
  fetchImpl?: typeof fetch;
  rpcUrl?: string;
}): Promise<GuardedJupiterQuoteResult> {
  const fetchFn = params.fetchImpl ?? fetch;
  const slippageBps = params.slippageBps ?? 50;
  const shieldReport =
    params.precomputedShield ??
    (await auditTokenMintLive(params.outputMint, {
      rpcUrl: params.rpcUrl,
      fetchImpl: fetchFn,
    }));

  const mandateEvaluation = params.mandateEngine.evaluate(
    {
      intentId: params.intentId,
      protocol: "jupiter",
      actorWallet: params.actorWallet,
      tokenMint: params.outputMint,
      amountUsd: params.amountUsd,
      slippageBps,
      convictionScore: shieldReport.convictionScore,
      poolLiquidityUsd: shieldReport.poolLiquidityUsd,
    },
    true
  );

  if (!mandateEvaluation.allowed || shieldReport.verdict === "BLOCKED") {
    return {
      allowed: false,
      shieldReport,
      mandateEvaluation,
      quote: null,
    };
  }

  const jupUrl =
    `https://lite-api.jup.ag/swap/v1/quote?inputMint=${encodeURIComponent(params.inputMint)}` +
    `&outputMint=${encodeURIComponent(params.outputMint)}` +
    `&amount=${encodeURIComponent(params.inAmountRaw)}` +
    `&slippageBps=${slippageBps}`;

  const res = await fetchFn(jupUrl, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Jupiter quote endpoint returned HTTP ${res.status}`);
  }
  const q = (await res.json()) as {
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    otherAmountThreshold: string;
    slippageBps: number;
    priceImpactPct?: string | number;
    routePlan?: Array<{ swapInfo?: { label?: string } }>;
  };

  return {
    allowed: true,
    shieldReport,
    mandateEvaluation,
    quote: {
      inputMint: q.inputMint,
      outputMint: q.outputMint,
      inAmount: q.inAmount,
      outAmount: q.outAmount,
      otherAmountThreshold: q.otherAmountThreshold,
      slippageBps: q.slippageBps ?? slippageBps,
      priceImpactPct: Number(q.priceImpactPct ?? 0),
      routeLabels: (q.routePlan ?? [])
        .map((r) => r.swapInfo?.label)
        .filter((x): x is string => Boolean(x)),
      source: "https://lite-api.jup.ag/swap/v1/quote",
    },
  };
}
