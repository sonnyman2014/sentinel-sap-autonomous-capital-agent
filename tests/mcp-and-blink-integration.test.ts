import assert from "node:assert/strict";
import { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { Keypair, VersionedTransaction } from "@solana/web3.js";
import { DEFAULT_TREASURY_WALLET } from "../src/mandate.js";
import { inspectSapMainnetState } from "../src/sap-agent.js";
import { auditTokenMintLive } from "../src/shield-and-rent.js";
import { MultiHopperClient } from "../src/multihopper.js";
import { SentinelSapMcpServer } from "../src/mcp-server.js";
import { createSentinelHttpServer } from "../src/http-server.js";

describe("MCP JSON-RPC + x402 Gate + Solana Actions v2.2.1 Blink + Live Mainnet RPC", () => {
  let baseUrl = "";
  const validPaidSigs = new Set(["5PaidSolanaTxSigProof111111111111111111111111111"]);
  const mcpServer = new SentinelSapMcpServer({
    treasuryWallet: DEFAULT_TREASURY_WALLET,
    freeCallsLimit: 2,
    verifyPaymentSignature: async (sig: string) => validPaidSigs.has(sig),
  });
  const httpServer = createSentinelHttpServer({
    treasuryWallet: DEFAULT_TREASURY_WALLET,
    mcpServer,
    blockhashProvider: async () => "11111111111111111111111111111111",
  });

  before(async () => {
    await new Promise<void>((resolve) => {
      httpServer.listen(0, "127.0.0.1", () => {
        const addr = httpServer.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it("serves Solana Actions v2.2.1 Blink headers, GET metadata, and POST VersionedTransaction", async () => {
    const optRes = await fetch(`${baseUrl}/api/actions/capital-agent`, { method: "OPTIONS" });
    assert.equal(optRes.status, 200);
    assert.equal(optRes.headers.get("access-control-allow-origin"), "*");
    assert.equal(optRes.headers.get("x-action-version"), "2.2.1");
    assert.equal(
      optRes.headers.get("x-blockchain-ids"),
      "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
    );

    const getRes = await fetch(`${baseUrl}/api/actions/capital-agent`);
    assert.equal(getRes.status, 200);
    const meta = (await getRes.json()) as {
      title: string;
      links: { actions: Array<{ href: string }> };
    };
    assert.ok(meta.title.includes("Sentinel-SAP"));
    assert.equal(meta.links.actions.length, 2);

    const caller = Keypair.generate().publicKey.toBase58();
    const postRes = await fetch(
      `${baseUrl}/api/actions/capital-agent?mode=vault-deposit&sol=0.15`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: caller }),
      }
    );
    assert.equal(postRes.status, 200);
    const txPayload = (await postRes.json()) as { type: string; transaction: string };
    assert.equal(txPayload.type, "transaction");
    const vtx = VersionedTransaction.deserialize(Buffer.from(txPayload.transaction, "base64"));
    assert.equal(vtx.message.staticAccountKeys[0].toBase58(), caller);
  });

  it("enforces HTTP 402 on MCP tool call #3 while keeping discovery 100% open", async () => {
    const headers = {
      "Content-Type": "application/json",
      "X-Forwarded-For": "203.0.113.77",
    };

    // 1. initialize -> 200
    const initRes = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
    });
    assert.equal(initRes.status, 200);

    // 2. tools/list -> 200 (7 tools)
    const listRes1 = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    });
    assert.equal(listRes1.status, 200);
    const listBody1 = (await listRes1.json()) as { result: { tools: unknown[] } };
    assert.equal(listBody1.result.tools.length, 7);

    const callBody = JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "sap_derive_agent_identity",
        arguments: { ownerWallet: DEFAULT_TREASURY_WALLET },
      },
    });

    // 3. tools/call #1 -> 200
    const c1 = await fetch(`${baseUrl}/mcp`, { method: "POST", headers, body: callBody });
    assert.equal(c1.status, 200);

    // 4. tools/call #2 -> 200
    const c2 = await fetch(`${baseUrl}/mcp`, { method: "POST", headers, body: callBody });
    assert.equal(c2.status, 200);

    // 5. tools/call #3 -> HTTP 402 Payment Required
    const c3 = await fetch(`${baseUrl}/mcp`, { method: "POST", headers, body: callBody });
    assert.equal(c3.status, 402);
    assert.equal(c3.headers.get("x-pay-to"), DEFAULT_TREASURY_WALLET);
    const err402 = await c3.text();
    assert.ok(err402.includes("0.0003"));
    assert.ok(err402.includes("0.026"));
    assert.ok(err402.includes(DEFAULT_TREASURY_WALLET));

    // 6. tools/list AFTER 402 -> STILL HTTP 200!
    const listRes2 = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 6, method: "tools/list" }),
    });
    assert.equal(listRes2.status, 200);

    // 7. tools/call with verified payment signature -> HTTP 200 unlocked, replay rejected with 402
    const paidCall = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        ...headers,
        "X-Payment-Signature": "5PaidSolanaTxSigProof111111111111111111111111111",
      },
      body: callBody,
    });
    assert.equal(paidCall.status, 200);

    const replayPaid = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        ...headers,
        "X-Payment-Signature": "5PaidSolanaTxSigProof111111111111111111111111111",
      },
      body: callBody,
    });
    assert.equal(replayPaid.status, 402);
  });

  it("verifies live Solana Mainnet-Beta SAP v2 state, USDC 11-Layer Audit, and MultiHopper MCP card", async () => {
    const [sapSnap, usdcAudit, mhCard] = await Promise.all([
      inspectSapMainnetState(DEFAULT_TREASURY_WALLET),
      auditTokenMintLive("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
      new MultiHopperClient().discoverServerCard(),
    ]);

    assert.ok(sapSnap.slot > 300_000_000);
    assert.equal(sapSnap.sapProgramExecutable, true);
    assert.equal(sapSnap.globalRegistryExists, true);
    assert.ok(sapSnap.agentWalletLamports > 0);

    assert.equal(usdcAudit.verdict, "SAFE");
    assert.ok(usdcAudit.convictionScore >= 95);

    assert.equal(mhCard.name, "MultiHopper");
    assert.ok(mhCard.tools.some((t) => t.name === "create_transfer"));
  });
});
