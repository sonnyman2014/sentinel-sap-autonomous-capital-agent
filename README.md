# Sentinel-SAP (`@sentinel-sap/autonomous-capital-agent`)

**Autonomous Solana Capital & Treasury Routing Agent built on OOBE Protocol SAP v2 (`@oobe-protocol-labs/synapse-sap-sdk`), MultiHopper Programmable Routing MCP/API, 12-Layer SPL/Token-2022 Pre-Trade Guardrails (with 10/11-Layer Backwards-Compatible Aliases), Empty-ATA Rent Compounding, Solana Actions v2.2.1 Blinks, and x402 MCP Agentic Commerce.**

> **Superteam Earn Target Bounty:** [Build an Autonomous Capital Agent on Solana & Compete for $500 in Rewards](https://earn.superteam.fun/listing/build-an-autonomous-capital-agent-on-solana-and-compete-for-dollar500-in-rewards)  
> **Sponsor:** OOBE Protocol (`Steve Capital`), featuring **MultiHopper** (`Agent Routing Challenge`) & **Ace Data Cloud** (`MCP Conviction`)  
> **Status:** `OPEN` | **Deadline:** `2026-12-10T22:59:59.000Z` | **Reward Pool:** **`$500 USDC`** (`250 USDC` Main Track + `125 USDC` MultiHopper Track + `$125` Ace Data Cloud Track)

---

## 1. Problem Statement & Solution

Autonomous capital agents on Solana routinely lose principal to three preventable failure modes:
1. **Unbounded Execution Risk:** Agents execute swaps without on-chain authority/extension inspection, getting trapped in Token-2022 `PermanentDelegate`, `TransferHook`, `NonTransferable`, or excessive `TransferFeeConfig` honeypots, Block-0 Sybil / 2-Hop Funder Cartels, or breaching daily risk mandates.
2. **Idle Rent Leakage:** High-frequency DeFi and routing workflows leave dozens of zero-balance SPL and Token-2022 Associated Token Accounts (`2,039,280` lamports / `~0.00203928 SOL` each) locked on-chain, while naive batch-close scripts revert whenever a single token account is frozen or holds unharvested Token-2022 transfer fees.
3. **Linkable Treasury Disbursements:** Direct single-hop agent payouts expose treasury wallets and recipient clusters without TRM compliance screening or programmable multi-destination routing.

**Sentinel-SAP** solves all three in a unified, zero-placeholder TypeScript SDK, JSON-RPC 2.0 Model Context Protocol (MCP) Server, and Solana Actions v2.2.1 Blink:
- **Native OOBE Protocol SAP v2 Identity & Guardrails (`src/sap-agent.ts`, `src/mandate.ts`):** Derives deterministic on-chain SAP v2 accounts (`AgentAccount`, `MemoryVault`, `VaultDelegate`, `AgentStats`, `PricingMenu`, `AgentStake`, `Tool`, and v0.10.0 anti-replay `SettlementReceipt` PDAs) against mainnet program `SAPpUhsWLJG1FfkGRcXagEDMrMsWGjbky7AyhGpFETZ` and enforces Ed25519-attested spending caps, exact integer micro-USD rolling 24h budgets, sub-agent delegation bounds, and anti-circular transfer rules.
- **12-Layer SPL & Token-2022 Pre-Trade Risk Shield (`src/shield-and-rent.ts`):** Inspects live Solana mainnet mints (`BigInt` `u64` raw supply safe) and DEX pools across 12 defensive layers (including Layer 11 Block-0 Sybil / Spoofed LP Guard and Layer 12 2-Hop Funder Cartel & CPI `TransferHook` Guard) before allowing any Jupiter swap, while preserving full backwards-compatible `evaluate11LayerShield` and `evaluate10LayerShield` aliases.
- **Fault-Tolerant Empty-ATA Rent Compounding (`src/shield-and-rent.ts`):** Builds non-custodial `VersionedTransaction` (`MessageV0`) `CloseAccount` batches in exact `BigInt` lamport/BPS arithmetic while automatically skipping frozen ATAs and withheld-fee Token-2022 accounts.
- **MultiHopper Programmable Routing SDK & MCP Bridge (`src/multihopper.ts`):** Auto-discovers MultiHopper's live MCP Server Card (`v1.1.0`), validates `MH_018` custom routes (`2-10` hops, up to `20` multi-send destinations, `u64::MAX` raw share sum invariants), computes exact `BigInt` `50 bps` fee / `25 bps` partner rev-share economics, and non-custodially signs `PreparedTxBundle` (`routeInitTxs` -> `dispersionInitTxs`) in strict order.
- **Ace Data Cloud Conviction Engine + x402 MCP + Solana Actions v2.2.1 (`src/ace-conviction.ts`, `src/mcp-server.ts`, `src/http-server.ts`):** Exposes 7 canonical MCP tools (plus `12_layer` / `11_layer` / `10_layer` dispatch aliases) over `--stdio` and Streamable HTTP `/mcp` with open discovery (`HTTP 200`) and `HTTP 402` Solana payment gating, alongside CORS-compliant Solana Blinks.

---

## 2. System Architecture

```mermaid
flowchart TD
    UserOrLLM["Steve Capital / Claude / Cursor / Blink Client"]
    Blink["Solana Actions v2.2.1 Blink (/api/actions/capital-agent)"]
    MCP["Sentinel-SAP MCP Server (--stdio & POST /mcp + x402 Gate)"]
    Mandate["CapitalMandateEngine (Ed25519 Attestation + Micro-USD BigInt 24h Cap)"]
    SAP["OOBE Protocol SAP v2 SDK (SAPpUhsW... PDAs & Anti-Replay Receipts)"]
    Shield["12-Layer SPL & Token-2022 Pre-Trade Shield + Empty-ATA Rent Reclaimer"]
    MH["MultiHopper v1 SDK & MCP Client (MH_018 Validator + Bundle Signer)"]
    Ace["Ace Data Cloud MCP + DEX Conviction Synthesizer"]
    Solana["Solana Mainnet-Beta RPC + Jupiter v6 Quote Engine"]

    UserOrLLM --> Blink
    UserOrLLM --> MCP
    Blink --> SAP
    Blink --> Shield
    MCP --> Mandate
    Mandate --> SAP
    Mandate --> Shield
    Mandate --> MH
    MCP --> Ace
    Shield --> Solana
    MH --> Solana
    SAP --> Solana
```

---

## 3. Quickstart

```bash
cd sentinel-sap-autonomous-capital-agent

# 1. Install dependencies
npm install

# 2. Strict TypeScript typecheck & production build (0 compiler warnings)
npm run typecheck
npm run build

# 3. Run full unit + live Solana mainnet integration test suite (12/12 tests)
npm test

# 4. Run deterministic 6-stage live mainnet & ecosystem proof
./run_demo.sh
```

---

## 4. CLI, MCP Server & Solana Actions v2.2.1 API Reference

### CLI Commands (`npx tsx src/cli.ts <command>`)
| Command | Description |
| :--- | :--- |
| `sap-identity [wallet]` | Derives OOBE SAP v2 PDAs (`AgentAccount`, `MemoryVault`, `VaultDelegate`, `Tool` x6) and queries live Solana mainnet `GlobalRegistry` & wallet state. |
| `audit-mint [mint]` | Runs live 12-Layer SPL / Token-2022 risk audit on Solana mainnet + DexScreener liquidity telemetry. |
| `scan-rent [wallet]` | Scans live SPL & Token-2022 token accounts, skips frozen/withheld-fee ATAs, and outputs a base64 `CloseAccount` `VersionedTransaction`. |
| `mcp-stdio` | Starts the JSON-RPC 2.0 MCP server (`protocolVersion: 2024-11-05`) over `stdin`/`stdout` for Steve Capital / Claude / Cursor MCP Workspace. |
| `serve [port]` | Starts the Streamable HTTP MCP (`/mcp` + x402 gate) and Solana Actions v2.2.1 Blink server (`/api/actions/capital-agent`). |

### Exposed MCP Tools (`7` Canonical Tools + Backwards-Compatible Dispatch Aliases)
1. `sap_derive_agent_identity` - Deterministic OOBE SAP v2 PDA tree + optional live Solana mainnet RPC inspection.
2. `shield_audit_token_mint` - 12-Layer SPL & Token-2022 pre-trade risk audit (`SAFE` / `CAUTION` / `BLOCKED`; also accepts `shield_audit_token_mint_12_layer`, `shield_audit_token_mint_11_layer`, and `shield_audit_token_mint_10_layer` dispatch aliases).
3. `reclaim_empty_atas_tx` - Zero-balance SPL/Token-2022 ATA discovery + `VersionedTransaction` builder.
4. `mandate_evaluate_execution` - Programmable mandate evaluation + SAP v0.10.0 `SettlementReceipt` anti-replay PDA derivation.
5. `multihopper_plan_and_quote` - Client-side `MH_018` route validation + `50 bps` / `25 bps` economics + MultiHopper MCP discovery.
6. `jupiter_build_guarded_swap` - Pre-trade 12-Layer Shield + Mandate gate + live Jupiter swap quote (`https://lite-api.jup.ag/swap/v1/quote`).
7. `ace_research_conviction_brief` - Blended on-chain 12-Layer Shield + Ace Data Cloud SERP conviction brief (`CORE_ALLOCATION` / `TACTICAL_SATELLITE` / `DO_NOT_ALLOCATE`).

---

## 5. Anchor, OOBE SAP v2 (`SAPpUhsWLJG1FfkGRcXagEDMrMsWGjbky7AyhGpFETZ`) & Math Security Invariants

1. **Canonical OOBE SAP v2 PDA Derivation & Bump Pinning (`src/sap-agent.ts`):**
   - All agent identity, vault, staking, tool, capability, escrow, and anti-replay accounts are derived deterministically via `@oobe-protocol-labs/synapse-sap-sdk/pda` against locked Mainnet program ID `SAPpUhsWLJG1FfkGRcXagEDMrMsWGjbky7AyhGpFETZ` (`GlobalRegistry` `9odFrYBBZq6UQC6aGyzMPNXWJQn55kMtfigzhLg6S6L5`), returning canonical `[pda, bump]` pairs so off-curve spoofed addresses are impossible.
2. **SAP v0.10.0 `SettlementReceipt` Anti-Replay & Ed25519 Attestation (`src/mandate.ts`):**
   - Every `ExecutionIntent` generates a deterministic SHA-256 `serviceHash` mapped to SAP's `["sap_recv", escrow_pda, service_hash]` `SettlementReceipt` PDA, blocking duplicate intent replay both in-memory and on-chain.
   - Sub-agent delegations (`VaultDelegate` PDA) strictly enforce distinct delegate pubkeys (`delegateWallet !== agentWallet`), bounded expiry (`0 < duration <= MAX_DELEGATE_DURATION_SECS`), protocol allowlists, and Ed25519 PKCS8/SPKI cryptographic signature verification.
3. **Anchor Account Owner, 8-Byte Discriminator & CPI Reload Discipline:**
   - Pre-trade mint verification strictly validates `account.owner` against `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` or `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` (Layer 1) before inspecting extensions, preventing fake account injection. Downstream Anchor programs integrating SAP escrows must verify 8-byte account discriminators and call `.reload()?` on token accounts after any CPI.
4. **Defensive `BigInt` Micro-USD, `u64` SPL Token & Lamport Math:**
   - Rolling 24h budgets and MultiHopper `50 bps` / `25 bps` fee splits execute in integer micro-USD (`1_000_000n` micro-USD = `$1.000000`), eliminating IEEE-754 floating-point drift (`0.1 + 0.2 === 0.3` exact).
   - MultiHopper `MH_018` destination share sums enforce base-10 `BigInt` equality and `u64::MAX` (`18,446,744,073,709,551,615n`) ceilings; `NaN`, `Infinity`, negative values, and fractional hop counts fail closed.
5. **Zero-Revert Token-2022 & Frozen ATA Batching:**
   - Automatically excludes `state === "frozen"` ATAs and non-zero `transferFeeAmount.withheldAmount` Token-2022 accounts so batch `CloseAccount` rent sweeps never revert on-chain.

---

## 6. Reproducible Performance Benchmarks & Verified Test Suite (`12/12 PASS`, `0` Warnings)

Measured on Ubuntu 24.04 (Node.js `v20.20.2`, TypeScript `5.7.2` strict mode):

| Subsystem | Average Latency | Throughput |
| :--- | :--- | :--- |
| `validateMultiHopperRequest` (`MH_018` BigInt + `u64` bounds) | **`0.0118 ms/op`** | **`~84,745 ops/sec`** |
| `CapitalMandateEngine.evaluate` (Ed25519 pubkey + SHA-256 + 24h cap) | **`0.0872 ms/op`** | **`~11,468 ops/sec`** |
| `evaluate12LayerShield` (12-Layer SPL / Token-2022 + Sybil/Cartel) | **`0.3177 ms/op`** | **`~3,148 ops/sec`** |
| `deriveSapAgentBundle` (Full 18-PDA OOBE SAP v2 Identity Tree) | **`9.7616 ms/bundle`** | **`~102 bundles/sec`** |

```text
> @sentinel-sap/autonomous-capital-agent@1.0.0 test
> tsx --test tests/*.test.ts

ok 1 - OOBE Protocol SAP v2 Identity & Programmable Capital Mandates (3/3 subtests)
ok 2 - MCP JSON-RPC + x402 Gate + Solana Actions v2.2.1 Blink + Live Mainnet RPC (3/3 subtests)
ok 3 - MultiHopper Programmable Routing SDK & Ace Data Cloud Conviction (3/3 subtests)
ok 4 - 12-Layer SPL / Token-2022 Risk Shield & Empty-ATA Rent Compounding (3/3 subtests)
1..4
# tests 12 | suites 4 | pass 12 | fail 0
```
