import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { STABLE_DERISK_TARGETS, type EligibleToken } from "../../shared/contract.js";

/**
 * The eligible-token allowlist (shared/eligible-tokens.json, captured from the live rules page).
 * Trades outside this set DO NOT COUNT — so every candidate is gated through isEligible().
 *
 * CAVEAT: symbol capture is lossy for this competition — symbols collide (e.g. USDf vs USDF are
 * distinct tokens) and the text capture is off-by-one from the canonical 149. We match both
 * exact and case-folded so we never wrongly reject a listed symbol. Phase 2 replaces this with
 * the authoritative set pulled by CONTRACT ADDRESS from the competition contract 0x212c…aed5.
 */
const here = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(
  readFileSync(join(here, "../../shared/eligible-tokens.json"), "utf8"),
) as { tokens: string[] };

const EXACT = new Set(raw.tokens);
const FOLDED = new Set(raw.tokens.map((t) => t.toUpperCase()));

export function isEligible(asset: EligibleToken): boolean {
  return EXACT.has(asset) || FOLDED.has(asset.toUpperCase());
}

export const STABLES = STABLE_DERISK_TARGETS;
export const ELIGIBLE_COUNT = EXACT.size;
