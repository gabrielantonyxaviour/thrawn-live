# Thrawn Live

**An autonomous BNB Smart Chain trading agent that trades performance-weighted signal alpha behind a hard drawdown gate.** Built for the **BNB Hack: AI Trading Agent Edition** (CoinMarketCap × Trust Wallet × BNB Chain).

> Track 1 is scored on *"most profit without blowing up"* — total return with a max-drawdown cap as a hard DQ. Thrawn Live's edge is the **drawdown gate**: a portfolio-level risk supervisor that de-risks to stables *before* it ever approaches the cap, then re-arms on recovery. Discipline is the differentiator.

## The edge — why it doesn't blow up

The decision loop wraps every candidate trade in a veto gate:

```
CMC data → signal brain → ┌─ off-allowlist?        → REFUSE
                          ├─ low / malformed conf?  → REFUSE
                          ├─ invalid entry / stop?  → REFUSE
                          ├─ drawdown gate HALTED?   → REFUSE  ← the anti-DQ edge
                          └─ clear → size → TWAK swap → log on-chain
```

- **Drawdown-from-peak** is tracked at the portfolio level (matching the hour-by-hour scoring), with a configurable official cap (`drawdownCapPct`, default 30 — the rules only ever say *"e.g. 30%"*) and a **conservative internal halt** (`internalHaltPct`, 20%) that trips *first*.
- On halt → **de-risk to stables** (USDT/USDC/DAI/FDUSD/TUSD). The gate **re-arms** once drawdown recovers below `rearmPct` (10%) — without this hysteresis a single halt would brick the agent and guarantee a `≥1-trade/day` DQ.
- A **≥1-trade/day guard** places a minimal (risk-neutral when halted) qualifying trade so the daily minimum is never silently missed.

## Uses all three sponsor tools

| Layer | Sponsor tool | Status |
|---|---|---|
| **Identity** | **BNB AI Agent SDK** (`bnbagent`, ERC-8004) | ✅ **Live on BSC testnet, gas-free via MegaFuel** — agentId **1453** |
| **Signer / execution** | **Trust Wallet Agent Kit** (`@trustwallet/cli`, Agent Wallet mode) | Wired (`twak swap` PancakeSwap spot + `twak compete register`); needs portal creds to run |
| **Data** | **CoinMarketCap Agent Hub** (free REST tier) | Wired (batched `quotes/latest` + Fear & Greed regime); needs a free API key to run |

### On-chain proof (BSC testnet)

- **ERC-8004 identity** — agentId `1453`, agent address [`0xC1c9220E874AF912d4aC26Eeb45d7fFB0c0DF6b5`](https://testnet.bscscan.com/address/0xC1c9220E874AF912d4aC26Eeb45d7fFB0c0DF6b5), registration tx [`0xe7ec77…05abf8`](https://testnet.bscscan.com/tx/0xe7ec778f291759cba3a544841e18985622d8d0f736ed6bcf66ebd5d76105abf8) (status `0x1`, `effectiveGasPrice 0` — MegaFuel-sponsored). Registry `0x8004A818BFB912233c491871b3d84c89A494BD9e`. See [`proof/identity-testnet.json`](proof/identity-testnet.json).

## Architecture (polyglot, contract-first)

```
shared/contract.ts            the seam (Signal, RiskGate, AgentDecision, Execution, services)
shared/eligible-tokens.json   the 149-token BSC allowlist (trades outside don't count)

agent/  (TypeScript — the live loop)
  src/gate.ts      portfolio drawdown gate (peak tracking, halt + re-arm, ≥1/day)
  src/brain.ts     the veto decision engine (allowlist + confidence + validation + gate)
  src/sizing.ts    risk-based position sizing
  src/loop.ts      one decision tick + the qualifying-trade guard
  src/daemon.ts    hourly orchestration (mark-to-market → signal → gate → exec → log)
  src/services/    live adapters: cmc · signal-source · twak · competition · decision-registry · factory

bnbagent/  (Python — one-shot identity)
  register_identity.py   ERC-8004 registration via the BNB AI Agent SDK (MegaFuel gas-free)

contracts/
  DecisionRegistry.sol   append-only on-chain provenance of every decision (deploy-ready)
```

The brain + gate + loop are identical in mock and live mode; only the IO edges (CMC / TWAK / chain) swap, selected by `THRAWN_MODE`.

## Run it

```bash
npm install

# 1) Mock loop — full EXECUTE / REFUSE / DERISK / RE-ARM / qualify flow, $0, no network
npm run dev:mock

# 2) Tests (gate, brain, allowlist, CMC parser, momentum)
npm test

# 3) ERC-8004 identity on BSC testnet (gas-free; Python venv per bnbagent/requirements.txt)
BNBAGENT_WALLET_PASSWORD=... RPC_URL=https://bsc-testnet-rpc.publicnode.com \
  bnbagent/.venv/bin/python bnbagent/register_identity.py

# 4) Live daemon (needs a free CMC key; add TWAK creds for real swaps)
THRAWN_MODE=live CMC_PRO_API_KEY=... npm run daemon

# 5) Dashboard — terminal control room (drawdown gate, decision stream, on-chain proof)
npm run dev:mock                 # emits dashboard/public/state.json
cd dashboard && npm install && npm run dev   # http://localhost:5174
```

The dashboard is data-driven from `dashboard/public/state.json` (the agent emits it each run) and polls every 4s, so it reflects the live loop as it trades.

Config is fully env-driven (`.env.example`) — nothing is hardcoded. See [`FACTS.md`](FACTS.md) for verified deadlines/SDK facts and [`.claude/state/CURRENT_SPEC.md`](.claude/state/CURRENT_SPEC.md) for current state.

## Status

- ✅ Agent core (gate, brain, sizing, loop) — 17 tests, mock loop proven end-to-end.
- ✅ ERC-8004 identity live on BSC testnet with verified on-chain proof.
- ✅ Live adapters (CMC, TWAK, DecisionRegistry) behind the seam; daemon wired.
- ✅ Dashboard — terminal control room (drawdown-gate gauge, decision stream, on-chain proof), responsive.
- ⏳ Needs a free **CMC API key** + **TWAK Access ID/HMAC** to run the live loop end-to-end.
- ⏳ `DecisionRegistry` deploy needs a one-time ~$0.01 of gas (then `recordDecision` is gas-free).
- ⏳ Live mainnet competition registration (Jun 22–28) — a funded go/no-go.
