# Superteam Earn - Staged Copy-Paste Submission Form Fields

> **Verification Timestamp (UTC):** `2026-11-17T19:33:00Z`  
> **Live API Endpoint Verified:** `https://earn.superteam.fun/api/listings/details/build-an-autonomous-capital-agent-on-solana-and-compete-for-dollar500-in-rewards`  
> **Live Status:** `OPEN` (`isWinnersAnnounced: false`)  
> **Official Deadline:** `2026-12-10T22:59:59.000Z` (`23+ days remaining`)

---

## 1. Core Superteam Earn Modal Metadata

- **Listing URL:** `https://earn.superteam.fun/listing/build-an-autonomous-capital-agent-on-solana-and-compete-for-dollar500-in-rewards`
- **Listing UUID:** `591423c3-bb3e-4f91-8ff0-69f163038ede`
- **Bounty Title:** `Build an Autonomous Capital Agent on Solana & Compete for $500 in Rewards` (*Steve Capital Agent Challenge - Powered by OOBE Protocol | Featuring MultiHopper & Ace Data Cloud*)
- **Total Reward Pool:** **`$500 USDC`** (`250 USDC` Main Bounty + `125 USDC` MultiHopper Agent Routing Side-Track + `$125` Ace Data Cloud MCP Side-Track - simultaneous multi-track entry eligible)
- **Solana USDC Payout Wallet Address (Solana Mainnet Phantom USDC Payout Wallet):**
  ```text
  89Sv5FvnMNRid1bn8y2Ti1vJPSxWxgiW9GSLsPpBnKK1
  ```

---

## 2. Quantitative Expected-Value (EV) Target Selection Proof

All open Development USDC bounties on `earn.superteam.fun` (`$300-$5,000 USDC`) were queried live on `2026-11-17`:

| Rank | Superteam Earn Listing | Advertised Pool | Submissions | Hard Gating / Disqualifiers | Real Technical EV Verdict |
| :-: | :--- | :---: | :---: | :--- | :--- |
| **#1 (Selected)** | **OOBE Protocol - Build an Autonomous Capital Agent on Solana (`Steve Capital` + `MultiHopper` + `Ace MCP`)** | **`$500 USDC`** | **`11`** | **None** (`20 USDC` / SOL agent wallet + working SAP MCP / MultiHopper / Mandate workflow; simultaneous 3-track eligibility) | **HIGHEST REAL EV** - Pure Solana + SAP v2 SDK + MCP + MultiHopper routing engineering with low competition (`11` entries) |
| #2 | MultiHopper Build & Route Challenge | `$5,000 USDC` | `78` | Requires **`>= $100,000` paid mainnet fee volume** (`$500` out-of-pocket fees) per product to qualify + `$2M` aggregate volume condition | `$0` standalone EV unless $100k mainnet volume is routed (though our MultiHopper module is 100% compatible) |
| #3 | SSR.FUN Beta Launch Challenge | `$300 USDC` | `16` | Retail portfolio PnL / manual trading volume contest, not an SDK/MCP/Blink engineering bounty | Lower EV & non-SDK |

---

## 3. Exact Copy-Paste Submission Modal Fields

### Field A - Link to Your Submission / Deliverable (GitHub Repo URL)
```text
https://github.com/sonnyman2014/sentinel-sap-autonomous-capital-agent
```

### Field B - Tweet / X Post Link (Copy-Paste Draft Below)

#### Ready-to-Post X / Twitter Proof Draft (Main Track + MultiHopper + Ace MCP Side-Tracks)
```text
Built Sentinel-SAP for the @SteveCapitalOS Autonomous Capital Agent Challenge powered by @OOBEonSol!

- Native OOBE SAP v2 SDK PDAs (SAPpUhsW...) + Ed25519 Capital Mandates & Sub-Agent VaultDelegates
- 11-Layer SPL & Token-2022 Pre-Trade Rug Shield + Empty-ATA Rent Compounding
- @Multihopper MCP & MH_018 Multi-Destination Treasury Routing + @acedatacloud Conviction Engine
- Solana Actions v2.2.1 Blink + x402 MCP Server

Wallet: 89Sv5FvnMNRid1bn8y2Ti1vJPSxWxgiW9GSLsPpBnKK1
Solscan: https://solscan.io/account/89Sv5FvnMNRid1bn8y2Ti1vJPSxWxgiW9GSLsPpBnKK1
```

### Field C - Eligibility Question #1 (Exact Superteam Earn Modal Question)
> **Prompt:** *"Share your agent wallet adress + any transaction link on Solana explorer / solscan if relevant."*

**Copy-Paste Answer:**
```text
Agent & Treasury Wallet Address (Solana Mainnet-Beta):
89Sv5FvnMNRid1bn8y2Ti1vJPSxWxgiW9GSLsPpBnKK1
Solscan Account Explorer: https://solscan.io/account/89Sv5FvnMNRid1bn8y2Ti1vJPSxWxgiW9GSLsPpBnKK1

Deterministic OOBE Protocol SAP v2 (Program: SAPpUhsWLJG1FfkGRcXagEDMrMsWGjbky7AyhGpFETZ) Derived Accounts:
- GlobalRegistry PDA: 9odFrYBBZq6UQC6aGyzMPNXWJQn55kMtfigzhLg6S6L5 (Verified live on Solana Mainnet, 105 bytes)
- AgentAccount PDA: 9WJiczHMNjNj2PDpgmxcuDAvLnXAqLR4se91MBMNJbZW (bump=254)
- MemoryVault PDA: 47SHovNZn5CrThLTszFkWqdpNBHrppD4DzhJ176v9Stp (bump=255)
- Specialist Routing Sub-Agent VaultDelegate PDA: 3NPfM4oxrkiUKxC2hPztCdWMmQzYh8wkMM4ofhVLzKTc

Live Solana Actions v2.2.1 Blink & x402 MCP Gateway Reference Deployment:
https://rentandrugshield.com (11-Layer Pre-Buy Shield + Empty-ATA Rent Reclaim + x402 MCP Server)
```

### Field D - Anything Else / Technical Deep-Dive & Track Qualification Summary
```text
Sentinel-SAP (@sentinel-sap/autonomous-capital-agent) is a complete, production-grade TypeScript SDK, JSON-RPC 2.0 MCP Server (stdio + Streamable HTTP), and Solana Actions v2.2.1 Blink built specifically for Steve Capital (OOBE Protocol SAP v2), MultiHopper Agent Routing, and Ace Data Cloud Conviction Workflows:

1. OOBE Protocol SAP v2 (@oobe-protocol-labs/synapse-sap-sdk v1.0.3) Integration:
   - Derives deterministic on-chain AgentAccount, MemoryVault, AgentStats, PricingMenu, AgentStake, VaultDelegate, Tool (6 tools), CapabilityIndex, ProtocolIndex, and v0.10.0 anti-replay SettlementReceipt PDAs against mainnet program SAPpUhsWLJG1FfkGRcXagEDMrMsWGjbky7AyhGpFETZ.
   - Programmable CapitalMandateEngine enforces per-tx USD caps, rolling 24h spend ceilings, minimum 80/100 11-Layer Shield conviction scores, liquidity floors (>= $25k), slippage bounds (<= 100 bps), sub-agent VaultDelegate budgets/expiries, Ed25519 mandate attestations, and strict anti-circular transfer / wash-volume prevention.

2. 11-Layer SPL & Token-2022 Pre-Trade Risk Shield + Empty-ATA Rent Compounding:
   - Inspects live Solana mainnet mints and DEX pools across 11 layers (Mint/Freeze authorities, Token-2022 PermanentDelegate / NonTransferable / excessive TransferFeeConfig traps, Top-10 concentration, pool depth, organic volume, honeypot sell-ratio, and price impact) BEFORE allowing any Jupiter v6 swap.
   - Scans SPL & Token-2022 token accounts for zero-balance ATAs (~0.00203928 SOL each), automatically skipping frozen accounts and withheld-fee accounts so batch CloseAccount VersionedTransactions never revert, compounding idle rent SOL back into the agent vault.

3. MultiHopper Agent Routing Side-Track Integration (MCP + OpenAPI v1):
   - Auto-discovers https://www.multihopper.com/.well-known/mcp/server-card.json (v1.1.0, 14 tools).
   - Enforces all MH_018 custom route invariants client-side (2-9 single-recipient hops, 3-10 multi-destination hops across up to 20 recipients with exact BigInt share sums, 20s-30d wait bounds, explicit final wallet hop on multi-send, endpoint/duplicate collision checks).
   - Computes exact 50 bps full-rate fee, 25 bps ($2,500/$1M) partner revenue share, single-counted competition principal, and 0.0019 SOL/hop TRM-screened ATA rent, and signs PreparedTxBundle (routeInitTxs -> dispersionInitTxs) non-custodially via VersionedTransaction.

4. MCP Workspace Server + x402 Agentic Payments + Solana Actions v2.2.1 Blink:
   - Exposes 7 MCP tools over --stdio and POST /mcp with open discovery (initialize, tools/list -> HTTP 200) and x402 Solana payment verification (0.0003 SOL/call or 0.026 SOL Pro Pass -> 89Sv5FvnMNRid1bn8y2Ti1vJPSxWxgiW9GSLsPpBnKK1) with anti-replay signature tracking.
   - Serves full CORS-compliant Solana Actions v2.2.1 Blinks at /api/actions/capital-agent returning base64 VersionedTransactions anchored to live Solana mainnet blockhashes.

5. Verification:
   - Run `./run_demo.sh` (`npm run typecheck && npm test && npm run demo`) -> 100% unit + live mainnet integration tests passing with zero mocks on mainnet RPC checks.
```
