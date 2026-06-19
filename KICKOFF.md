# Thrawn Live — kickoff prompt

Paste this into the Claude Code session (or say "read CLAUDE.md and KICKOFF.md, then start"). **Start this terminal FIRST — its clock is tightest.**

```
Goal: ship Thrawn Live for BNB AI Trading Agent Edition. ASSEMBLY of code I already own, not from scratch. Autonomous BSC trading agent that trades performance-weighted signal alpha behind a hard drawdown gate.

HARD DEADLINE: on-chain registration + submission LOCK at Jun 21 12:00 UTC (17:30 IST) — registration is rejected once the live trading window opens Jun 22. Getting registered + live is the #1 priority. Trading window Jun 22–28, judged on live PnL, ≥1 trade/day, blow the max-drawdown cap = instant DQ. FIRST TASK: open https://dorahacks.io/hackathon/bnbhack-twt-cmc/detail and confirm (a) the exact registration cutoff and (b) the EXACT max-drawdown % — press only gives "e.g. 30%", do not hardcode 30 until confirmed.

Read before coding:
- ~/Documents/agents/docs/hackathons/research-sessions/2026-06-19-bnb-ai-trading-agent-ideas.md (dossier)
- ~/Documents/agents/docs/hackathons/research-sessions/2026-06-19-trading-work-appraisal.md (which asset does what)
- ./FACTS.md (verified deadlines + SDK facts)
- ~/Documents/trading — Signal Analyzer. REUSE: src/market/outcome.ts (evaluateSignal -> max_loss_pct / max_profit_pct intra-trade excursion = your live-drawdown math), src/paper/sizing.ts (calculatePositionSize(entryPrice, sl, riskUsd=50) -> {positionUnits, notionalUsd, impliedLeverage, riskUsd}), src/api/server.ts (GET /api/signals/open already returns live price + unrealized_pnl_pct), dashboard/ (Vite+React, reuse as thin UI).
- ~/Documents/hackathons/agora-agents-hackathon/execution/2026-05-21T00-46-19Z-blacklist-agora — YOUR OWN decision engine (no external "Agora framework" exists). REUSE: src/lib/agent.ts evaluateEvent() veto pattern, contracts/DecisionRegistry.sol (EVM, deploy to BSC — recordDecision(id, kind, evidenceHash, amount)).
- ~/Documents/hackathons/x-layer-okx/.agents/skills — OKX OnchainOS, REFERENCE ONLY for swap/SL-TP patterns. NOTE: OKX is NOT a sponsor of this hackathon and its Agentic Wallet competes with the scored Trust Wallet kit — do not bind the primary signer to OKX.

Sponsor wiring (scored — all three = top scoring):
- Identity: BNB AI Agent SDK — `pip install bnbagent` (v0.3.6, real, official). Registers ERC-8004 agent identity on BSC (gas-free on testnet via MegaFuel).
- Signer (PRIMARY): Trust Wallet Agent Kit — TS/CLI, install `npm i -g @trustwallet/cli` (NOT pip, NOT @trustwallet/agent-kit). Run `setup` with Access ID + HMAC secret from portal.trustwallet.com, choose Agent Wallet mode for autonomous signing. Expose via CLI/MCP subprocess from the Python agent.
- Data: CMC Agent Hub — REST base https://pro-api.coinmarketcap.com, header X-CMC_PRO_API_KEY (key from pro.coinmarketcap.com). Swap the analyzer's feeds -> CMC as the scored data layer.

Architecture: Thrawn Live is POLYGLOT — Python (bnbagent identity) + TS (signer/executor + analyzer). Define the process boundary in shared/contract.ts (Signal, Position, RiskGate, Execution, AgentDecision). The drawdown gate from outcome.ts is your anti-DQ edge — wire it as a pre-trade veto in the decision loop.

Steps: (1) plan + shared/contract.ts. (2) Confirm deadline+drawdown% on DoraHacks, then register on BSC via bnbagent + Trust Wallet — get live ASAP. (3) Wire CMC data -> strategy -> drawdown gate -> Trust Wallet execution -> DecisionRegistry log. (4) Verify >=1 trade/day and the drawdown gate triggers a halt. Public repo + on-chain BSC proof required. Stay on main. Start with the plan; stop for my approval.
```
