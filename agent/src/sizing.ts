import type { PositionSize } from "../../shared/contract.js";

/**
 * Risk-based position sizing — ported verbatim from ~/Documents/trading/src/paper/sizing.ts.
 *   With SL:  units = riskUsd / |entry - sl|,  notional = units × entry
 *   No SL:    units = riskUsd / entry  (flat $riskUsd notional, 1× leverage)
 */
export function calculatePositionSize(
  entryPrice: number,
  sl: number | null,
  riskUsd = 50,
): PositionSize {
  if (sl != null && sl !== entryPrice) {
    const slDistance = Math.abs(entryPrice - sl);
    const positionUnits = riskUsd / slDistance;
    const notionalUsd = positionUnits * entryPrice;
    return { positionUnits, notionalUsd, impliedLeverage: notionalUsd / riskUsd, riskUsd };
  }
  const positionUnits = riskUsd / entryPrice;
  return { positionUnits, notionalUsd: riskUsd, impliedLeverage: 1, riskUsd };
}
