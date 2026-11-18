import readline from "node:readline";
import {
  CapitalMandateEngine,
  createDefaultMandate,
  DEFAULT_TREASURY_WALLET,
  ExecutionIntent,
} from "./mandate.js";
import {
  deriveSapAgentBundle,
  deriveSapAntiReplayReceipt,
  inspectSapMainnetState,
  PUBLIC_SOLANA_MAINNET_RPC,
} from "./sap-agent.js";
import {
  auditTokenMintLive,
  quoteGuardedJupiterSwap,
  scanMainnetEmptyAtas,
} from "./shield-and-rent.js";
import {
  calculateRouteEconomics,
  CustomRouteSpec,
  MultiDestinationShare,
  MultiHopperClient,
  validateMultiHopperRequest,
} from "./multihopper.js";
import { synthesizeStrategyConvictionBrief } from "./ace-conviction.js";

export const MCP_PROTOCOL_VERSION = "2024-11-05";
export const SOLANA_MAINNET_CAIP2 = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface McpDispatchOutcome {
  httpStatus: number;
  headers: Record<string, string>;
  body: JsonRpcResponse | null;
}

export const SENTINEL_MCP_TOOLS = [
  {
    name: "sap_derive_agent_identity",
    description:
      "Derive deterministic OOBE Protocol SAP v2 on-chain PDAs (AgentAccount, MemoryVault, AgentStats, PricingMenu, Stake, Tool & Protocol Indexes) and optionally query live Solana mainnet state.",
    inputSchema: {
      type: "object",
      properties: {
        ownerWallet: {
          type: "string",
          description: "Solana base58 wallet address owning the SAP v2 autonomous agent.",
        },
        subAgentDelegateWallet: {
          type: "string",
          description: "Optional specialist sub-agent wallet granted VaultDelegate permissions.",
        },
        includeLiveMainnetState: {
          type: "boolean",
          description: "Query live Solana mainnet-beta RPC for SAP program, GlobalRegistry, and wallet balances.",
        },
      },
      required: ["ownerWallet"],
    },
  },
  {
    name: "shield_audit_token_mint",
    description:
      "Run a 10-Layer SPL & Token-2022 Pre-Trade Risk Audit against Solana mainnet-beta + DEX telemetry (Mint/Freeze authority, PermanentDelegate/TransferFee traps, Top-10 concentration, liquidity, honeypot sell ratio).",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string", description: "Solana token mint address to audit." },
      },
      required: ["mint"],
    },
  },
  {
    name: "reclaim_empty_atas_tx",
    description:
      "Scan live SPL Token and Token-2022 accounts for zero-balance ATAs (auto-skipping frozen accounts and withheld-fee traps) and build a non-custodial base64 VersionedTransaction to compound rent SOL.",
    inputSchema: {
      type: "object",
      properties: {
        ownerWallet: { type: "string", description: "Wallet public key to scan for empty ATAs." },
        treasuryWallet: { type: "string", description: "Optional fee recipient wallet." },
      },
      required: ["ownerWallet"],
    },
  },
  {
    name: "mandate_evaluate_execution",
    description:
      "Evaluate a proposed trade, MultiHopper route, or sub-agent action against programmable Steve Capital guardrails (per-tx cap, 24h rolling budget, min conviction, anti-circular transfer check, SAP anti-replay receipt).",
    inputSchema: {
      type: "object",
      properties: {
        intentId: { type: "string" },
        protocol: { type: "string" },
        actorWallet: { type: "string" },
        recipientWallet: { type: "string" },
        destinationWallets: { type: "array", items: { type: "string" } },
        tokenMint: { type: "string" },
        amountUsd: { type: "number" },
        slippageBps: { type: "number" },
        convictionScore: { type: "number" },
        poolLiquidityUsd: { type: "number" },
      },
      required: ["intentId", "protocol", "actorWallet", "tokenMint", "amountUsd"],
    },
  },
  {
    name: "multihopper_plan_and_quote",
    description:
      "Validate a programmable MultiHopper route (2-10 hops, wallet/bundle hops, up to 20 multi-send destinations) against MH_018 rules and compute exact fee, 25 bps partner rev-share, and hop ATA rent economics.",
    inputSchema: {
      type: "object",
      properties: {
        tokenMint: { type: "string" },
        amountRaw: { type: "string" },
        amountTokens: { type: "string" },
        principalUsd: { type: "number" },
        sourceOwner: { type: "string" },
        recipientWallet: { type: "string" },
        destinations: { type: "array" },
        hops: { type: "number" },
        route: { type: "object" },
      },
      required: ["tokenMint", "amountRaw", "amountTokens", "principalUsd", "sourceOwner"],
    },
  },
  {
    name: "jupiter_build_guarded_swap",
    description:
      "Audit target mint with 10-Layer Shield, verify Capital Mandate guardrails, and fetch a live slippage-bounded Jupiter v6 swap quote on Solana mainnet.",
    inputSchema: {
      type: "object",
      properties: {
        intentId: { type: "string" },
        actorWallet: { type: "string" },
        inputMint: { type: "string" },
        outputMint: { type: "string" },
        inAmountRaw: { type: "string" },
        amountUsd: { type: "number" },
        slippageBps: { type: "number" },
      },
      required: ["intentId", "actorWallet", "inputMint", "outputMint", "inAmountRaw", "amountUsd"],
    },
  },
  {
    name: "ace_research_conviction_brief",
    description:
      "Synthesize an auditable Steve Capital strategy conviction brief combining 10-Layer Solana on-chain risk scoring with Ace Data Cloud MCP research signals.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string" },
        symbol: { type: "string" },
      },
      required: ["mint", "symbol"],
    },
  },
] as const;

export interface SentinelMcpOptions {
  treasuryWallet?: string;
  rpcUrl?: string;
  freeCallsLimit?: number;
  mandateEngine?: CapitalMandateEngine;
  verifyPaymentSignature?: (sig: string) => Promise<boolean>;
  fetchImpl?: typeof fetch;
}

export class SentinelSapMcpServer {
  private readonly treasuryWallet: string;
  private readonly rpcUrl: string;
  private readonly freeCallsLimit: number;
  private readonly mandateEngine: CapitalMandateEngine;
  private readonly usageByClient = new Map<string, number>();
  private readonly consumedPaymentSigs = new Set<string>();
  private readonly verifyPaymentSignature?: (sig: string) => Promise<boolean>;
  private readonly fetchImpl?: typeof fetch;

  constructor(options: SentinelMcpOptions = {}) {
    this.treasuryWallet = options.treasuryWallet ?? DEFAULT_TREASURY_WALLET;
    this.rpcUrl = options.rpcUrl ?? PUBLIC_SOLANA_MAINNET_RPC;
    this.freeCallsLimit = options.freeCallsLimit ?? Number.POSITIVE_INFINITY;
    this.mandateEngine =
      options.mandateEngine ?? createDefaultMandateEngineInstance(this.treasuryWallet);
    this.verifyPaymentSignature = options.verifyPaymentSignature;
    this.fetchImpl = options.fetchImpl;
  }

  getServerCard(publicBaseUrl: string = "http://127.0.0.1:8788"): Record<string, unknown> {
    return {
      schema_version: "1.0",
      name: "Sentinel-SAP Autonomous Capital Agent",
      version: "1.0.0",
      description:
        "Autonomous Solana Capital & Treasury Routing Agent powered by OOBE Protocol SAP v2, MultiHopper Programmable Routing, 10-Layer Pre-Trade Shield, Empty-ATA Rent Compounding, and x402 Guardrails.",
      transport: {
        type: "streamable-http",
        url: `${publicBaseUrl}/mcp`,
      },
      x402: {
        network: SOLANA_MAINNET_CAIP2,
        payTo: this.treasuryWallet,
        freeDiscoveryCalls: Number.isFinite(this.freeCallsLimit) ? this.freeCallsLimit : "unlimited",
        perCallSol: "0.0003",
        proPassSol: "0.026",
      },
      tools: SENTINEL_MCP_TOOLS.map((t) => ({ name: t.name, description: t.description })),
    };
  }

  async dispatch(
    req: JsonRpcRequest,
    clientKey: string = "stdio-local",
    paymentSignature?: string
  ): Promise<McpDispatchOutcome> {
    const id = req.id ?? null;

    if (req.method === "notifications/initialized") {
      return { httpStatus: 200, headers: {}, body: null };
    }

    // Discovery & handshake methods are ALWAYS 100% open (HTTP 200) and never consume quota
    if (req.method === "initialize") {
      return {
        httpStatus: 200,
        headers: {},
        body: {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: {
              tools: { listChanged: false },
              resources: { subscribe: false, listChanged: false },
              prompts: { listChanged: false },
            },
            serverInfo: {
              name: "sentinel-sap-capital-agent",
              version: "1.0.0",
            },
          },
        },
      };
    }

    if (req.method === "ping") {
      return {
        httpStatus: 200,
        headers: {},
        body: { jsonrpc: "2.0", id, result: {} },
      };
    }

    if (req.method === "tools/list") {
      return {
        httpStatus: 200,
        headers: {},
        body: {
          jsonrpc: "2.0",
          id,
          result: { tools: SENTINEL_MCP_TOOLS },
        },
      };
    }

    if (req.method === "resources/list") {
      return {
        httpStatus: 200,
        headers: {},
        body: {
          jsonrpc: "2.0",
          id,
          result: {
            resources: [
              {
                uri: "sap://mandate/active",
                name: "Active Steve Capital Execution Mandate",
                mimeType: "application/json",
              },
              {
                uri: MULTIHOPPER_RESOURCE_URI,
                name: "MultiHopper Upstream MCP Server Card",
                mimeType: "application/json",
              },
            ],
          },
        },
      };
    }

    if (req.method === "prompts/list") {
      return {
        httpStatus: 200,
        headers: {},
        body: {
          jsonrpc: "2.0",
          id,
          result: {
            prompts: [
              {
                name: "autonomous-treasury-rebalance",
                description:
                  "Audit target Solana asset, enforce SAP mandate, sweep idle ATA rent, and route payouts via MultiHopper.",
              },
            ],
          },
        },
      };
    }

    if (req.method !== "tools/call") {
      return {
        httpStatus: 200,
        headers: {},
        body: {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method not found: ${req.method}` },
        },
      };
    }

    // Enforce x402 payment gate on tools/call once free allowance is exhausted
    const used = this.usageByClient.get(clientKey) ?? 0;
    const paramSig =
      paymentSignature ??
      (typeof (req.params?.arguments as Record<string, unknown> | undefined)?.paymentSignature ===
      "string"
        ? String((req.params?.arguments as Record<string, unknown>).paymentSignature)
        : undefined);

    if (used >= this.freeCallsLimit) {
      let paidOk = false;
      if (paramSig && !this.consumedPaymentSigs.has(paramSig) && this.verifyPaymentSignature) {
        paidOk = await this.verifyPaymentSignature(paramSig);
        if (paidOk) {
          this.consumedPaymentSigs.add(paramSig);
        }
      }
      if (!paidOk) {
        const x402Meta = {
          x402Version: 1,
          scheme: "exact-solana-transfer",
          network: SOLANA_MAINNET_CAIP2,
          payTo: this.treasuryWallet,
          perCallSol: "0.0003",
          proPassSol: "0.026",
          freeCallsAllowed: this.freeCallsLimit,
          freeCallsUsed: used,
        };
        return {
          httpStatus: 402,
          headers: {
            "X-Payment-Required": "x402",
            "X-Pay-To": this.treasuryWallet,
            "X-Price-Per-Call-SOL": "0.0003",
            "X-Price-Pro-Pass-SOL": "0.026",
          },
          body: {
            jsonrpc: "2.0",
            id,
            error: {
              code: 402,
              message: `HTTP 402 Payment Required: Free sample quota (${this.freeCallsLimit} calls) exhausted. Pay 0.0003 SOL per call or 0.026 SOL Pro Pass to ${this.treasuryWallet}.`,
              data: x402Meta,
            },
          },
        };
      }
    } else {
      this.usageByClient.set(clientKey, used + 1);
    }

    try {
      const toolName = String(req.params?.name ?? "");
      const args = (req.params?.arguments as Record<string, unknown> | undefined) ?? {};
      const payload = await this.executeTool(toolName, args);
      return {
        httpStatus: 200,
        headers: {},
        body: {
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
            structuredContent: payload,
            isError: false,
          },
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        httpStatus: 200,
        headers: {},
        body: {
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify({ error: message }) }],
            isError: true,
          },
        },
      };
    }
  }

  private async executeTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    switch (toolName) {
      case "sap_derive_agent_identity": {
        const ownerWallet = String(args.ownerWallet ?? this.treasuryWallet);
        const subAgentDelegateWallet = args.subAgentDelegateWallet
          ? String(args.subAgentDelegateWallet)
          : undefined;
        const bundle = deriveSapAgentBundle(ownerWallet, { subAgentDelegateWallet });
        if (args.includeLiveMainnetState) {
          const liveState = await inspectSapMainnetState(ownerWallet, this.rpcUrl);
          return { sapIdentity: bundle, liveMainnetState: liveState };
        }
        return { sapIdentity: bundle };
      }

      case "shield_audit_token_mint": {
        const mint = String(args.mint ?? "");
        const report = await auditTokenMintLive(mint, {
          rpcUrl: this.rpcUrl,
          fetchImpl: this.fetchImpl,
        });
        return { auditReport: report };
      }

      case "reclaim_empty_atas_tx": {
        const ownerWallet = String(args.ownerWallet ?? "");
        const treasuryWallet = args.treasuryWallet
          ? String(args.treasuryWallet)
          : this.treasuryWallet;
        const plan = await scanMainnetEmptyAtas(ownerWallet, {
          rpcUrl: this.rpcUrl,
          treasuryWallet,
        });
        return { rentReclaimPlan: plan };
      }

      case "mandate_evaluate_execution": {
        const intent: ExecutionIntent = {
          intentId: String(args.intentId ?? "mcp-intent"),
          protocol: String(args.protocol ?? "jupiter") as ExecutionIntent["protocol"],
          actorWallet: String(args.actorWallet ?? this.treasuryWallet),
          recipientWallet: args.recipientWallet ? String(args.recipientWallet) : undefined,
          destinationWallets: Array.isArray(args.destinationWallets)
            ? args.destinationWallets.map(String)
            : undefined,
          tokenMint: String(args.tokenMint ?? ""),
          amountUsd: Number(args.amountUsd ?? 0),
          slippageBps: args.slippageBps !== undefined ? Number(args.slippageBps) : undefined,
          convictionScore:
            args.convictionScore !== undefined ? Number(args.convictionScore) : undefined,
          poolLiquidityUsd:
            args.poolLiquidityUsd !== undefined ? Number(args.poolLiquidityUsd) : undefined,
        };
        const evaluation = this.mandateEngine.evaluate(intent, Boolean(args.commitSpend));
        const antiReplay = deriveSapAntiReplayReceipt(
          this.mandateEngine.getMandate().agentWallet,
          intent.actorWallet,
          evaluation.serviceHashBytes
        );
        return {
          evaluation: {
            ...evaluation,
            serviceHashBytes: undefined,
          },
          sapSettlementAntiReplay: antiReplay,
        };
      }

      case "multihopper_plan_and_quote": {
        const reqObj = {
          tokenMint: String(args.tokenMint ?? ""),
          amountRaw: String(args.amountRaw ?? "0"),
          amountTokens: String(args.amountTokens ?? "0"),
          sourceOwner: String(args.sourceOwner ?? this.treasuryWallet),
          recipientWallet: args.recipientWallet ? String(args.recipientWallet) : undefined,
          destinations: Array.isArray(args.destinations)
            ? (args.destinations as MultiDestinationShare[])
            : undefined,
          hops: args.hops !== undefined ? Number(args.hops) : undefined,
          route: args.route ? (args.route as CustomRouteSpec) : undefined,
        };
        const validation = validateMultiHopperRequest(reqObj);
        const economics = calculateRouteEconomics({
          principalUsd: Number(args.principalUsd ?? 0),
          hopCount: validation.hopCount,
          destinationCount: Math.max(1, validation.destinationCount),
        });
        const mhClient = new MultiHopperClient({ fetchImpl: this.fetchImpl });
        let upstreamServerCard: unknown = null;
        if (args.discoverUpstreamMcp) {
          upstreamServerCard = await mhClient.discoverServerCard();
        }
        return {
          validation,
          economics,
          upstreamServerCard,
        };
      }

      case "jupiter_build_guarded_swap": {
        const res = await quoteGuardedJupiterSwap({
          intentId: String(args.intentId ?? "jup-mcp-intent"),
          actorWallet: String(args.actorWallet ?? this.treasuryWallet),
          inputMint: String(args.inputMint ?? ""),
          outputMint: String(args.outputMint ?? ""),
          inAmountRaw: String(args.inAmountRaw ?? "0"),
          amountUsd: Number(args.amountUsd ?? 0),
          slippageBps: args.slippageBps !== undefined ? Number(args.slippageBps) : 50,
          mandateEngine: this.mandateEngine,
          fetchImpl: this.fetchImpl,
          rpcUrl: this.rpcUrl,
        });
        return {
          allowed: res.allowed,
          shieldScore: res.shieldReport.convictionScore,
          shieldVerdict: res.shieldReport.verdict,
          mandateReasons: res.mandateEvaluation.reasons,
          quote: res.quote,
        };
      }

      case "ace_research_conviction_brief": {
        const mint = String(args.mint ?? "");
        const symbol = String(args.symbol ?? "TOKEN");
        const shieldReport = await auditTokenMintLive(mint, {
          rpcUrl: this.rpcUrl,
          fetchImpl: this.fetchImpl,
        });
        const brief = await synthesizeStrategyConvictionBrief({
          mint,
          symbol,
          shieldReport,
          fetchImpl: this.fetchImpl,
        });
        return { convictionBrief: brief };
      }

      default:
        throw new Error(`Unknown MCP tool: ${toolName}`);
    }
  }
}

const MULTIHOPPER_RESOURCE_URI = "https://www.multihopper.com/.well-known/mcp/server-card.json";

function createDefaultMandateEngineInstance(treasuryWallet: string): CapitalMandateEngine {
  return new CapitalMandateEngine(createDefaultMandate(treasuryWallet));
}

export function runMcpStdioLoop(server: SentinelSapMcpServer = new SentinelSapMcpServer()): void {
  const rl = readline.createInterface({
    input: process.stdin,
    terminal: false,
  });
  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const req = JSON.parse(trimmed) as JsonRpcRequest;
      const out = await server.dispatch(req, "stdio-local");
      if (out.body) {
        process.stdout.write(JSON.stringify(out.body) + "\n");
      }
    } catch {
      process.stdout.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error" },
        }) + "\n"
      );
    }
  });
}

if (process.argv.includes("--stdio")) {
  runMcpStdioLoop();
}
