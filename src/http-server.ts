import http from "node:http";
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { DEFAULT_TREASURY_WALLET } from "./mandate.js";
import {
  buildSapMandateAnchorTx,
  deriveSapAgentBundle,
  PUBLIC_SOLANA_MAINNET_RPC,
} from "./sap-agent.js";
import { scanMainnetEmptyAtas } from "./shield-and-rent.js";
import {
  JsonRpcRequest,
  SentinelSapMcpServer,
  SOLANA_MAINNET_CAIP2,
} from "./mcp-server.js";

export const ACTION_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, Content-Encoding, Accept-Encoding, X-Action-Version, X-Blockchain-Ids, X-Payment-Signature",
  "Access-Control-Expose-Headers": "X-Action-Version, X-Blockchain-Ids",
  "X-Action-Version": "2.2.1",
  "X-Blockchain-Ids": SOLANA_MAINNET_CAIP2,
  "Content-Type": "application/json; charset=utf-8",
};

export interface SentinelHttpServerOptions {
  treasuryWallet?: string;
  rpcUrl?: string;
  mcpServer?: SentinelSapMcpServer;
  blockhashProvider?: () => Promise<string>;
}

export function createSentinelHttpServer(options: SentinelHttpServerOptions = {}): http.Server {
  const treasuryWallet = options.treasuryWallet ?? DEFAULT_TREASURY_WALLET;
  const rpcUrl = options.rpcUrl ?? PUBLIC_SOLANA_MAINNET_RPC;
  const mcpServer =
    options.mcpServer ??
    new SentinelSapMcpServer({
      treasuryWallet,
      rpcUrl,
      freeCallsLimit: 2,
    });
  const getBlockhash =
    options.blockhashProvider ??
    (async () => {
      const conn = new Connection(rpcUrl, "confirmed");
      const bh = await conn.getLatestBlockhash("confirmed");
      return bh.blockhash;
    });

  return http.createServer(async (req, res) => {
    const host = req.headers.host ?? "127.0.0.1:8788";
    const baseUrl = `http://${host}`;
    const url = new URL(req.url ?? "/", baseUrl);

    if (req.method === "OPTIONS") {
      res.writeHead(200, ACTION_CORS_HEADERS);
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, ACTION_CORS_HEADERS);
      res.end(
        JSON.stringify({
          status: "ok",
          agent: "Sentinel-SAP Autonomous Capital Agent",
          treasuryWallet,
          actionVersion: "2.2.1",
        })
      );
      return;
    }

    if (
      req.method === "GET" &&
      (url.pathname === "/.well-known/mcp/server-card.json" || url.pathname === "/mcp")
    ) {
      res.writeHead(200, ACTION_CORS_HEADERS);
      res.end(JSON.stringify(mcpServer.getServerCard(baseUrl), null, 2));
      return;
    }

    if (req.method === "GET" && url.pathname === "/actions.json") {
      res.writeHead(200, ACTION_CORS_HEADERS);
      res.end(
        JSON.stringify({
          rules: [
            {
              pathPattern: "/capital-agent/**",
              apiPath: "/api/actions/capital-agent/**",
            },
            {
              pathPattern: "/api/actions/**",
              apiPath: "/api/actions/**",
            },
          ],
        })
      );
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/actions/capital-agent") {
      const sapBundle = deriveSapAgentBundle(treasuryWallet);
      res.writeHead(200, ACTION_CORS_HEADERS);
      res.end(
        JSON.stringify({
          type: "action",
          icon: "https://earn.superteam.fun/favicon.ico",
          title: "Sentinel-SAP :: Autonomous Capital & Treasury Routing Agent",
          description:
            `OOBE Protocol SAP v2 (${sapBundle.programId.slice(0, 8)}...) + MultiHopper Programmable Routing + 11-Layer Pre-Trade Shield + Empty-ATA Rent Compounding.`,
          label: "Anchor Capital Mandate",
          links: {
            actions: [
              {
                type: "transaction",
                label: "Fund Agent Vault & Anchor SAP Mandate",
                href: `${baseUrl}/api/actions/capital-agent?mode=vault-deposit&sol={sol}`,
                parameters: [
                  {
                    name: "sol",
                    label: "SOL deposit amount (e.g. 0.15)",
                    required: true,
                  },
                ],
              },
              {
                type: "transaction",
                label: "Sweep & Compound Empty Token ATAs",
                href: `${baseUrl}/api/actions/capital-agent?mode=ata-rent-sweep`,
              },
            ],
          },
        })
      );
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/actions/capital-agent") {
      try {
        const rawBody = await readRequestBody(req);
        const parsed = JSON.parse(rawBody || "{}") as { account?: string };
        if (!parsed.account) {
          res.writeHead(400, ACTION_CORS_HEADERS);
          res.end(JSON.stringify({ message: "Missing required `account` public key in Blink POST body" }));
          return;
        }
        const callerPk = new PublicKey(parsed.account);
        const mode = url.searchParams.get("mode") ?? "vault-deposit";

        if (mode === "ata-rent-sweep") {
          const plan = await scanMainnetEmptyAtas(callerPk.toBase58(), {
            rpcUrl,
            treasuryWallet,
          });
          if (!plan.transactionBase64) {
            const recentBlockhash = await getBlockhash();
            const fallbackAnchor = buildSapMandateAnchorTx({
              payer: callerPk,
              recipientVaultOrTreasury: new PublicKey(treasuryWallet),
              lamports: 0,
              mandateId: "ata-sweep-zero-empty",
              serviceHashHex: "0".repeat(64),
              recentBlockhash,
            });
            res.writeHead(200, ACTION_CORS_HEADERS);
            res.end(
              JSON.stringify({
                type: "transaction",
                transaction: fallbackAnchor.transactionBase64,
                message: `0 empty non-frozen ATAs found (${plan.skippedFrozenAtas.length} frozen ATAs safely skipped). Anchoring zero-cost SAP proof memo.`,
              })
            );
            return;
          }
          res.writeHead(200, ACTION_CORS_HEADERS);
          res.end(
            JSON.stringify({
              type: "transaction",
              transaction: plan.transactionBase64,
              message: `Reclaiming ${plan.reclaimableCount} empty ATAs (+${plan.netOwnerSol} net SOL compounded).`,
            })
          );
          return;
        }

        const solParam = Number(url.searchParams.get("sol") ?? "0.05");
        if (!Number.isFinite(solParam) || solParam < 0 || solParam > 100) {
          res.writeHead(400, ACTION_CORS_HEADERS);
          res.end(JSON.stringify({ message: "SOL parameter must be between 0 and 100 SOL" }));
          return;
        }
        const lamports = Math.round(solParam * LAMPORTS_PER_SOL);
        const recentBlockhash = await getBlockhash();
        const built = buildSapMandateAnchorTx({
          payer: callerPk,
          recipientVaultOrTreasury: new PublicKey(treasuryWallet),
          lamports,
          mandateId: "mandate-sentinel-sap-v1",
          serviceHashHex: Buffer.from(callerPk.toBytes()).toString("hex"),
          recentBlockhash,
        });

        res.writeHead(200, ACTION_CORS_HEADERS);
        res.end(
          JSON.stringify({
            type: "transaction",
            transaction: built.transactionBase64,
            message: `Prepared OOBE SAP v2 Capital Mandate + ${solParam} SOL vault funding transaction.`,
          })
        );
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.writeHead(400, ACTION_CORS_HEADERS);
        res.end(JSON.stringify({ message: msg }));
        return;
      }
    }

    if (req.method === "POST" && url.pathname === "/mcp") {
      try {
        const rawBody = await readRequestBody(req);
        const rpcReq = JSON.parse(rawBody) as JsonRpcRequest;
        const xff = String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "anon")
          .split(",")[0]
          .trim();
        const paySig = req.headers["x-payment-signature"]
          ? String(req.headers["x-payment-signature"])
          : undefined;
        const outcome = await mcpServer.dispatch(rpcReq, xff, paySig);
        res.writeHead(outcome.httpStatus, {
          ...ACTION_CORS_HEADERS,
          ...outcome.headers,
        });
        res.end(outcome.body ? JSON.stringify(outcome.body) : "");
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.writeHead(400, ACTION_CORS_HEADERS);
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            id: null,
            error: { code: -32700, message: msg },
          })
        );
        return;
      }
    }

    res.writeHead(404, ACTION_CORS_HEADERS);
    res.end(JSON.stringify({ error: "Not Found" }));
  });
}

function readRequestBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 8788);
  const srv = createSentinelHttpServer();
  srv.listen(port, "127.0.0.1", () => {
    process.stdout.write(
      `[Sentinel-SAP] Blink v2.2.1 + Streamable MCP listening on http://127.0.0.1:${port}\n`
    );
  });
}
