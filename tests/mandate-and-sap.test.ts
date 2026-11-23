import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Keypair, PublicKey, VersionedTransaction } from "@solana/web3.js";
import {
  CapitalMandateEngine,
  createDefaultMandate,
  DEFAULT_TREASURY_WALLET,
} from "../src/mandate.js";
import {
  buildSapMandateAnchorTx,
  deriveSapAgentBundle,
  deriveSapAntiReplayReceipt,
} from "../src/sap-agent.js";

describe("OOBE Protocol SAP v2 Identity & Programmable Capital Mandates", () => {
  it("derives deterministic SAP v2 PDAs matching SAPpUhsWLJG1FfkGRcXagEDMrMsWGjbky7AyhGpFETZ", () => {
    const subDelegate = Keypair.generate().publicKey.toBase58();
    const bundle1 = deriveSapAgentBundle(DEFAULT_TREASURY_WALLET, {
      subAgentDelegateWallet: subDelegate,
    });
    const bundle2 = deriveSapAgentBundle(DEFAULT_TREASURY_WALLET, {
      subAgentDelegateWallet: subDelegate,
    });

    assert.equal(bundle1.programId, "SAPpUhsWLJG1FfkGRcXagEDMrMsWGjbky7AyhGpFETZ");
    assert.equal(bundle1.globalRegistryPda, "9odFrYBBZq6UQC6aGyzMPNXWJQn55kMtfigzhLg6S6L5");
    assert.equal(bundle1.agentPda, bundle2.agentPda);
    assert.equal(bundle1.memoryVaultPda, bundle2.memoryVaultPda);
    assert.equal(bundle1.subAgentDelegatePda, bundle2.subAgentDelegatePda);
    assert.equal(bundle1.registeredTools.length, 6);
    assert.equal(bundle1.usdcMainnetAccepted, true);
    assert.ok(bundle1.minAgentStakeSol > 0);
  });

  it("enforces per-tx caps, rolling 24h spend caps, conviction floors, and anti-replay receipts", () => {
    const engine = new CapitalMandateEngine(
      createDefaultMandate(DEFAULT_TREASURY_WALLET, {
        maxSingleTxUsd: 200,
        maxDailySpendUsd: 350,
        minConvictionScore: 80,
      })
    );
    const recipient = Keypair.generate().publicKey.toBase58();
    const usdcMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

    // Valid execution #1 ($180)
    const eval1 = engine.evaluate(
      {
        intentId: "intent-1",
        protocol: "jupiter",
        actorWallet: DEFAULT_TREASURY_WALLET,
        recipientWallet: recipient,
        tokenMint: usdcMint,
        amountUsd: 180,
        slippageBps: 50,
        convictionScore: 95,
        poolLiquidityUsd: 500_000,
        timestampUnix: 1_794_940_000,
      },
      true
    );
    assert.equal(eval1.allowed, true);
    assert.equal(eval1.remainingDailyBudgetUsd, 170);

    // Exact replay of intent-1 must be blocked
    const replayEval = engine.evaluate(
      {
        intentId: "intent-1",
        protocol: "jupiter",
        actorWallet: DEFAULT_TREASURY_WALLET,
        recipientWallet: recipient,
        tokenMint: usdcMint,
        amountUsd: 180,
        timestampUnix: 1_794_940_010,
      },
      false
    );
    assert.equal(replayEval.allowed, false);
    assert.ok(replayEval.reasons.includes("REPLAY_SERVICE_HASH_DETECTED"));

    // Exceeding rolling 24h cap ($180 + $190 = $370 > $350)
    const overDaily = engine.evaluate(
      {
        intentId: "intent-2",
        protocol: "jupiter",
        actorWallet: DEFAULT_TREASURY_WALLET,
        recipientWallet: recipient,
        tokenMint: usdcMint,
        amountUsd: 190,
        convictionScore: 95,
        poolLiquidityUsd: 500_000,
        timestampUnix: 1_794_940_100,
      },
      true
    );
    assert.equal(overDaily.allowed, false);
    assert.ok(overDaily.reasons.some((r) => r.startsWith("DAILY_SPEND_CAP_EXCEEDED")));

    // SAP v0.10.0 anti-replay settlement receipt PDA derivation
    const receipt = deriveSapAntiReplayReceipt(
      DEFAULT_TREASURY_WALLET,
      recipient,
      eval1.serviceHashBytes
    );
    assert.ok(new PublicKey(receipt.escrowPda));
    assert.ok(new PublicKey(receipt.settlementReceiptPda));

    // Defensive math guards: NaN/Infinity/negative inputs must fail closed without throwing RangeError
    const nanEval = engine.evaluate({
      intentId: "intent-nan",
      protocol: "jupiter",
      actorWallet: DEFAULT_TREASURY_WALLET,
      recipientWallet: recipient,
      tokenMint: usdcMint,
      amountUsd: Number.NaN,
      slippageBps: Number.NaN,
      convictionScore: Number.POSITIVE_INFINITY,
      timestampUnix: Number.NaN,
    });
    assert.equal(nanEval.allowed, false);
    assert.ok(nanEval.reasons.includes("NON_FINITE_AMOUNT_USD"));
    assert.ok(nanEval.reasons.includes("INVALID_TIMESTAMP_UNIX"));
    assert.ok(nanEval.reasons.some((r) => r.startsWith("INVALID_SLIPPAGE_BPS")));

    // Exact micro-USD rolling spend precision (0.1 + 0.2 === 0.3 exact cap)
    const precisionEngine = new CapitalMandateEngine(
      createDefaultMandate(DEFAULT_TREASURY_WALLET, {
        maxSingleTxUsd: 1,
        maxDailySpendUsd: 0.3,
        minConvictionScore: 50,
      })
    );
    const p1 = precisionEngine.evaluate(
      {
        intentId: "p-1",
        protocol: "jupiter",
        actorWallet: DEFAULT_TREASURY_WALLET,
        recipientWallet: recipient,
        tokenMint: usdcMint,
        amountUsd: 0.1,
        convictionScore: 90,
        poolLiquidityUsd: 50_000,
        timestampUnix: 1_794_940_000,
      },
      true
    );
    const p2 = precisionEngine.evaluate(
      {
        intentId: "p-2",
        protocol: "jupiter",
        actorWallet: DEFAULT_TREASURY_WALLET,
        recipientWallet: recipient,
        tokenMint: usdcMint,
        amountUsd: 0.2,
        convictionScore: 90,
        poolLiquidityUsd: 50_000,
        timestampUnix: 1_794_940_005,
      },
      true
    );
    assert.equal(p1.allowed, true);
    assert.equal(p2.allowed, true);
    assert.equal(p2.remainingDailyBudgetUsd, 0);
  });

  it("enforces anti-circular transfer rules, sub-agent delegation bounds, and Ed25519 attestations", () => {
    const rootSigner = Keypair.generate();
    const subAgent = Keypair.generate();
    const outsider = Keypair.generate();
    const bundle = deriveSapAgentBundle(rootSigner.publicKey.toBase58(), {
      subAgentDelegateWallet: subAgent.publicKey.toBase58(),
    });

    const engine = new CapitalMandateEngine(
      createDefaultMandate(rootSigner.publicKey.toBase58(), {
        maxSingleTxUsd: 500,
        maxDailySpendUsd: 1000,
      })
    );

    engine.registerSubAgentDelegate({
      delegateWallet: subAgent.publicKey.toBase58(),
      vaultPda: bundle.memoryVaultPda,
      maxDelegatedUsd: 120,
      allowedProtocols: ["multihopper"],
      issuedAtUnix: 1_794_940_000,
      expiresAtUnix: 1_794_943_600,
    });

    // Self-transfer blocked by anti-circular competition rule
    const circular = engine.evaluate({
      intentId: "self-loop",
      protocol: "multihopper",
      actorWallet: rootSigner.publicKey.toBase58(),
      recipientWallet: rootSigner.publicKey.toBase58(),
      tokenMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      amountUsd: 50,
    });
    assert.equal(circular.allowed, false);
    assert.ok(circular.reasons.includes("ANTI_CIRCULAR_SELF_TRANSFER_BLOCKED"));

    // Authorized sub-agent within $120 limit & valid window succeeds
    const subOk = engine.evaluate({
      intentId: "sub-route-1",
      protocol: "multihopper",
      actorWallet: subAgent.publicKey.toBase58(),
      recipientWallet: outsider.publicKey.toBase58(),
      tokenMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      amountUsd: 100,
      timestampUnix: 1_794_941_000,
    });
    assert.equal(subOk.allowed, true);

    // Ed25519 cryptographic attestation sign + verify
    const att = engine.signMandateAttestation(subOk, rootSigner);
    assert.equal(
      CapitalMandateEngine.verifyMandateAttestation(subOk, att.signerPubkey, att.signatureBase58),
      true
    );
    assert.equal(
      CapitalMandateEngine.verifyMandateAttestation(
        subOk,
        outsider.publicKey.toBase58(),
        att.signatureBase58
      ),
      false
    );

    // Build & sign SAP VersionedTransaction anchor
    const anchorTx = buildSapMandateAnchorTx({
      payer: rootSigner.publicKey,
      recipientVaultOrTreasury: outsider.publicKey,
      lamports: 50_000,
      mandateId: subOk.mandateId,
      serviceHashHex: subOk.serviceHashHex,
      recentBlockhash: "11111111111111111111111111111111",
      signer: rootSigner,
    });
    assert.equal(anchorTx.isSigned, true);
    assert.equal(anchorTx.instructionCount, 2);
    const decoded = VersionedTransaction.deserialize(
      Buffer.from(anchorTx.transactionBase64, "base64")
    );
    assert.equal(decoded.signatures.length, 1);
    assert.ok(decoded.signatures[0].some((b) => b !== 0));
  });
});
