import type { OpenPosition, PortfolioSnapshot } from "../../shared/contract.js";
import { ELIGIBLE_COUNT } from "./allowlist.js";
import { MIN_TRADE_NOTIONAL_USD, RISK_CONFIG } from "./config.js";
import { initGate } from "./gate.js";
import { maybeQualify, runTick, type ThrawnState } from "./loop.js";
import { buildServices } from "./services/factory.js";
import { cmcMomentumSignalSource } from "./services/signal-source.js";
import { buildDashboardState, writeDashboardState } from "./state.js";
import type { DashboardDecision, SponsorStatus } from "../../shared/dashboard.js";

/**
 * The live orchestration: factory-selected services → CMC momentum signal → drawdown gate →
 * TWAK execution → registry log, on an hourly cadence (matches the hour-by-hour scoring). Marks
 * the portfolio to market each tick to feed the gate, and runs the ≥1-trade/day guard each UTC day.
 *
 *   THRAWN_MODE=live CMC_PRO_API_KEY=... [TWAK creds…] npm run daemon
 * In mock mode (or without a CMC key) it prints the wiring and exits — the live loop needs CMC data.
 */
const WATCHLIST = (process.env.THRAWN_WATCHLIST ?? "CAKE,TWT,ETH,XRP,DOGE,LINK,UNI,AAVE")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const TICKS = Number(process.env.THRAWN_TICKS ?? 3);
const TICK_MS = Number(process.env.THRAWN_TICK_MS ?? 0); // 0 = run TICKS back-to-back then exit

async function main() {
  const { mode, services, notes } = buildServices();
  console.log(`Thrawn Live daemon — mode=${mode} | eligible tokens=${ELIGIBLE_COUNT}`);
  notes.forEach((n) => console.log(`  · ${n}`));

  if (mode !== "live" || notes.some((n) => n.startsWith("data: MOCK"))) {
    console.log(
      "\nLive loop needs CMC data. Run:  THRAWN_MODE=live CMC_PRO_API_KEY=... npm run daemon",
    );
    return;
  }

  const source = cmcMomentumSignalSource(services.data, {
    watchlist: WATCHLIST,
    momentumThresholdPct: Number(process.env.MOMENTUM_THRESHOLD_PCT ?? 3),
    stopPct: Number(process.env.STOP_PCT ?? 5),
    takeProfitPct: Number(process.env.TAKE_PROFIT_PCT ?? 10),
  });

  let state: ThrawnState = { gate: initGate(RISK_CONFIG), positions: [] };
  let cashUsd = RISK_CONFIG.startingCapitalUsd;
  const decisions: DashboardDecision[] = [];
  const sponsors = {
    cmc: (notes.some((n) => n.includes("CMC (live)")) ? "live" : "pending") as SponsorStatus,
    trustWallet: (notes.some((n) => n.includes("TWAK (live)")) ? "live" : "pending") as SponsorStatus,
    bnbSdk: "live" as SponsorStatus, // ERC-8004 identity registered (proof/identity-testnet.json)
  };
  const emit = (equityUsd: number) =>
    writeDashboardState(
      buildDashboardState({
        mode,
        network: process.env.THRAWN_NETWORK ?? "bsc-testnet",
        config: RISK_CONFIG,
        state,
        equityUsd,
        decisions,
        sponsors,
      }),
    );

  const markToMarket = async (positions: OpenPosition[]): Promise<number> => {
    let held = 0;
    for (const p of positions) {
      try {
        held += p.units * (await services.data.getPrice(p.asset));
      } catch {
        held += p.notionalUsd; // fall back to entry notional if a quote fails
      }
    }
    return held;
  };

  for (let i = 0; i < TICKS; i++) {
    const equityUsd = cashUsd + (await markToMarket(state.positions));
    const snapshot: PortfolioSnapshot = { ts: Date.now(), equityUsd, positions: state.positions };
    const signal = await source.next();
    const res = await runTick(state, signal, snapshot, services, RISK_CONFIG);
    state = res.state;
    // track cash from FILLED executions only (BUY spends, SELL/DERISK returns marked value)
    for (const e of res.executions) {
      if (e.status === "filled")
        cashUsd += e.side === "BUY" ? -e.size.notionalUsd : e.size.notionalUsd;
    }
    decisions.unshift({ ...res.decision, executions: res.executions });
    emit(equityUsd);
    console.log(
      `tick ${i + 1}/${TICKS}: equity=$${equityUsd.toFixed(2)} dd=${state.gate.currentDrawdownPct.toFixed(2)}% ` +
        `halted=${state.gate.halted} → ${res.decision.decision}${res.decision.refusalReason ? ` (${res.decision.refusalReason})` : ""} ` +
        `| ${res.executions.map((e) => `${e.side} ${e.asset} ${e.txHash?.slice(0, 10) ?? "—"}`).join(", ")}`,
    );
    if (TICK_MS) await new Promise((r) => setTimeout(r, TICK_MS));
  }

  // ≥1-trade/day guard (the daemon resets tradesToday at each UTC midnight in a real run).
  const q = await maybeQualify(state, services, RISK_CONFIG);
  if (q) {
    state = q.state;
    decisions.unshift({ ...q.decision, executions: q.executions });
    console.log(`≥1/day guard → qualifying trade $${MIN_TRADE_NOTIONAL_USD} (trades today: ${state.gate.tradesToday})`);
  }
  emit(cashUsd + (await markToMarket(state.positions)));
  console.log(`done — positions=${state.positions.length} halted=${state.gate.halted} trades=${state.gate.tradesToday}`);
  console.log("dashboard state → dashboard/public/state.json");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
