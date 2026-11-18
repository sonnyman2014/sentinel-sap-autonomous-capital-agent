#!/usr/bin/env node
import { DEFAULT_TREASURY_WALLET } from "./mandate.js";
import { deriveSapAgentBundle, inspectSapMainnetState } from "./sap-agent.js";
import { auditTokenMintLive, scanMainnetEmptyAtas } from "./shield-and-rent.js";
import { runMcpStdioLoop } from "./mcp-server.js";
import { createSentinelHttpServer } from "./http-server.js";

async function main(): Promise<void> {
  const [cmd = "help", arg1] = process.argv.slice(2);

  if (cmd === "mcp-stdio") {
    runMcpStdioLoop();
    return;
  }

  if (cmd === "serve") {
    const port = Number(arg1 ?? process.env.PORT ?? 8788);
    const server = createSentinelHttpServer();
    server.listen(port, "127.0.0.1", () => {
      process.stdout.write(
        `Sentinel-SAP HTTP Server (Solana Actions v2.2.1 + MCP + x402) online at http://127.0.0.1:${port}\n`
      );
    });
    return;
  }

  if (cmd === "sap-identity") {
    const wallet = arg1 ?? DEFAULT_TREASURY_WALLET;
    const bundle = deriveSapAgentBundle(wallet);
    const live = await inspectSapMainnetState(wallet);
    process.stdout.write(JSON.stringify({ bundle, live }, null, 2) + "\n");
    return;
  }

  if (cmd === "audit-mint") {
    const mint = arg1 ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    const report = await auditTokenMintLive(mint);
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    return;
  }

  if (cmd === "scan-rent") {
    const wallet = arg1 ?? DEFAULT_TREASURY_WALLET;
    const plan = await scanMainnetEmptyAtas(wallet);
    process.stdout.write(JSON.stringify(plan, null, 2) + "\n");
    return;
  }

  process.stdout.write(
    [
      "Sentinel-SAP CLI (@sentinel-sap/autonomous-capital-agent)",
      "Commands:",
      "  sap-identity [wallet]   Derive OOBE SAP v2 PDAs & inspect Solana mainnet state",
      "  audit-mint [mint]       Run 10-Layer SPL/Token-2022 pre-trade risk audit",
      "  scan-rent [wallet]      Scan mainnet empty ATAs & build CloseAccount VersionedTx",
      "  mcp-stdio               Launch JSON-RPC 2.0 MCP server over stdio",
      "  serve [port]            Launch Solana Actions v2.2.1 Blink + HTTP MCP server",
    ].join("\n") + "\n"
  );
}

main().catch((err) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
