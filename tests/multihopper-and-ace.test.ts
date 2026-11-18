import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  Keypair,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  calculateRouteEconomics,
  MultiHopperClient,
  signPreparedTxBundle,
  validateMultiHopperRequest,
} from "../src/multihopper.js";
import { evaluate10LayerShield } from "../src/shield-and-rent.js";
import { synthesizeStrategyConvictionBrief } from "../src/ace-conviction.js";

describe("MultiHopper Programmable Routing SDK & Ace Data Cloud Conviction", () => {
  it("enforces MH_018 custom route validation rules for single and multi-destination payouts", () => {
    const sender = Keypair.generate().publicKey.toBase58();
    const dest1 = Keypair.generate().publicKey.toBase58();
    const dest2 = Keypair.generate().publicKey.toBase58();
    const finalHopWallet = Keypair.generate().publicKey.toBase58();
    const usdc = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

    // Valid 3-hop multi-destination route ending on explicit wallet hop
    const validMulti = validateMultiHopperRequest({
      tokenMint: usdc,
      amountRaw: "100000000",
      amountTokens: "100.0",
      sourceOwner: sender,
      destinations: [
        { wallet: dest1, amountRaw: "60000000" },
        { wallet: dest2, amountRaw: "40000000" },
      ],
      route: {
        hops: [
          { bundle: "cex", waitSeconds: 60 },
          { bundle: "dex", waitSeconds: 120 },
          { wallet: finalHopWallet, waitSeconds: 90 },
        ],
      },
    });
    assert.equal(validMulti.valid, true);
    assert.equal(validMulti.hopCount, 3);
    assert.equal(validMulti.destinationCount, 2);

    // Invalid multi-destination ending on bundle hop + mismatched share sum
    const invalidMulti = validateMultiHopperRequest({
      tokenMint: usdc,
      amountRaw: "100000000",
      amountTokens: "100.0",
      sourceOwner: sender,
      destinations: [
        { wallet: dest1, amountRaw: "50000000" },
        { wallet: dest2, amountRaw: "40000000" },
      ],
      route: {
        hops: [
          { bundle: "cex", waitSeconds: 10 }, // < 20s minimum
          { bundle: "kol", waitSeconds: 60 },
          { bundle: "mix", waitSeconds: 60 }, // forbidden last bundle hop on multi-dest
        ],
      },
    });
    assert.equal(invalidMulti.valid, false);
    assert.ok(
      invalidMulti.errors.some((e) => e.startsWith("MH_DESTINATION_SHARES_SUM_MISMATCH"))
    );
    assert.ok(
      invalidMulti.errors.includes("MH_018_MULTI_DESTINATION_LAST_HOP_MUST_BE_EXPLICIT_WALLET")
    );
    assert.ok(invalidMulti.errors.some((e) => e.startsWith("MH_018_HOP_WAIT_OUT_OF_BOUNDS")));
  });

  it("computes exact 50 bps fee, 25 bps partner rev-share, and signs PreparedTxBundle in order", async () => {
    const econ = calculateRouteEconomics({
      principalUsd: 100_000,
      hopCount: 3,
      destinationCount: 2,
    });
    assert.equal(econ.totalProtocolFeeUsd, 500);
    assert.equal(econ.partnerRevenueShareUsd, 250);
    assert.equal(econ.competitionPoolContributionUsd, 250);
    assert.equal(econ.qualifyingCompetitionVolumeUsd, 100_000);
    assert.equal(econ.estimatedHopAtaRentSol, 0.0095); // (3 hops + 2 dispersion steps) * 0.0019 SOL

    const signer = Keypair.generate();
    const hopVault = Keypair.generate().publicKey;
    const makeUnsignedB64 = (lamports: number): string => {
      const msg = new TransactionMessage({
        payerKey: signer.publicKey,
        recentBlockhash: "11111111111111111111111111111111",
        instructions: [
          SystemProgram.transfer({
            fromPubkey: signer.publicKey,
            toPubkey: hopVault,
            lamports,
          }),
        ],
      }).compileToV0Message();
      return Buffer.from(new VersionedTransaction(msg).serialize()).toString("base64");
    };

    const prepared = {
      routeInitTxs: [makeUnsignedB64(1_900_000), makeUnsignedB64(1_900_000)],
      dispersionInitTxs: [makeUnsignedB64(3_800_000)],
      recentBlockhash: "11111111111111111111111111111111",
      lastValidBlockHeight: 310_000_000,
    };

    const signed = signPreparedTxBundle(prepared, signer);
    assert.equal(signed.routeInitSignedCount, 2);
    assert.equal(signed.dispersionInitSignedCount, 1);
    assert.equal(signed.signedOrderedTxsBase64.length, 3);

    // Test MultiHopperClient REST lifecycle with deterministic mock fetch
    const calls: string[] = [];
    const client = new MultiHopperClient({
      apiKey: "mh_test_demo123",
      fetchImpl: (async (url: string | URL | Request) => {
        const u = String(url);
        calls.push(u);
        return new Response(JSON.stringify({ id: 42, status: "quoted", url: u }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }) as typeof fetch,
    });

    const created = await client.createTransfer({
      tokenMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      amountRaw: "25000000",
      amountTokens: "25.0",
      sourceOwner: signer.publicKey.toBase58(),
      recipientWallet: hopVault.toBase58(),
      hops: 3,
    });
    assert.equal(created.id, 42);
    assert.ok(calls[0].startsWith("https://devnet.multihopper.com/api/v1/transfers"));
  });

  it("synthesizes Ace Data Cloud MCP + 10-Layer Shield conviction briefs", async () => {
    const usdc = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    const shield = evaluate10LayerShield(usdc, {
      programOwner: TOKEN_PROGRAM_ID.toBase58(),
      decimals: 6,
      supplyUi: 5_000_000_000,
      mintAuthority: null,
      freezeAuthority: null,
      top10HolderPct: 12,
      poolLiquidityUsd: 250_000_000,
      volume24hUsd: 500_000_000,
      buys24h: 10000,
      sells24h: 9800,
    });

    const brief = await synthesizeStrategyConvictionBrief({
      mint: usdc,
      symbol: "USDC",
      shieldReport: shield,
      aceApiKey: "ace_paid_key_demo",
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            organic: [
              {
                title: "Circle Native USDC on Solana",
                link: "https://www.circle.com/usdc",
                snippet: "100% reserve-backed institutional settlement asset.",
              },
              {
                title: "Solana DeFi Liquidity Report",
                link: "https://solana.com",
                snippet: "Deepest stablecoin orderbooks across Jupiter, Orca, and Kamino.",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )) as typeof fetch,
    });

    assert.equal(brief.aceMcpConnected, true);
    assert.equal(brief.riskRegime, "CORE_ALLOCATION");
    assert.equal(brief.recommendedAllocationBps, 2500);
    assert.equal(brief.briefSha256.length, 64);
  });
});
