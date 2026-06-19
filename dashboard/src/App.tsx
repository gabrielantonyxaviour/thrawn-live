import { useEffect, useState } from "react";
import { pct, timeAgo, usd } from "./format.ts";
import { DecisionStream, OnChainProof, Positions, Sponsors } from "./panels.tsx";
import type { DashboardState } from "./types.ts";

function TopBar({ s }: { s: DashboardState }) {
  return (
    <header className="topbar">
      <div className="brand">
        <b>
          THRAWN<span className="v"> LIVE</span>
        </b>
        <small>autonomous bsc trading agent</small>
      </div>
      <div className="spacer" />
      <div className="meta">
        <span className={`pill ${s.mode === "live" ? "live" : "mock"}`}>{s.mode}</span>
        <span className="num">{s.network}</span>
        <span className="faint">updated {timeAgo(s.updatedAt)}</span>
        <span className="live-dot" title="polling" />
      </div>
    </header>
  );
}

function GateHero({ s }: { s: DashboardState }) {
  const { gate, risk } = s;
  const cap = risk.drawdownCapPct;
  const dd = gate.currentDrawdownPct;
  const fill = Math.min(dd / cap, 1) * 100;
  const haltMark = (risk.internalHaltPct / cap) * 100;
  const armed = !gate.halted;
  const band = gate.halted || dd >= risk.internalHaltPct ? "bad" : dd >= risk.rearmPct ? "warn" : "ok";
  const pnl = s.equityUsd - risk.startingCapitalUsd;

  return (
    <section className="gate">
      <div className="gate-main">
        <div className="gate-status">
          <span className={`statuschip ${armed ? "armed" : "halted"}`}>
            <span className="dot" />
            {armed ? "Gate Armed" : "Halted · De-risking"}
          </span>
          <span className="faint">
            re-arms below {pct(risk.rearmPct)} · halt {pct(risk.internalHaltPct)} · DQ cap{" "}
            {pct(cap)}
          </span>
        </div>

        <div className="dd-readout">
          <div className="dd-value num">
            {dd.toFixed(2)}
            <span className="pct">%</span>
          </div>
          <div className="dd-label">
            <div className="kicker">Portfolio drawdown</div>
            <div className="dim">from peak {usd(gate.peakEquityUsd)}</div>
          </div>
        </div>

        <div className="gauge">
          <div className={`gauge-fill ${band}`} style={{ width: `${fill}%` }} />
          <div className="gauge-mark halt" style={{ left: `${haltMark}%` }} title="internal halt" />
          <div className="gauge-mark cap" style={{ left: "calc(100% - 2px)" }} title="DQ cap" />
        </div>
        <div className="gauge-scale num">
          <span>0%</span>
          <span>{pct(risk.internalHaltPct)} halt</span>
          <span>{pct(cap)} DQ</span>
        </div>
        <div className="gauge-legend">
          <span>
            <i style={{ background: "var(--caution)" }} /> internal halt
          </span>
          <span>
            <i style={{ background: "var(--halted)" }} /> disqualification cap
          </span>
        </div>
      </div>

      <div className="gate-stats">
        <div className="stat">
          <span className="k">Equity</span>
          <span className="val num">{usd(s.equityUsd)}</span>
        </div>
        <div className="stat">
          <span className="k">Net P&L</span>
          <span className={`val num ${pnl >= 0 ? "pos" : "neg"}`}>
            {pnl >= 0 ? "+" : "−"}
            {usd(Math.abs(pnl))}
          </span>
        </div>
        <div className="stat">
          <span className="k">Trades today</span>
          <span className="val num">
            {gate.tradesToday}
            <span className="faint" style={{ fontSize: 13 }}>
              {" "}
              / min {risk.minTradesPerDay}
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`/state.json?t=${Date.now()}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((j) => alive && (setState(j), setMissing(false)))
        .catch(() => alive && setMissing(true));
    load();
    const id = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!state) {
    return (
      <div className="app">
        <div className="empty" style={{ marginTop: 80, textAlign: "center" }}>
          {missing
            ? "Waiting for agent state — run `npm run dev:mock` to emit dashboard/public/state.json"
            : "Loading…"}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <TopBar s={state} />
      <GateHero s={state} />
      <div className="grid">
        <div className="col">
          <DecisionStream decisions={state.decisions} />
        </div>
        <div className="col">
          <OnChainProof identity={state.identity} network={state.network} />
          <Positions positions={state.positions} />
          <Sponsors sponsors={state.sponsors} />
        </div>
      </div>
      <div className="footnote">
        Thrawn Live · most profit without blowing up · the drawdown gate is the edge
      </div>
    </div>
  );
}
