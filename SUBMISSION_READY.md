# Sentinel-SAP ($500 USDC Superteam Earn Submission Ready Bundle)

- Author: GS
- Target Bounty: Build an Autonomous Capital Agent on Solana & Compete for $500 in Rewards
- Listing URL: https://earn.superteam.fun/listing/build-an-autonomous-capital-agent-on-solana-and-compete-for-dollar500-in-rewards
- Listing UUID: 591423c3-bb3e-4f91-8ff0-69f163038ede
- Sponsor Tracks: OOBE Protocol (Steve Capital $250 USDC Main Track) + MultiHopper ($125 USDC Agent Routing Track) + Ace Data Cloud ($125 MCP Track)
- Phantom Solana USDC Payout Wallet: `89Sv5FvnMNRid1bn8y2Ti1vJPSxWxgiW9GSLsPpBnKK1`
- Solscan Wallet Proof: https://solscan.io/account/89Sv5FvnMNRid1bn8y2Ti1vJPSxWxgiW9GSLsPpBnKK1
- Public GitHub Repository: https://github.com/sonnyman2014/sentinel-sap-autonomous-capital-agent

---

## 1. Exact Superteam Earn Submission Form Fields

### Field 1: Link to Your Submission (GitHub Repository URL)
```text
https://github.com/sonnyman2014/sentinel-sap-autonomous-capital-agent
```

### Field 2: Tweet / X Post Text (Ready to Post)
```text
Built Sentinel-SAP for the @SteveCapitalOS Autonomous Capital Agent Challenge powered by @OOBEonSol!

- Native OOBE SAP v2 SDK PDAs (SAPpUhsW...) + Ed25519 Capital Mandates & Sub-Agent VaultDelegates
- 10-Layer SPL & Token-2022 Pre-Trade Rug Shield + Empty-ATA Rent Compounding
- @Multihopper MCP & MH_018 Multi-Destination Treasury Routing + @acedatacloud Conviction Engine
- Solana Actions v2.2.1 Blink + x402 MCP Server

Wallet: 89Sv5FvnMNRid1bn8y2Ti1vJPSxWxgiW9GSLsPpBnKK1
Solscan: https://solscan.io/account/89Sv5FvnMNRid1bn8y2Ti1vJPSxWxgiW9GSLsPpBnKK1
Repo: https://github.com/sonnyman2014/sentinel-sap-autonomous-capital-agent
```

### Field 3: Eligibility Question ("Share your agent wallet adress + any transaction link on Solana explorer / solscan if relevant.")
```text
Agent & Phantom USDC Payout Wallet (Solana Mainnet-Beta):
89Sv5FvnMNRid1bn8y2Ti1vJPSxWxgiW9GSLsPpBnKK1
Solscan Account Explorer: https://solscan.io/account/89Sv5FvnMNRid1bn8y2Ti1vJPSxWxgiW9GSLsPpBnKK1

Deterministic OOBE Protocol SAP v2 (Program: SAPpUhsWLJG1FfkGRcXagEDMrMsWGjbky7AyhGpFETZ) Derived Accounts:
- GlobalRegistry PDA: 9odFrYBBZq6UQC6aGyzMPNXWJQn55kMtfigzhLg6S6L5 (Verified live on Solana Mainnet, 105 bytes)
- AgentAccount PDA: 9WJiczHMNjNj2PDpgmxcuDAvLnXAqLR4se91MBMNJbZW (bump=254)
- MemoryVault PDA: 47SHovNZn5CrThLTszFkWqdpNBHrppD4DzhJ176v9Stp (bump=255)
- Specialist Routing Sub-Agent VaultDelegate PDA: 3NPfM4oxrkiUKxC2hPztCdWMmQzYh8wkMM4ofhVLzKTc

Live Solana Actions v2.2.1 Blink & x402 MCP Gateway Reference Deployment:
https://rentandrugshield.com
```

### Field 4: Technical Overview & Multi-Track Qualification Notes
```text
Sentinel-SAP (@sentinel-sap/autonomous-capital-agent) is a TypeScript SDK, JSON-RPC 2.0 MCP Server (stdio and Streamable HTTP), and Solana Actions v2.2.1 Blink built for Steve Capital (OOBE Protocol SAP v2), MultiHopper Agent Routing, and Ace Data Cloud Conviction Workflows.

1. OOBE Protocol SAP v2 (@oobe-protocol-labs/synapse-sap-sdk v1.0.3):
   - Derives deterministic AgentAccount, MemoryVault, AgentStats, PricingMenu, AgentStake, VaultDelegate, Tool, CapabilityIndex, ProtocolIndex, and v0.10.0 anti-replay SettlementReceipt PDAs against mainnet program SAPpUhsWLJG1FfkGRcXagEDMrMsWGjbky7AyhGpFETZ.
   - CapitalMandateEngine enforces per-tx USD caps, rolling 24h spend limits, >=80/100 10-Layer Shield score gates, >=$25k liquidity floors, <=100 bps slippage caps, sub-agent VaultDelegate scopes, Ed25519 mandate attestations, and anti-circular transfer checks.

2. 10-Layer SPL & Token-2022 Pre-Trade Shield + Empty-ATA Rent Compounding:
   - Audits mints and pools across 10 layers (Mint/Freeze authorities, Token-2022 PermanentDelegate, NonTransferable, TransferFeeConfig traps, Top-10 holder concentration, liquidity depth, volume, sell ratio, and price impact) prior to Jupiter quote execution.
   - Reclaims zero-balance SPL and Token-2022 ATAs (~0.00203928 SOL each) in non-custodial VersionedTransaction batches while skipping frozen or withheld-fee accounts.

3. MultiHopper Agent Routing Side-Track + Ace Data Cloud MCP Side-Track:
   - Discovers https://www.multihopper.com/.well-known/mcp/server-card.json, enforces MH_018 route invariants (2 to 10 hops, up to 20 multi-send recipients, exact BigInt share sums, 20s to 30d wait windows), computes 50 bps fee / 25 bps partner revenue share, and signs PreparedTxBundle VersionedTransactions in order.
   - Synthesizes on-chain 10-Layer Shield telemetry with Ace Data Cloud research signals via 7 MCP tools over --stdio and POST /mcp (HTTP 200 discovery + HTTP 402 Solana payment gate to 89Sv5FvnMNRid1bn8y2Ti1vJPSxWxgiW9GSLsPpBnKK1).

Thank you!
- GS
```

---

## 2. Verbatim Unit & Mainnet Integration Test Output (`npm test`)

```text
> @sentinel-sap/autonomous-capital-agent@1.0.0 test
> tsx --test tests/*.test.ts

TAP version 13
# Subtest: OOBE Protocol SAP v2 Identity & Programmable Capital Mandates
    # Subtest: derives deterministic SAP v2 PDAs matching SAPpUhsWLJG1FfkGRcXagEDMrMsWGjbky7AyhGpFETZ
    ok 1 - derives deterministic SAP v2 PDAs matching SAPpUhsWLJG1FfkGRcXagEDMrMsWGjbky7AyhGpFETZ
      ---
      duration_ms: 171.8594
      ...
    # Subtest: enforces per-tx caps, rolling 24h spend caps, conviction floors, and anti-replay receipts
    ok 2 - enforces per-tx caps, rolling 24h spend caps, conviction floors, and anti-replay receipts
      ---
      duration_ms: 8.6158
      ...
    # Subtest: enforces anti-circular transfer rules, sub-agent delegation bounds, and Ed25519 attestations
    ok 3 - enforces anti-circular transfer rules, sub-agent delegation bounds, and Ed25519 attestations
      ---
      duration_ms: 46.0457
      ...
    1..3
ok 1 - OOBE Protocol SAP v2 Identity & Programmable Capital Mandates
  ---
  duration_ms: 228.9179
  type: 'suite'
  ...
# Subtest: MCP JSON-RPC + x402 Gate + Solana Actions v2.2.1 Blink + Live Mainnet RPC
    # Subtest: serves Solana Actions v2.2.1 Blink headers, GET metadata, and POST VersionedTransaction
    ok 1 - serves Solana Actions v2.2.1 Blink headers, GET metadata, and POST VersionedTransaction
      ---
      duration_ms: 319.1362
      ...
    # Subtest: enforces HTTP 402 on MCP tool call \#3 while keeping discovery 100% open
    ok 2 - enforces HTTP 402 on MCP tool call \#3 while keeping discovery 100% open
      ---
      duration_ms: 78.1713
      ...
    # Subtest: verifies live Solana Mainnet-Beta SAP v2 state, USDC 10-Layer Audit, and MultiHopper MCP card
    ok 3 - verifies live Solana Mainnet-Beta SAP v2 state, USDC 10-Layer Audit, and MultiHopper MCP card
      ---
      duration_ms: 819.6833
      ...
    1..3
ok 2 - MCP JSON-RPC + x402 Gate + Solana Actions v2.2.1 Blink + Live Mainnet RPC
  ---
  duration_ms: 1227.5547
  type: 'suite'
  ...
# Subtest: MultiHopper Programmable Routing SDK & Ace Data Cloud Conviction
    # Subtest: enforces MH_018 custom route validation rules for single and multi-destination payouts
    ok 1 - enforces MH_018 custom route validation rules for single and multi-destination payouts
      ---
      duration_ms: 118.8597
      ...
    # Subtest: computes exact 50 bps fee, 25 bps partner rev-share, and signs PreparedTxBundle in order
    ok 2 - computes exact 50 bps fee, 25 bps partner rev-share, and signs PreparedTxBundle in order
      ---
      duration_ms: 85.6722
      ...
    # Subtest: synthesizes Ace Data Cloud MCP + 10-Layer Shield conviction briefs
    ok 3 - synthesizes Ace Data Cloud MCP + 10-Layer Shield conviction briefs
      ---
      duration_ms: 33.1927
      ...
    1..3
ok 3 - MultiHopper Programmable Routing SDK & Ace Data Cloud Conviction
  ---
  duration_ms: 239.6962
  type: 'suite'
  ...
# Subtest: 10-Layer SPL / Token-2022 Risk Shield & Empty-ATA Rent Compounding
    # Subtest: scores clean revoked SPL tokens SAFE and blocks Token-2022 PermanentDelegate & Honeypots
    ok 1 - scores clean revoked SPL tokens SAFE and blocks Token-2022 PermanentDelegate & Honeypots
      ---
      duration_ms: 167.7734
      ...
    # Subtest: builds CloseAccount VersionedTransactions while skipping frozen and withheld-fee ATAs
    ok 2 - builds CloseAccount VersionedTransactions while skipping frozen and withheld-fee ATAs
      ---
      duration_ms: 28.8193
      ...
    # Subtest: blocks unsafe Jupiter swaps pre-RPC and quotes clean assets under mandate
    ok 3 - blocks unsafe Jupiter swaps pre-RPC and quotes clean assets under mandate
      ---
      duration_ms: 37.8472
      ...
    1..3
ok 4 - 10-Layer SPL / Token-2022 Risk Shield & Empty-ATA Rent Compounding
  ---
  duration_ms: 236.1862
  type: 'suite'
  ...
1..4
# tests 12
# suites 4
# pass 12
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 10310.1905
```

---

## 3. Verbatim Live Mainnet & Ecosystem Demo Output (`npm run demo`)

```text
> @sentinel-sap/autonomous-capital-agent@1.0.0 demo
> tsx scripts/demo_proof.ts

================================================================================
SENTINEL-SAP :: DETERMINISTIC LIVE MAINNET & ECOSYSTEM PROOF
Timestamp (UTC): 2026-11-18T01:00:18.214Z
================================================================================

[1/6] LIVE SUPERTEAM EARN LISTING CHECK
  Title    : Build an Autonomous Capital Agent on Solana & Compete for $500 in Rewards
  Status   : OPEN | Reward: 500 USDC
  Deadline : 2026-12-10T22:59:59.000Z

[2/6] OOBE PROTOCOL SAP v2 MAINNET VERIFICATION (@oobe-protocol-labs/synapse-sap-sdk)
  Solana Mainnet Slot     : 470743282 (https://api.mainnet-beta.solana.com)
  SAP v2 Program ID       : SAPpUhsWLJG1FfkGRcXagEDMrMsWGjbky7AyhGpFETZ (executable=true)
  SAP GlobalRegistry PDA  : 9odFrYBBZq6UQC6aGyzMPNXWJQn55kMtfigzhLg6S6L5 (exists=true, 105 bytes)
  Agent Wallet (Public)   : 89Sv5FvnMNRid1bn8y2Ti1vJPSxWxgiW9GSLsPpBnKK1 (0.014837723 SOL / 14837723 lamports)
  Derived AgentAccount    : 9WJiczHMNjNj2PDpgmxcuDAvLnXAqLR4se91MBMNJbZW (bump=254)
  Derived MemoryVault     : 47SHovNZn5CrThLTszFkWqdpNBHrppD4DzhJ176v9Stp (bump=255)
  Derived VaultDelegate   : 3NPfM4oxrkiUKxC2hPztCdWMmQzYh8wkMM4ofhVLzKTc

[3/6] 10-LAYER SPL/TOKEN-2022 SHIELD & MAINNET ATA RENT SCAN
  Mainnet $USDC Verdict   : SAFE (100/100)
  Token-2022 Rug Trap     : BLOCKED (0/100 - blocked pre-swap)
  Mainnet ATA Scan        : reclaimable=0, frozenSkipped=0 (safe skip prevents CloseAccount revert)

[4/6] STEVE CAPITAL MANDATE + GUARDED JUPITER SWAP EXECUTION
  Result                  : 0.1 SOL -> 7.473688 USDC via [Whirlpool] | serviceHash=6b5073782b9dba12417d6098...

[5/6] MULTIHOPPER MCP DISCOVERY + NON-CUSTODIAL ROUTE BUNDLE SIGNING
  MultiHopper MCP Server  : MultiHopper v1.1.0 (14 tools @ https://multihopper.com/api/mcp)
  MH_018 Route Validation : valid=true (hops=3, destinations=2)
  Economics ($50 USDC)    : fee=$0.25 | partnerRevShare=$0.125 | hopRent=0.0095 SOL
  Mainnet Blockhash       : 5CF9kkDpfpSfKqxVnhvCq4gTGU7FbpYEHq3j9ZqQteKh (lastValidHeight=448758206)
  Signed Bundle Txs       : 2 VersionedTxs | Tx[0] SHA256=1190dd95b76c6882259543434ab0b21e...

[6/6] SOLANA ACTIONS v2.2.1 BLINK + x402 MCP ENDPOINT VERIFICATION
  Blink HTTP Status       : 200 (X-Action-Version=2.2.1)
  Blink Message           : Prepared OOBE SAP v2 Capital Mandate + 0.1 SOL vault funding transaction.
  Serialized VersionedTx  : AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA... (672 base64 chars)

ALL 6 LIVE MAINNET & ECOSYSTEM PROOFS COMPLETED SUCCESSFULLY.
```
