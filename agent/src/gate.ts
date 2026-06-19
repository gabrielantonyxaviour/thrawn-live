import type {
  PortfolioSnapshot,
  RiskConfig,
  RiskGate,
} from "../../shared/contract.js";

/**
 * The anti-DQ edge. Portfolio drawdown is measured from PEAK equity (matching the hour-by-hour
 * total-return scoring), NOT per-position. We trip our own halt at internalHaltPct — strictly
 * below the official drawdownCapPct — and de-risk to stables before we ever approach DQ.
 *
 * The per-position max-loss excursion math from ~/Documents/trading/src/market/outcome.ts informs
 * SL placement; THIS gate is the portfolio-level DQ metric.
 */
export function initGate(config: RiskConfig): RiskGate {
  return {
    peakEquityUsd: config.startingCapitalUsd,
    currentEquityUsd: config.startingCapitalUsd,
    currentDrawdownPct: 0,
    tradesToday: 0,
    halted: false,
  };
}

export function updateGate(
  snapshot: PortfolioSnapshot,
  prev: RiskGate,
  config: RiskConfig,
): RiskGate {
  const peakEquityUsd = Math.max(prev.peakEquityUsd, snapshot.equityUsd);
  const currentEquityUsd = snapshot.equityUsd;
  const dd =
    peakEquityUsd > 0
      ? ((peakEquityUsd - currentEquityUsd) / peakEquityUsd) * 100
      : 0;
  const tripped = dd >= config.internalHaltPct;
  return {
    peakEquityUsd,
    currentEquityUsd,
    currentDrawdownPct: Number(dd.toFixed(4)),
    tradesToday: prev.tradesToday,
    // Sticky once halted: no new risk-on entries until explicitly re-armed on recovery.
    halted: prev.halted || tripped,
    haltReason: prev.halted
      ? prev.haltReason
      : tripped
        ? `Drawdown ${dd.toFixed(2)}% ≥ internal halt ${config.internalHaltPct}% (DQ cap ${config.drawdownCapPct}%) — de-risk to stables`
        : undefined,
  };
}

export function shouldHalt(gate: RiskGate, config: RiskConfig): boolean {
  return gate.halted || gate.currentDrawdownPct >= config.internalHaltPct;
}

/** ≥1-trade/day qualification guard. The daemon resets tradesToday at each UTC midnight. */
export function needsQualifyingTrade(
  gate: RiskGate,
  config: RiskConfig,
): boolean {
  return gate.tradesToday < config.minTradesPerDay;
}
