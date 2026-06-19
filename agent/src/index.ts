import type { PortfolioSnapshot, Signal } from "../../shared/contract.js";
import { ELIGIBLE_COUNT } from "./allowlist.js";
import { RISK_CONFIG } from "./config.js";
import { initGate } from "./gate.js";
import {
  mockDataService,
  mockExecutionService,
  mockRegistryService,
} from "./mocks.js";
import { maybeQualify, runTick, type Services, type ThrawnState } from "./loop.js";
import type { DashboardDecision } from "../../shared/dashboard.js";
import { buildDashboardState, writeDashboardState } from "./state.js";

/**
 * Phase 0 — runnable mock scenario. Drives the REAL brain + gate + loop over mocked IO to
 * demonstrate the full decision flow end-to-end with $0: a clean EXECUTE, an off-allowlist
 * REFUSE, a low-confidence REFUSE, and a drawdown trip that fires the DERISK halt.
 */
const services: Services = {
  data: mockDataService({ ETH: 3000, CAKE: 2.5 }),
  exec: mockExecutionService(),
  registry: mockRegistryService(),
};

const config = RISK_CONFIG;
let state: ThrawnState = { gate: initGate(config), positions: [] };

const snap = (equityUsd: number): PortfolioSnapshot => ({
  ts: Date.now(),
  equityUsd,
  positions: state.positions,
});

const ticks: { label: string; signal: Signal | null; equityUsd: number }[] = [
  {
    label: "Clean eligible signal",
    equityUsd: config.startingCapitalUsd,
    signal: {
      id: 1,
      asset: "ETH",
      direction: "LONG",
      entryPrice: 3000,
      tp1: 3200,
      tp2: null,
      tp3: null,
      sl: 2900,
      leverage: null,
      traderName: "AlphaCaller",
      signalTime: Date.now(),
      confidence: 0.8,
    },
  },
  {
    label: "Off-allowlist asset (BTC not in 149 set)",
    equityUsd: 200,
    signal: {
      id: 2,
      asset: "BTC",
      direction: "LONG",
      entryPrice: 65000,
      tp1: 68000,
      tp2: null,
      tp3: null,
      sl: 63000,
      leverage: null,
      traderName: "AlphaCaller",
      signalTime: Date.now(),
      confidence: 0.9,
    },
  },
  {
    label: "Low-confidence signal",
    equityUsd: 198,
    signal: {
      id: 3,
      asset: "CAKE",
      direction: "LONG",
      entryPrice: 2.5,
      tp1: 2.8,
      tp2: null,
      tp3: null,
      sl: 2.4,
      leverage: null,
      traderName: "NoiseCaller",
      signalTime: Date.now(),
      confidence: 0.4,
    },
  },
  {
    label: "Drawdown trips the 20% halt → DERISK",
    equityUsd: 158, // 21% below the 200 peak
    signal: {
      id: 4,
      asset: "ETH",
      direction: "LONG",
      entryPrice: 2500,
      tp1: 2700,
      tp2: null,
      tp3: null,
      sl: 2400,
      leverage: null,
      traderName: "AlphaCaller",
      signalTime: Date.now(),
      confidence: 0.85,
    },
  },
  {
    label: "Drawdown recovers → gate RE-ARMS, trading resumes",
    equityUsd: 195, // 2.5% below peak (< 10% re-arm) → halt clears
    signal: {
      id: 5,
      asset: "ETH",
      direction: "LONG",
      entryPrice: 3000,
      tp1: 3200,
      tp2: null,
      tp3: null,
      sl: 2900,
      leverage: null,
      traderName: "AlphaCaller",
      signalTime: Date.now(),
      confidence: 0.8,
    },
  },
];

console.log(`Thrawn Live — Phase 0 mock loop`);
console.log(
  `Eligible tokens: ${ELIGIBLE_COUNT} | start $${config.startingCapitalUsd} | internal halt ${config.internalHaltPct}% | DQ cap ${config.drawdownCapPct}%\n`,
);

const decisions: DashboardDecision[] = [];
for (const t of ticks) {
  const res = await runTick(state, t.signal, snap(t.equityUsd), services, config);
  state = res.state;
  decisions.unshift({ ...res.decision, executions: res.executions });
  const d = res.decision;
  console.log(`▶ ${t.label}`);
  console.log(`   equity $${t.equityUsd} | drawdown ${state.gate.currentDrawdownPct.toFixed(2)}% | halted=${state.gate.halted}`);
  console.log(`   decision: ${d.decision}${d.refusalReason ? ` (${d.refusalReason})` : ""}`);
  if (res.executions.length)
    console.log(`   executions: ${res.executions.map((e) => `${e.side} ${e.asset} @${e.venue} ${e.txHash?.slice(0, 12)}…`).join(", ")}`);
  console.log(`   registry: ${res.registryTx.length} decision(s) logged | trades today: ${state.gate.tradesToday}\n`);
}

// New UTC day — the daemon resets tradesToday. Simulate a quiet day (no signals) and show the
// ≥1-trade/day guard place a minimal qualifying trade so we never silently miss the daily minimum.
state = { ...state, gate: { ...state.gate, tradesToday: 0 } };
const q = await maybeQualify(state, services, config);
if (q) {
  state = q.state;
  decisions.unshift({ ...q.decision, executions: q.executions });
  console.log(`▶ New UTC day, no signals → ≥1/day guard fires`);
  console.log(`   decision: ${q.decision.decision} | ${q.executions.map((e) => `${e.side} ${e.asset} $${e.size.notionalUsd}`).join(", ")} | trades today: ${state.gate.tradesToday}\n`);
}

console.log(`Final: open positions ${state.positions.length}, halted=${state.gate.halted}, trades today ${state.gate.tradesToday}`);

// Emit the dashboard snapshot — real on-chain identity proof + this run's gate/decisions.
writeDashboardState(
  buildDashboardState({
    mode: "mock",
    network: "bsc-testnet",
    config,
    state,
    equityUsd: ticks[ticks.length - 1].equityUsd,
    decisions,
    sponsors: { cmc: "pending", trustWallet: "pending", bnbSdk: "live" },
  }),
);
console.log("dashboard state → dashboard/public/state.json");
