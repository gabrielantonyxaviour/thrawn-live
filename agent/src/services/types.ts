import type { Signal } from "../../../shared/contract.js";

/** A live source of trade candidates (replaces index.ts's hard-coded signals in live mode). */
export interface SignalSource {
  next(): Promise<Signal | null>;
}

export type ThrawnMode = "mock" | "live";

export interface CmcQuote {
  price: number;
  change24hPct: number;
}

export interface RegimeSignals {
  regime: string;
  riskFlags: string[];
}
