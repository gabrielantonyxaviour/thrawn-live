# CURRENT SPEC — Thrawn Live (BNB AI Trading Agent Edition)

## Goal
Autonomous BSC trading agent that trades performance-weighted signal alpha behind a hard
drawdown gate ("most profit without blowing up"). ASSEMBLY of owned code. Uses all 3 sponsor
tools (CMC data, Trust Wallet signing, BNB AI Agent SDK identity). Build + prove on testnet $0;
the live mainnet competition is a separate, later, user-funded go/no-go.

## Decided (locked 2026-06-19)
- Build directly in Claude (user overrode the usual non-UI→Codex routing for speed).
- Architecture: **TS owns the live loop**; **Python bnbagent is a one-shot ERC-8004 identity**.
- Venue: **PancakeSwap spot only** (no perps). SHORT signals filtered or treated as exit-to-stable.
- Risk: `drawdownCapPct=30` (off-chain judging rule, never queryable), `internalHaltPct=20`,
  `rearmPct=10` (hysteresis re-arm — fixes the guaranteed-DQ bug).
- **Two-address design** (TWAK can't import/export keys): bnbagent identity wallet `0xC1c9…F6b5`
  (ERC-8004, agentId 1453, testnet, gas-free) ≠ TWAK trading/competition wallet (minted later).
- Deadline: **Jun 21 12:00 UTC** (on-chain register before Jun 22 trading window).

## Open / blocked on user
- **CMC free API key** (pro.coinmarketcap.com) — Chrome MCP blocks the portal; user must fetch.
- **TWAK Access ID + HMAC** (portal.trustwallet.com) — same; gates ALL twak ops.
- **~$0.01 tBNB** to deploy DecisionRegistry once (faucet gated on a 0.002 mainnet-BNB balance;
  MegaFuel won't sponsor contract creation). Once deployed, recordDecision is gas-free.
- **Mainnet funding** for the live Jun 22–28 competition — separate go/no-go.

## Out of scope (for the $0 testnet build)
- BSC perps / SHORT execution. x402 paid CMC calls (use free REST tier; forfeits 10 TWAK-rubric pts).
- Live mainnet `twak compete register` until the user funds + provides creds.

## Done-when
- [x] Deadline + drawdown confirmed; contract seam refined; eligible-token allowlist captured.
- [x] Phase 0 agent core (gate, brain, sizing, loop) — 14 tests pass, critical DQ bugs fixed.
- [x] ERC-8004 identity live on BSC testnet with verified on-chain proof (agentId 1453).
- [ ] Phase 2 live adapters (CMC, TWAK, signal-source, decision-registry) behind the seam.
- [ ] DecisionRegistry deployed (tBNB-gated) + on-chain decision logging.
- [ ] Dashboard (thin UI), README with on-chain proof, demo. DoraHacks submission.
- [ ] (If funded) mainnet competition registration before Jun 21 17:30 IST.
