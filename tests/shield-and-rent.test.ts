import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Keypair, VersionedTransaction } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { CapitalMandateEngine, createDefaultMandate } from "../src/mandate.js";
import {
  buildEmptyAtaRentReclaimTx,
  evaluate10LayerShield,
  evaluate11LayerShield,
  evaluate12LayerShield,
  parseRawSupplyToUi,
  quoteGuardedJupiterSwap,
  STANDARD_ATA_RENT_LAMPORTS,
} from "../src/shield-and-rent.js";

describe("12-Layer SPL / Token-2022 Risk Shield & Empty-ATA Rent Compounding", () => {
  it("scores clean revoked SPL tokens SAFE across all 12 layers, preserves 10/11-layer aliases, and blocks Token-2022 PermanentDelegate & Cartel/Hook traps", () => {
    const cleanMint = Keypair.generate().publicKey.toBase58();
    const safeReport = evaluate12LayerShield(cleanMint, {
      programOwner: TOKEN_PROGRAM_ID.toBase58(),
      decimals: 6,
      supplyUi: 1_000_000_000,
      mintAuthority: null,
      freezeAuthority: null,
      extensions: [],
      top10HolderPct: 18.4,
      poolLiquidityUsd: 185_000,
      volume24hUsd: 92_000,
      buys24h: 410,
      sells24h: 365,
      priceImpactPct: 0.25,
    });
    assert.equal(safeReport.convictionScore, 100);
    assert.equal(safeReport.verdict, "SAFE");
    assert.equal(safeReport.layers.length, 12);
    assert.equal(safeReport.layers[10]?.layer, 11);
    assert.equal(safeReport.layers[11]?.layer, 12);

    // Verify backwards-compatible 11-layer and 10-layer aliases
    assert.equal(evaluate11LayerShield, evaluate12LayerShield);
    assert.equal(evaluate10LayerShield, evaluate12LayerShield);

    // Verify BigInt raw supply conversion above Number.MAX_SAFE_INTEGER (10B tokens @ 9 decimals)
    assert.equal(parseRawSupplyToUi("10000000000000000000", 9), 10_000_000_000);
    assert.equal(parseRawSupplyToUi("invalid", 9), 0);

    // Verify Layer 12 blocks 2-Hop Funder Cartel & Token-2022 TransferHook CPI trap
    const cartelReport = evaluate12LayerShield(cleanMint, {
      programOwner: TOKEN_2022_PROGRAM_ID.toBase58(),
      decimals: 6,
      supplyUi: 1_000_000_000,
      mintAuthority: null,
      freezeAuthority: null,
      extensions: [
        {
          extension: "transferHook",
          state: { programId: Keypair.generate().publicKey.toBase58() },
        },
      ],
      top10HolderPct: 15.0,
      poolLiquidityUsd: 150_000,
      volume24hUsd: 80_000,
      buys24h: 300,
      sells24h: 280,
      cartelFunderClusterPct: 42.0,
    });
    assert.equal(cartelReport.layers[11]?.passed, false);
    assert.equal(cartelReport.convictionScore, 65);
    assert.equal(cartelReport.verdict, "CAUTION");

    const trapMint = Keypair.generate().publicKey.toBase58();
    const trapReport = evaluate10LayerShield(trapMint, {
      programOwner: TOKEN_2022_PROGRAM_ID.toBase58(),
      decimals: 9,
      supplyUi: 1_000_000_000,
      mintAuthority: Keypair.generate().publicKey.toBase58(),
      freezeAuthority: null,
      extensions: [
        {
          extension: "permanentDelegate",
          state: { delegate: Keypair.generate().publicKey.toBase58() },
        },
        {
          extension: "transferFeeConfig",
          state: { newerTransferFee: { transferFeeBasisPoints: 800 } },
        },
      ],
      top10HolderPct: 72.0,
      poolLiquidityUsd: 8_000,
      volume24hUsd: 1_200,
      buys24h: 95,
      sells24h: 0,
    });
    assert.equal(trapReport.verdict, "BLOCKED");
    assert.equal(trapReport.convictionScore, 0);
  });

  it("builds CloseAccount VersionedTransactions while skipping frozen and withheld-fee ATAs", () => {
    const owner = Keypair.generate();
    const treasury = Keypair.generate();
    const ataEmptySpl = Keypair.generate().publicKey.toBase58();
    const ataEmptyT22 = Keypair.generate().publicKey.toBase58();
    const ataFrozen = Keypair.generate().publicKey.toBase58();
    const ataWithheld = Keypair.generate().publicKey.toBase58();
    const ataNonZero = Keypair.generate().publicKey.toBase58();
    const dummyMint = Keypair.generate().publicKey.toBase58();

    const plan = buildEmptyAtaRentReclaimTx({
      ownerWallet: owner.publicKey.toBase58(),
      treasuryWallet: treasury.publicKey.toBase58(),
      feeBps: 500, // 5%
      recentBlockhash: "11111111111111111111111111111111",
      signer: owner,
      candidates: [
        {
          pubkey: ataEmptySpl,
          mint: dummyMint,
          programId: TOKEN_PROGRAM_ID.toBase58(),
          amountRaw: "0",
          lamports: STANDARD_ATA_RENT_LAMPORTS,
          state: "initialized",
        },
        {
          pubkey: ataEmptyT22,
          mint: dummyMint,
          programId: TOKEN_2022_PROGRAM_ID.toBase58(),
          amountRaw: "0",
          lamports: STANDARD_ATA_RENT_LAMPORTS,
          state: "initialized",
          withheldFeeAmountRaw: "0",
        },
        {
          pubkey: ataFrozen,
          mint: dummyMint,
          programId: TOKEN_2022_PROGRAM_ID.toBase58(),
          amountRaw: "0",
          lamports: STANDARD_ATA_RENT_LAMPORTS,
          state: "frozen",
        },
        {
          pubkey: ataWithheld,
          mint: dummyMint,
          programId: TOKEN_2022_PROGRAM_ID.toBase58(),
          amountRaw: "0",
          lamports: STANDARD_ATA_RENT_LAMPORTS,
          state: "initialized",
          withheldFeeAmountRaw: "450",
        },
        {
          pubkey: ataNonZero,
          mint: dummyMint,
          programId: TOKEN_PROGRAM_ID.toBase58(),
          amountRaw: "1000000",
          lamports: STANDARD_ATA_RENT_LAMPORTS,
          state: "initialized",
        },
      ],
    });

    assert.equal(plan.reclaimableCount, 2);
    assert.deepEqual(plan.skippedFrozenAtas, [ataFrozen]);
    assert.deepEqual(plan.skippedWithheldFeeAtas, [ataWithheld]);
    assert.equal(plan.skippedNonZeroCount, 1);
    assert.equal(plan.grossReclaimableLamports, STANDARD_ATA_RENT_LAMPORTS * 2);
    assert.equal(plan.instructionCount, 3); // 2 CloseAccount + 1 5% SystemProgram.transfer
    assert.ok(plan.transactionBase64);

    const decoded = VersionedTransaction.deserialize(
      Buffer.from(plan.transactionBase64, "base64")
    );
    assert.ok(decoded.signatures[0].some((b) => b !== 0));
  });

  it("blocks unsafe Jupiter swaps pre-RPC and quotes clean assets under mandate", async () => {
    const actor = Keypair.generate().publicKey.toBase58();
    const engine = new CapitalMandateEngine(createDefaultMandate(actor));
    const badMint = Keypair.generate().publicKey.toBase58();
    const blockedShield = evaluate10LayerShield(badMint, {
      programOwner: TOKEN_PROGRAM_ID.toBase58(),
      decimals: 6,
      supplyUi: 1_000_000,
      mintAuthority: actor,
      freezeAuthority: actor,
      top10HolderPct: 90,
      poolLiquidityUsd: 500,
      volume24hUsd: 100,
      buys24h: 10,
      sells24h: 0,
    });

    let fetchCalled = false;
    const blockedRes = await quoteGuardedJupiterSwap({
      intentId: "swap-bad-1",
      actorWallet: actor,
      inputMint: "So11111111111111111111111111111111111111112",
      outputMint: badMint,
      inAmountRaw: "100000000",
      amountUsd: 18,
      mandateEngine: engine,
      precomputedShield: blockedShield,
      fetchImpl: (async () => {
        fetchCalled = true;
        throw new Error("Should not reach Jupiter fetch");
      }) as typeof fetch,
    });
    assert.equal(blockedRes.allowed, false);
    assert.equal(blockedRes.quote, null);
    assert.equal(fetchCalled, false);

    const usdcMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    const safeShield = evaluate10LayerShield(usdcMint, {
      programOwner: TOKEN_PROGRAM_ID.toBase58(),
      decimals: 6,
      supplyUi: 5_000_000_000,
      mintAuthority: null,
      freezeAuthority: null,
      top10HolderPct: 10,
      poolLiquidityUsd: 250_000_000,
      volume24hUsd: 500_000_000,
      buys24h: 25000,
      sells24h: 24500,
    });

    const allowedRes = await quoteGuardedJupiterSwap({
      intentId: "swap-safe-1",
      actorWallet: actor,
      inputMint: "So11111111111111111111111111111111111111112",
      outputMint: usdcMint,
      inAmountRaw: "100000000",
      amountUsd: 18,
      slippageBps: 50,
      mandateEngine: engine,
      precomputedShield: safeShield,
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            inputMint: "So11111111111111111111111111111111111111112",
            outputMint: usdcMint,
            inAmount: "100000000",
            outAmount: "18425000",
            otherAmountThreshold: "18332875",
            slippageBps: 50,
            priceImpactPct: "0.0012",
            routePlan: [{ swapInfo: { label: "Whirlpool" } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )) as typeof fetch,
    });

    assert.equal(allowedRes.allowed, true);
    assert.equal(allowedRes.quote?.outAmount, "18425000");
    assert.deepEqual(allowedRes.quote?.routeLabels, ["Whirlpool"]);
  });
});
