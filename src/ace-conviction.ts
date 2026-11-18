import crypto from "node:crypto";
import { TokenShieldAuditReport } from "./shield-and-rent.js";

export interface AceSearchResultItem {
  title: string;
  link: string;
  snippet: string;
}

export interface StrategyConvictionBrief {
  mint: string;
  symbol: string;
  convictionScore: number;
  recommendedAllocationBps: number;
  riskRegime: "CORE_ALLOCATION" | "TACTICAL_SATELLITE" | "DO_NOT_ALLOCATE";
  aceMcpConnected: boolean;
  aceRequestCount: number;
  researchHighlights: AceSearchResultItem[];
  rationale: string;
  briefSha256: string;
  generatedAtIso: string;
}

export async function synthesizeStrategyConvictionBrief(params: {
  mint: string;
  symbol: string;
  shieldReport: TokenShieldAuditReport;
  aceApiKey?: string;
  aceEndpoint?: string;
  fetchImpl?: typeof fetch;
}): Promise<StrategyConvictionBrief> {
  const fetchFn = params.fetchImpl ?? fetch;
  const aceKey = params.aceApiKey ?? process.env.ACE_DATA_API_KEY;
  const endpoint = params.aceEndpoint ?? "https://api.acedata.cloud/serp/google";

  const researchHighlights: AceSearchResultItem[] = [];
  let aceMcpConnected = false;
  let aceRequestCount = 0;

  if (aceKey) {
    const res = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aceKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: `${params.symbol} ${params.mint} Solana liquidity audit protocol`,
      }),
    });
    if (res.ok) {
      aceMcpConnected = true;
      aceRequestCount = 1;
      const body = (await res.json()) as {
        organic?: Array<{ title?: string; link?: string; snippet?: string }>;
      };
      for (const item of (body.organic ?? []).slice(0, 5)) {
        researchHighlights.push({
          title: String(item.title ?? "Solana Market Signal"),
          link: String(item.link ?? ""),
          snippet: String(item.snippet ?? ""),
        });
      }
    }
  }

  // Blend on-chain 11-Layer Shield score (85% weight) with research sentiment signal (15% weight)
  const researchSignal =
    researchHighlights.length > 0 ? Math.min(100, 75 + researchHighlights.length * 5) : params.shieldReport.convictionScore;
  const blended = Math.round(params.shieldReport.convictionScore * 0.85 + researchSignal * 0.15);
  const convictionScore =
    params.shieldReport.verdict === "BLOCKED"
      ? Math.min(blended, 45)
      : Math.max(0, Math.min(100, blended));

  let riskRegime: StrategyConvictionBrief["riskRegime"] = "DO_NOT_ALLOCATE";
  let recommendedAllocationBps = 0;
  if (convictionScore >= 90 && params.shieldReport.verdict === "SAFE") {
    riskRegime = "CORE_ALLOCATION";
    recommendedAllocationBps = 2500; // 25% max sleeve
  } else if (convictionScore >= 80 && params.shieldReport.verdict === "SAFE") {
    riskRegime = "TACTICAL_SATELLITE";
    recommendedAllocationBps = 1000; // 10% max sleeve
  }

  const rationale =
    riskRegime === "DO_NOT_ALLOCATE"
      ? `Allocation blocked: 11-Layer Shield score ${params.shieldReport.convictionScore}/100 (${params.shieldReport.verdict}) below Steve Capital safety mandate.`
      : `Approved ${riskRegime} (${recommendedAllocationBps} bps): 11-Layer Shield ${params.shieldReport.convictionScore}/100, liquidity $${params.shieldReport.poolLiquidityUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}.`;

  const generatedAtIso = new Date().toISOString();
  const briefSha256 = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        mint: params.mint,
        convictionScore,
        recommendedAllocationBps,
        riskRegime,
        aceMcpConnected,
      })
    )
    .digest("hex");

  return {
    mint: params.mint,
    symbol: params.symbol,
    convictionScore,
    recommendedAllocationBps,
    riskRegime,
    aceMcpConnected,
    aceRequestCount,
    researchHighlights,
    rationale,
    briefSha256,
    generatedAtIso,
  };
}
