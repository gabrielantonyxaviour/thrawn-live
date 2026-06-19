import type { DataService, EligibleToken } from "../../../shared/contract.js";
import type { CmcQuote, RegimeSignals } from "./types.js";

/**
 * CMC Agent Hub DataService — the scored data layer, on the FREE Basic REST tier.
 *   base https://pro-api.coinmarketcap.com, header X-CMC_PRO_API_KEY.
 * quotes/latest accepts comma-separated symbols and costs 1 credit regardless of count, so we
 * batch the watchlist. A 60s cache mirrors trading/src/api/server.ts. Errors are SURFACED
 * (401/402/429), never swallowed to a silent 0 — a 0 price would oversize a position.
 */
const BASE = process.env.CMC_BASE_URL ?? "https://pro-api.coinmarketcap.com";
const CACHE_TTL_MS = 60_000;

/** Pure parser (unit-testable without network): CMC quotes/latest JSON → {SYMBOL: quote}. */
export function parseQuotesResponse(json: unknown): Record<string, CmcQuote> {
  const out: Record<string, CmcQuote> = {};
  const data = (json as { data?: Record<string, unknown> })?.data;
  if (!data) return out;
  for (const [sym, entry] of Object.entries(data)) {
    // `data[SYM]` can be an object or (when CMC disambiguates) an array of listings.
    const rec = Array.isArray(entry) ? entry[0] : entry;
    const usd = (rec as { quote?: { USD?: { price?: number; percent_change_24h?: number } } })?.quote
      ?.USD;
    if (usd && typeof usd.price === "number") {
      out[sym.toUpperCase()] = {
        price: usd.price,
        change24hPct: usd.percent_change_24h ?? 0,
      };
    }
  }
  return out;
}

/** Coarse market regime from the Fear & Greed index value (0–100). */
export function regimeFromFearGreed(value: number): RegimeSignals {
  const regime =
    value < 25 ? "extreme-fear"
    : value < 45 ? "fear"
    : value < 55 ? "neutral"
    : value < 75 ? "greed"
    : "extreme-greed";
  const riskFlags = value >= 78 ? ["overheated"] : value <= 22 ? ["capitulation"] : [];
  return { regime, riskFlags };
}

export function cmcDataService(apiKey: string): DataService {
  const cache = new Map<string, { quote: CmcQuote; ts: number }>();

  async function call(path: string): Promise<unknown> {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "X-CMC_PRO_API_KEY": apiKey, Accept: "application/json" },
    });
    if (res.status === 401 || res.status === 402)
      throw new Error(`CMC auth/plan error ${res.status} — check CMC_PRO_API_KEY / plan tier`);
    if (res.status === 429) throw new Error("CMC rate limited (429) — back off");
    if (!res.ok) throw new Error(`CMC ${res.status} for ${path}`);
    return res.json();
  }

  async function refresh(symbols: string[]): Promise<void> {
    const json = await call(
      `/v1/cryptocurrency/quotes/latest?symbol=${symbols.join(",")}&convert=USD`,
    );
    const parsed = parseQuotesResponse(json);
    const now = Date.now();
    for (const [sym, q] of Object.entries(parsed)) cache.set(sym, { quote: q, ts: now });
  }

  async function quote(asset: EligibleToken): Promise<CmcQuote> {
    const key = asset.toUpperCase();
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.quote;
    await refresh([asset]);
    const fresh = cache.get(key);
    if (!fresh) throw new Error(`CMC: no quote returned for ${asset}`);
    return fresh.quote;
  }

  return {
    async getPrice(asset) {
      return (await quote(asset)).price;
    },
    async getMarket(asset) {
      return quote(asset);
    },
    async getRegimeSignals() {
      try {
        const json = (await call(`/v3/fear-and-greed/latest`)) as {
          data?: { value?: number };
        };
        return regimeFromFearGreed(json.data?.value ?? 50);
      } catch {
        return { regime: "unknown", riskFlags: [] };
      }
    },
  };
}
