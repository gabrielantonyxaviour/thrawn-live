import type {
  DataService,
  EligibleToken,
  Signal,
} from "../../../shared/contract.js";
import { isEligible } from "../allowlist.js";
import type { RegimeSignals, SignalSource } from "./types.js";

/**
 * CmcMomentumSignalSource — emits performance-weighted LONG candidates for eligible BSC tokens
 * from CMC 24h momentum, haircut by the CMC regime/risk flags. SPOT-only: SHORTs are filtered.
 * SL/TP come from fixed pct bands (CMC free tier has no candle ATR), so sizing.ts works unchanged.
 * `callerWeight` injects the OFFLINE performance weighting (trader win-rates from the analyzer).
 */
export interface MomentumOpts {
  watchlist: EligibleToken[];
  momentumThresholdPct: number; // require a 24h move larger than this to consider a BUY
  stopPct: number; // SL distance below entry
  takeProfitPct: number; // TP1 distance above entry
  callerWeight?: (asset: string) => number; // performance multiplier (default 1)
}

/** Pure, unit-testable confidence: normalized momentum × caller weight × regime haircut, clamped [0,1]. */
export function momentumConfidence(
  change24hPct: number,
  thresholdPct: number,
  callerWeight: number,
  regime: RegimeSignals,
): number {
  if (change24hPct <= thresholdPct) return 0;
  const momentumScore = Math.min(1, change24hPct / (thresholdPct * 3));
  const haircut = regime.riskFlags.includes("overheated")
    ? 0.6
    : regime.regime === "extreme-fear"
      ? 0.5
      : 1;
  return Math.max(0, Math.min(1, momentumScore * callerWeight * haircut));
}

export function cmcMomentumSignalSource(
  data: DataService,
  opts: MomentumOpts,
): SignalSource {
  let counter = 0;
  return {
    async next(): Promise<Signal | null> {
      const regime: RegimeSignals = (await data.getRegimeSignals?.()) ?? {
        regime: "unknown",
        riskFlags: [],
      };
      // Pick the strongest eligible 24h mover above threshold.
      let best: { asset: EligibleToken; change: number; price: number } | null = null;
      for (const asset of opts.watchlist) {
        if (!isEligible(asset)) continue;
        let m: { price: number; change24hPct: number };
        try {
          m = await data.getMarket(asset);
        } catch {
          continue; // skip a token that fails to quote rather than abort the scan
        }
        if (!(m.price > 0)) continue;
        if (
          m.change24hPct > opts.momentumThresholdPct &&
          (!best || m.change24hPct > best.change)
        ) {
          best = { asset, change: m.change24hPct, price: m.price };
        }
      }
      if (!best) return null;

      const w = opts.callerWeight?.(best.asset) ?? 1;
      const confidence = momentumConfidence(
        best.change,
        opts.momentumThresholdPct,
        w,
        regime,
      );
      counter += 1;
      return {
        id: counter,
        asset: best.asset,
        direction: "LONG", // spot-only
        entryPrice: best.price,
        tp1: best.price * (1 + opts.takeProfitPct / 100),
        tp2: null,
        tp3: null,
        sl: best.price * (1 - opts.stopPct / 100),
        leverage: null,
        traderName: "cmc-momentum",
        signalTime: Date.now(),
        confidence,
      };
    },
  };
}
