import assert from "node:assert/strict";
import { test } from "node:test";
import { parseQuotesResponse, regimeFromFearGreed } from "../src/services/cmc.js";
import { momentumConfidence } from "../src/services/signal-source.js";

test("parseQuotesResponse extracts price + 24h change (object and array shapes)", () => {
  const json = {
    data: {
      ETH: { quote: { USD: { price: 3000.5, percent_change_24h: 4.2 } } },
      CAKE: [{ quote: { USD: { price: 2.5, percent_change_24h: -1.1 } } }], // array (CMC disambiguation)
      BROKEN: { quote: {} },
    },
  };
  const out = parseQuotesResponse(json);
  assert.equal(out.ETH.price, 3000.5);
  assert.equal(out.ETH.change24hPct, 4.2);
  assert.equal(out.CAKE.price, 2.5);
  assert.equal(out.CAKE.change24hPct, -1.1);
  assert.equal(out.BROKEN, undefined); // malformed entry skipped, not a silent 0
});

test("regimeFromFearGreed maps value → regime + risk flags", () => {
  assert.equal(regimeFromFearGreed(10).regime, "extreme-fear");
  assert.deepEqual(regimeFromFearGreed(10).riskFlags, ["capitulation"]);
  assert.equal(regimeFromFearGreed(50).regime, "neutral");
  assert.equal(regimeFromFearGreed(90).regime, "extreme-greed");
  assert.deepEqual(regimeFromFearGreed(90).riskFlags, ["overheated"]);
});

test("momentumConfidence: below threshold → 0, scales with momentum, haircut on risk flags", () => {
  const calm = { regime: "neutral", riskFlags: [] as string[] };
  assert.equal(momentumConfidence(2, 3, 1, calm), 0); // below threshold
  const c = momentumConfidence(9, 3, 1, calm); // 3× threshold → momentumScore 1
  assert.equal(c, 1);
  // overheated regime haircuts to 0.6
  assert.equal(momentumConfidence(9, 3, 1, { regime: "greed", riskFlags: ["overheated"] }), 0.6);
  // caller weight scales down
  assert.equal(momentumConfidence(9, 3, 0.5, calm), 0.5);
});
