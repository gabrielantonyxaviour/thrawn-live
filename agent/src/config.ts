import type { RiskConfig } from "../../shared/contract.js";

/**
 * Runtime risk config. The official DQ cap is NOT published (rules say only "e.g. 30%"),
 * so drawdownCapPct is a knob (default 30) and internalHaltPct is our conservative trip-wire
 * that de-risks well BEFORE the cap. Everything is env-overridable so nothing is hardcoded.
 */
export const RISK_CONFIG: RiskConfig = {
  drawdownCapPct: Number(process.env.DRAWDOWN_CAP_PCT ?? 30),
  internalHaltPct: Number(process.env.INTERNAL_HALT_PCT ?? 20),
  minTradesPerDay: Number(process.env.MIN_TRADES_PER_DAY ?? 1),
  perTradeRiskUsd: Number(process.env.PER_TRADE_RISK_USD ?? 50),
  maxNotionalPerTradeUsd: Number(process.env.MAX_NOTIONAL_USD ?? 500),
  slippageBps: Number(process.env.SLIPPAGE_BPS ?? 100),
  startingCapitalUsd: Number(process.env.STARTING_CAPITAL_USD ?? 200),
};

export const NETWORK = (process.env.THRAWN_NETWORK ?? "bsc-testnet") as
  | "bsc-testnet"
  | "bsc-mainnet";
