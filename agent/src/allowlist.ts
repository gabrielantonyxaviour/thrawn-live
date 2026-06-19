import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { STABLE_DERISK_TARGETS, type EligibleToken } from "../../shared/contract.js";

/**
 * The eligible-token allowlist (shared/eligible-tokens.json, captured from the live rules page).
 * Trades outside this set DO NOT COUNT — so every candidate is gated through isEligible().
 *
 * EXACT-MATCH ONLY. Case-folding is deliberately NOT used: the set contains fold-collisions
 * (USDf vs USDF are distinct tokens), and a tolerant match would wrongly ACCEPT an off-allowlist
 * token — executing a trade that DOES NOT COUNT and wastes capital. Signals must carry canonical
 * tickers. Phase 2 replaces this with the authoritative set pulled by CONTRACT ADDRESS from the
 * competition contract 0x212c…aed5 (the only collision-proof source).
 */
const here = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(
  readFileSync(join(here, "../../shared/eligible-tokens.json"), "utf8"),
) as { tokens: string[] };

const EXACT = new Set(raw.tokens);

export function isEligible(asset: EligibleToken): boolean {
  return EXACT.has(asset);
}

export const STABLES = STABLE_DERISK_TARGETS;
export const ELIGIBLE_COUNT = EXACT.size;
