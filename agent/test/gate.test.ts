import assert from "node:assert/strict";
import { test } from "node:test";
import type { PortfolioSnapshot, RiskConfig, Signal } from "../../shared/contract.js";
import { isEligible } from "../src/allowlist.js";
import { evaluate } from "../src/brain.js";
import { initGate, needsQualifyingTrade, shouldHalt, updateGate } from "../src/gate.js";
import { maybeQualify, type Services, type ThrawnState } from "../src/loop.js";
import { mockDataService, mockExecutionService, mockRegistryService } from "../src/mocks.js";

const config: RiskConfig = {
  drawdownCapPct: 30,
  internalHaltPct: 20,
  rearmPct: 10,
  minTradesPerDay: 1,
  perTradeRiskUsd: 50,
  maxNotionalPerTradeUsd: 500,
  slippageBps: 100,
  startingCapitalUsd: 200,
};

const snap = (equityUsd: number): PortfolioSnapshot => ({
  ts: 0,
  equityUsd,
  positions: [],
});

const baseSignal = (over: Partial<Signal>): Signal => ({
  id: 1,
  asset: "ETH",
  direction: "LONG",
  entryPrice: 3000,
  tp1: 3200,
  tp2: null,
  tp3: null,
  sl: 2900,
  leverage: null,
  traderName: "t",
  signalTime: 0,
  confidence: 0.8,
  ...over,
});

test("drawdown is measured from peak equity", () => {
  let gate = initGate(config);
  gate = updateGate(snap(250), gate, config); // new peak 250
  gate = updateGate(snap(225), gate, config); // 10% below peak
  assert.equal(gate.peakEquityUsd, 250);
  assert.equal(gate.currentDrawdownPct, 10);
  assert.equal(gate.halted, false);
});

test("gate trips at the 20% internal halt", () => {
  let gate = initGate(config);
  gate = updateGate(snap(160), gate, config); // 20% below 200 → trip
  assert.equal(gate.halted, true);
  assert.ok(shouldHalt(gate, config));
  assert.match(gate.haltReason ?? "", /internal halt 20%/);
});

test("CRITICAL: halt RE-ARMS once drawdown recovers below rearmPct (no permanent brick)", () => {
  let gate = initGate(config);
  gate = updateGate(snap(160), gate, config); // 20% dd → trip
  assert.equal(gate.halted, true);
  gate = updateGate(snap(175), gate, config); // 12.5% dd (> 10% rearm) → STAY halted (hysteresis)
  assert.equal(gate.halted, true);
  gate = updateGate(snap(190), gate, config); // 5% dd (< 10% rearm) → RE-ARM
  assert.equal(gate.halted, false);
  assert.equal(gate.haltReason, undefined);
  // and a clean signal can EXECUTE again afterwards
  assert.equal(evaluate(baseSignal({}), gate, config).decision, "EXECUTE");
});

test("shouldHalt reads the authoritative halt state, not the rounded drawdown", () => {
  // raw dd 19.9996% is below the 20% trip → not halted, and shouldHalt must agree
  const gate = updateGate(snap(200 - 200 * 0.199996), initGate(config), config);
  assert.equal(gate.halted, false);
  assert.equal(shouldHalt(gate, config), false);
});

test("brain REFUSES an off-allowlist asset", () => {
  const d = evaluate(baseSignal({ asset: "BTC" }), initGate(config), config);
  assert.equal(d.decision, "REFUSE");
  assert.equal(d.refusalReason, "off-allowlist");
});

test("brain REFUSES a low-confidence signal", () => {
  const d = evaluate(baseSignal({ confidence: 0.3 }), initGate(config), config);
  assert.equal(d.decision, "REFUSE");
  assert.equal(d.refusalReason, "low confidence");
});

test("brain REFUSES when the gate is halted", () => {
  let gate = initGate(config);
  gate = updateGate(snap(160), gate, config);
  const d = evaluate(baseSignal({}), gate, config);
  assert.equal(d.decision, "REFUSE");
  assert.equal(d.refusalReason, "drawdown gate");
});

test("brain EXECUTES a clean eligible signal with an open gate", () => {
  const d = evaluate(baseSignal({}), initGate(config), config);
  assert.equal(d.decision, "EXECUTE");
  assert.ok(d.evidenceHash.startsWith("0x"));
  assert.equal(d.evidenceHash.length, 66); // 0x + 32 bytes
});

test("needsQualifyingTrade enforces ≥1 trade/day", () => {
  const gate = initGate(config);
  assert.equal(needsQualifyingTrade(gate, config), true);
  assert.equal(needsQualifyingTrade({ ...gate, tradesToday: 1 }, config), false);
});

test("allowlist is EXACT-match only (case-fold would wrongly accept off-list tokens)", () => {
  assert.equal(isEligible("ETH"), true);
  assert.equal(isEligible("eth"), false); // lowercase is NOT silently accepted
  assert.equal(isEligible("BTC"), false); // genuinely off-list
});

test("brain REFUSES invalid entry price (<=0 / NaN)", () => {
  assert.equal(evaluate(baseSignal({ entryPrice: 0 }), initGate(config), config).refusalReason, "invalid entry");
  assert.equal(evaluate(baseSignal({ entryPrice: -5 }), initGate(config), config).refusalReason, "invalid entry");
  assert.equal(evaluate(baseSignal({ entryPrice: NaN }), initGate(config), config).refusalReason, "invalid entry");
});

test("brain REFUSES malformed confidence outside [0,1]", () => {
  assert.equal(evaluate(baseSignal({ confidence: 1.5 }), initGate(config), config).refusalReason, "malformed confidence");
  assert.equal(evaluate(baseSignal({ confidence: -0.2 }), initGate(config), config).refusalReason, "malformed confidence");
});

test("brain REFUSES a stop on the wrong side of entry", () => {
  // LONG with sl ABOVE entry → risk sits in the profit zone
  assert.equal(evaluate(baseSignal({ direction: "LONG", entryPrice: 3000, sl: 3100 }), initGate(config), config).refusalReason, "invalid stop");
  // SHORT with sl BELOW entry → same defect
  assert.equal(evaluate(baseSignal({ direction: "SHORT", asset: "ETH", entryPrice: 3000, sl: 2900 }), initGate(config), config).refusalReason, "invalid stop");
});

test("maybeQualify places a trade when the ≥1/day quota is unmet, and no-ops once met", async () => {
  const services: Services = {
    data: mockDataService({ CAKE: 2.5 }),
    exec: mockExecutionService(),
    registry: mockRegistryService(),
  };
  const state: ThrawnState = { gate: initGate(config), positions: [] };
  const res = await maybeQualify(state, services, config);
  assert.ok(res, "should place a qualifying trade when tradesToday < min");
  assert.equal(res!.decision.decision, "EXECUTE");
  assert.equal(res!.state.gate.tradesToday, 1);
  assert.equal(res!.executions.length, 1);
  // already met → no-op
  const met = await maybeQualify(res!.state, services, config);
  assert.equal(met, null);
});
