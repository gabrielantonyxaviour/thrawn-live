# Thrawn Live — verified build facts (checked 2026-06-19)

## Deadlines / rules — CONFIRMED (with correction)
- Build + submission window **Jun 3 → Jun 21, 2026**. **Hard lock = Jun 21 12:00 UTC = 17:30 IST.** (Runbook's "before Jun 22" is loose — the binding cutoff is Jun 21 17:30 IST.) On-chain registration rejected once trading opens.
- Track 1 live trading **Jun 22–28**, judged on live PnL / total return.
- **≥1 trade/day** (7 over the week) minimum.
- **Max-drawdown cap = hard DQ** (blow it = disqualified regardless of PnL). ⚠️ The exact % only appears as "e.g. 30%" in press — **confirm on the live DoraHacks rules page before coding the gate.** Simulated transaction costs apply.
- Registration is **on-chain** via a BSC smart contract recording each agent wallet address.
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
