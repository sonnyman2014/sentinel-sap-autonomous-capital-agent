# Deterministic Live Mainnet & Ecosystem Execution Proof (`DEMO_PROOF.md`)

## Reproduction Command

```bash
cd sentinel-sap-autonomous-capital-agent
./run_demo.sh
```

`./run_demo.sh` executes:
1. `npm run typecheck` (`tsc --noEmit` -> `0` errors)
2. `npm test` (`12/12` unit + live Solana Mainnet-Beta integration tests passing, `0` failures)
3. `npm run demo` (`tsx scripts/demo_proof.ts` -> live Superteam Earn API check + live Solana Mainnet-Beta SAP v2 `SAPpUhsWLJG1FfkGRcXagEDMrMsWGjbky7AyhGpFETZ` inspection + live Circle `$USDC` 11-Layer Audit + live Jupiter swap quote + live MultiHopper MCP discovery & non-custodial `VersionedTransaction` bundle signing + live Solana Actions v2.2.1 Blink execution)

---

## Captured Live Execution Output (`2026-11-17T19:33:29Z`)

```text
================================================================================
SENTINEL-SAP :: DETERMINISTIC LIVE MAINNET & ECOSYSTEM PROOF
Timestamp (UTC): 2026-11-17T19:33:29.605Z
================================================================================

[1/6] LIVE SUPERTEAM EARN LISTING CHECK
  Title    : Build an Autonomous Capital Agent on Solana & Compete for $500 in Rewards
  Status   : OPEN | Reward: 500 USDC
  Deadline : 2026-12-10T22:59:59.000Z

[2/6] OOBE PROTOCOL SAP v2 MAINNET VERIFICATION (@oobe-protocol-labs/synapse-sap-sdk)
  Solana Mainnet Slot     : 470652407 (https://api.mainnet-beta.solana.com)
  SAP v2 Program ID       : SAPpUhsWLJG1FfkGRcXagEDMrMsWGjbky7AyhGpFETZ (executable=true)
  SAP GlobalRegistry PDA  : 9odFrYBBZq6UQC6aGyzMPNXWJQn55kMtfigzhLg6S6L5 (exists=true, 105 bytes)
  Agent Wallet (Public)   : 89Sv5FvnMNRid1bn8y2Ti1vJPSxWxgiW9GSLsPpBnKK1 (0.014309087 SOL / 14309087 lamports)
  Derived AgentAccount    : 9WJiczHMNjNj2PDpgmxcuDAvLnXAqLR4se91MBMNJbZW (bump=254)
  Derived MemoryVault     : 47SHovNZn5CrThLTszFkWqdpNBHrppD4DzhJ176v9Stp (bump=255)
  Derived VaultDelegate   : 3NPfM4oxrkiUKxC2hPztCdWMmQzYh8wkMM4ofhVLzKTc

[3/6] 11-LAYER SPL/TOKEN-2022 SHIELD & MAINNET ATA RENT SCAN
  Mainnet $USDC Verdict   : SAFE (100/100)
  Token-2022 Rug Trap     : BLOCKED (0/100 - blocked pre-swap)
  Mainnet ATA Scan        : reclaimable=0, frozenSkipped=0 (safe skip prevents CloseAccount revert)

[4/6] STEVE CAPITAL MANDATE + GUARDED JUPITER SWAP EXECUTION
  Result                  : 0.1 SOL -> 7.249448 USDC via [ZeroFi] | serviceHash=6b5073782b9dba12417d6098...

[5/6] MULTIHOPPER MCP DISCOVERY + NON-CUSTODIAL ROUTE BUNDLE SIGNING
  MultiHopper MCP Server  : MultiHopper v1.1.0 (14 tools @ https://multihopper.com/api/mcp)
  MH_018 Route Validation : valid=true (hops=3, destinations=2)
  Economics ($50 USDC)    : fee=$0.25 | partnerRevShare=$0.125 | hopRent=0.0095 SOL
  Mainnet Blockhash       : FqjLoZwp9skH6rU4mx5xDbcT1fM4UZP4zxyHmEa13dkn (lastValidHeight=448667362)
  Signed Bundle Txs       : 2 VersionedTxs | Tx[0] SHA256=907362ce8d8f3546aca605818756bbf7...

[6/6] SOLANA ACTIONS v2.2.1 BLINK + x402 MCP ENDPOINT VERIFICATION
  Blink HTTP Status       : 200 (X-Action-Version=2.2.1)
  Blink Message           : Prepared OOBE SAP v2 Capital Mandate + 0.1 SOL vault funding transaction.
  Serialized VersionedTx  : AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA... (672 base64 chars)

ALL 6 LIVE MAINNET & ECOSYSTEM PROOFS COMPLETED SUCCESSFULLY.
```

---

## Verified On-Chain & Public Endpoints Exercised (Zero Helius Credits Burned)

- **Solana Mainnet-Beta Public RPC:** `https://api.mainnet-beta.solana.com` (`getSlot`, `getMultipleAccountsInfo`, `getParsedAccountInfo`, `getParsedTokenAccountsByOwner`, `getLatestBlockhash`)
- **OOBE Protocol SAP v2 On-Chain Program:** `SAPpUhsWLJG1FfkGRcXagEDMrMsWGjbky7AyhGpFETZ` (`GlobalRegistry` PDA `9odFrYBBZq6UQC6aGyzMPNXWJQn55kMtfigzhLg6S6L5`, `105` bytes live on mainnet)
- **Jupiter Public Quote API:** `https://lite-api.jup.ag/swap/v1/quote`
- **MultiHopper Live MCP Server Card:** `https://www.multihopper.com/.well-known/mcp/server-card.json`
- **Superteam Earn Public Listing API:** `https://earn.superteam.fun/api/listings/details/build-an-autonomous-capital-agent-on-solana-and-compete-for-dollar500-in-rewards`
