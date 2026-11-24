#!/usr/bin/env python3
"""
Starter Submission #2 — MultiHopper Build & Route Challenge ($5,000-$50,000 + RevShare)
Multi-Venue Split-Order & Price-Impact Route Optimizer across Solana AMMs (Raydium, Orca, Meteora, PumpSwap).
"""
import asyncio
import json
import math
import aiohttp

SOL_MINT = "So11111111111111111111111111111111111111112"
BONK_MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"

VENUE_FEE_BPS = {
    "orca": 15.0,
    "meteora": 20.0,
    "raydium": 25.0,
    "pumpswap": 25.0,
}


def estimate_effective_out(amount_in_usd: float, pool_liq_usd: float, fee_bps: float) -> tuple[float, float]:
    """Constant-product approximation for effective USD output & price impact."""
    reserve_side = max(pool_liq_usd / 2.0, 1.0)
    net_in = amount_in_usd * (1.0 - fee_bps / 10000.0)
    impact_frac = net_in / (reserve_side + net_in)
    effective_usd = net_in * (1.0 - impact_frac)
    return effective_usd, impact_frac * 10000.0


async def optimize_split_route(target_mint: str = BONK_MINT, order_size_usd: float = 2500.0) -> dict:
    async with aiohttp.ClientSession() as session:
        async with session.get(f"https://api.dexscreener.com/latest/dex/tokens/{target_mint}", timeout=aiohttp.ClientTimeout(total=8)) as r:
            dj = await r.json()

    pools = []
    for p in dj.get("pairs") or []:
        if p.get("chainId") != "solana":
            continue
        liq = float((p.get("liquidity") or {}).get("usd") or 0)
        if liq < 5000:
            continue
        dex = (p.get("dexId") or "raydium").lower()
        pools.append({
            "pair_address": p.get("pairAddress"),
            "dex": dex,
            "quote": (p.get("quoteToken") or {}).get("symbol"),
            "liquidity_usd": round(liq, 2),
            "fee_bps": VENUE_FEE_BPS.get(dex, 25.0),
        })

    pools.sort(key=lambda x: x["liquidity_usd"], reverse=True)
    top_venues = pools[:4]
    if not top_venues:
        return {"ok": False, "reason": "No liquid Solana pools found"}

    # Single-venue baseline (100% through deepest pool)
    single_out, single_impact_bps = estimate_effective_out(order_size_usd, top_venues[0]["liquidity_usd"], top_venues[0]["fee_bps"])

    # Liquidity-weighted square-root optimal split across top venues
    weights_raw = [math.sqrt(v["liquidity_usd"]) / (1.0 + v["fee_bps"] / 100.0) for v in top_venues]
    w_sum = sum(weights_raw)
    legs = []
    split_total_out = 0.0
    for v, wr in zip(top_venues, weights_raw):
        share = wr / w_sum
        leg_usd = order_size_usd * share
        leg_out, leg_imp = estimate_effective_out(leg_usd, v["liquidity_usd"], v["fee_bps"])
        split_total_out += leg_out
        legs.append({
            "dex": v["dex"],
            "pair_address": v["pair_address"],
            "quote_asset": v["quote"],
            "allocation_pct": round(share * 100.0, 2),
            "leg_in_usd": round(leg_usd, 2),
            "est_leg_out_usd": round(leg_out, 2),
            "price_impact_bps": round(leg_imp, 2),
        })

    improvement_bps = ((split_total_out - single_out) / order_size_usd) * 10000.0
    return {
        "ok": True,
        "target_mint": target_mint,
        "order_size_usd": order_size_usd,
        "single_pool_out_usd": round(single_out, 2),
        "multihop_split_out_usd": round(split_total_out, 2),
        "execution_savings_bps": round(improvement_bps, 2),
        "route_legs": legs,
    }


if __name__ == "__main__":
    print(json.dumps(asyncio.run(optimize_split_route()), indent=2))
