# Thrawn Live — session operating instructions (auto-loaded)

**You are assembling a PUBLIC BNB AI Trading Agent Edition submission from code Gabriel already owns. Read `KICKOFF.md` for the brief, `FACTS.md` for verified facts, `shared/contract.ts` for the seam.**

## What this is
An autonomous BSC trading agent that trades performance-weighted signal alpha behind a hard drawdown gate. ASSEMBLY, not a from-scratch build.

## ⏰ The clock dominates everything
**Submission/registration LOCK = Jun 21 12:00 UTC (17:30 IST).** On-chain registration is rejected once the live trading window opens Jun 22. Trading window Jun 22–28, judged on live PnL, **≥1 trade/day**, blow the max-drawdown cap = **instant DQ**. Getting registered + live is priority #1.

## First actions
1. Open https://dorahacks.io/hackathon/bnbhack-twt-cmc/detail and confirm (a) the exact registration cutoff and (b) the **EXACT max-drawdown %** — press only says "e.g. 30%". Don't hardcode 30 until confirmed.
2. Write the plan + `shared/contract.ts` refinements. **Stop after the plan for Gabriel's approval.**

## Load-bearing rules
- **Stay on `main`.** No feature branches.
- **PUBLIC repo. No private code/keys.** On-chain BSC proof required.
- **POLYGLOT architecture:** Python `bnbagent` (identity) + TS `@trustwallet/cli` (signer/executor) + TS analyzer. Define the process boundary in `shared/contract.ts`.
- **Contract-first, mock-first.** Integration is a named task with reserved time, not a last-hour afterthought.

## Reuse (assemble, don't rebuild)
- `~/Documents/trading` — Signal Analyzer. `src/market/outcome.ts` (`evaluateSignal` → `max_loss_pct` intra-trade excursion = your **live drawdown math**), `src/paper/sizing.ts` (`calculatePositionSize(entryPrice, sl, riskUsd=50)`), `src/api/server.ts` (`GET /api/signals/open` returns live price + `unrealized_pnl_pct`), `dashboard/` (Vite+React → thin UI).
- `~/Documents/hackathons/agora-agents-hackathon/execution/2026-05-21T00-46-19Z-blacklist-agora` — **your own** decision engine (no external "Agora framework" exists). Reuse `src/lib/agent.ts` `evaluateEvent()` veto pattern + `contracts/DecisionRegistry.sol` (deploy to BSC, `recordDecision(id, kind, evidenceHash, amount)`).
- `~/Documents/hackathons/x-layer-okx/.agents/skills` — OKX OnchainOS, **REFERENCE ONLY** for swap/SL-TP patterns. OKX is NOT a sponsor here and its wallet competes with the scored Trust Wallet kit — do not bind the primary signer to OKX.

## Sponsor wiring (scored — all three = top scoring)
- **Identity:** `pip install bnbagent` (v0.3.6, official). ERC-8004 agent identity on BSC (gas-free on testnet via MegaFuel).
- **Signer (PRIMARY):** Trust Wallet Agent Kit — TS, `npm i -g @trustwallet/cli` (NOT pip, NOT `@trustwallet/agent-kit`). `setup` with Access ID + HMAC from portal.trustwallet.com → **Agent Wallet mode**. Expose via CLI/MCP subprocess from the Python agent.
- **Data:** CMC Agent Hub — `https://pro-api.coinmarketcap.com`, header `X-CMC_PRO_API_KEY`. Swap analyzer feeds → CMC as the scored data layer.

## The edge
The drawdown gate from `outcome.ts`, wired as a pre-trade veto in the decision loop, is what keeps you un-DQ'd in Track 1's "most profit without blowing up" format. That discipline is the differentiator.
