# Thrawn Live — verified build facts (checked 2026-06-19)

## Deadlines / rules — CONFIRMED against the LIVE DoraHacks rules page (2026-06-19)
- Build + submission window **Jun 3 → Jun 21, 2026**. **Hard lock = Jun 21 12:00 UTC = 17:30 IST.** Live page shows "Deadline 2026/06/21 19:00" (DoraHacks UTC+7) and header "1 day left for submission" as of 2026-06-19. **Track 1: register on-chain BEFORE the trading window opens Jun 22** — entries after it opens are rejected.
- Track 1 live trading **Jun 22–28**, judged on live PnL / total return, hour-by-hour. Judging Jun 29–Jul 5, winners week of Jul 6.
- **≥1 trade/day** (7 over the week) minimum to qualify. Must hold a **non-zero balance of in-scope assets at competition start** to be ranked.
- **Any hour beginning with portfolio ≤ $1 is scored 0% for that hour** — don't get drained to dust; keep capital deployed.
- **Max-drawdown cap = hard DQ.** ⚠️ RESOLVED: the exact % is **NOT publicly published** — even the canonical live rules page says verbatim *"max drawdown cap as a risk gate. Blow past the drawdown threshold (for example 30%) and you are disqualified."* The threshold is enforced by the competition contract. **Engineering decision: treat `drawdownCapPct` as runtime config (default 30, read from `twak compete`/contract at registration) and trip our OWN internal halt conservatively below it (`internalHaltPct`, e.g. 20%), de-risking to stables before we approach DQ.** Simulated transaction costs apply.
- **Registration is via TWAK, NOT bnbagent** (correction): `twak compete register` (CLI) or MCP `competition_register` resolves the agent wallet address and submits the registration tx to the competition contract **`0x212c61b9b72c95d95bf29cf032f5e5635629aed5`** (bsctrace.com) on BSC. Also must register + submit the agent address on DoraHacks with a short strategy explanation. The **bnbagent ERC-8004 identity is a SEPARATE, sponsor-scoring action** — not the competition entry.
- **Eligible tokens:** fixed list of **149 BEP-20 tickers** listed on CMC — captured verbatim to `shared/eligible-tokens.json` (ETH, USDT, USDC, XRP, CAKE, TWT, ASTER, AB, SAHARA, KOGE, …). **Trades outside the list don't count.** Stables for de-risk: USDT/USDC/DAI/FDUSD/TUSD.
- Tracks/prizes: Track 1 "Autonomous Trading Agents" $24k (5 winners); Track 2 "Strategy Skills" $6k; 3 sponsor specials $2k each. Total $36k.
- Host: https://dorahacks.io/hackathon/bnbhack-twt-cmc/detail · CMC co-hub coinmarketcap.com/api/hackathon/

## Sponsor SDKs — CONFIRMED
- **BNB AI Agent SDK** — `pip install bnbagent` ✅ v0.3.6, official `github.com/bnb-chain/bnbagent-sdk`. Agent identity via **ERC-8004** (gas-free on BSC testnet via MegaFuel paymaster). Runbook command correct.
- **Trust Wallet Agent Kit (TWAK)** — ✅ **JS/TS**, npm `@trustwallet/cli` (v0.19.1) or `curl -fsSL https://agent-kit.trustwallet.com/install.sh | bash`. NOT pip, NOT `@trustwallet/agent-kit` (404). Skills repo `github.com/trustwallet/tw-agent-skills`. Exposed via **CLI + MCP**. Bind signer: `setup` with Access ID + HMAC from portal.trustwallet.com → **Agent Wallet mode** for autonomous Track-1 signing.
- **CMC Agent Hub** — ✅ live. REST `https://pro-api.coinmarketcap.com`, header `X-CMC_PRO_API_KEY` (key from pro.coinmarketcap.com); also MCP (`X-CMC-MCP-API-KEY`) and x402 keyless ($0.01 USDC/req on Base). Docs coinmarketcap.com/api/documentation/ai-agent-hub.
- **OKX OnchainOS** — ✅ real (`github.com/okx/onchainos-skills`) but **NOT a sponsor here** → reference-only, scores zero sponsor points. Don't bind the primary signer to it.
- **"TWAK rubric"** — mislabel. TWAK = the tool. Track 1 judged on **live PnL**; using all 3 sponsors scores highest.

## Reusable assets (verified by reading the repos)
- `trading/src/market/outcome.ts` — `evaluateSignal(SignalRow)`; computes `max_loss_pct` / `max_profit_pct` intra-trade excursion + `final_pnl_pct`. **This is your live drawdown math.** Feeds: Binance (crypto, klines) → Yahoo fallback. `getPriceAt(asset, ts)`.
- `trading/src/paper/sizing.ts` — `calculatePositionSize(entryPrice, sl, riskUsd=50)` → `{positionUnits, notionalUsd, impliedLeverage, riskUsd}`.
- `trading/src/api/server.ts` — `GET /api/signals/open` returns live `current_price` + `unrealized_pnl_pct`.
- `agora-agents-hackathon/execution/2026-05-21T00-46-19Z-blacklist-agora` — `src/lib/agent.ts` `evaluateEvent()` veto (refuse below threshold); `contracts/DecisionRegistry.sol` `recordDecision(bytes32 id, string kind, bytes32 evidenceHash, uint256 amount)` — EVM, deploy to BSC.
- **"Agora framework / DecisionRegistry" has no external basis — it's your own code.** Don't hunt for a package.

## Sources
dorahacks.io/hackathon/bnbhack-twt-cmc · pypi.org/project/bnbagent · github.com/bnb-chain/bnbagent-sdk · npmjs.com/package/@trustwallet/cli · github.com/trustwallet/tw-agent-skills · coinmarketcap.com/api/documentation/ai-agent-hub · github.com/okx/onchainos-skills
