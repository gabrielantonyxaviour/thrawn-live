import assert from "node:assert/strict";
import { test } from "node:test";
import type { PortfolioSnapshot, RiskConfig, Signal } from "../../shared/contract.js";
import { evaluate } from "../src/brain.js";
import { initGate, needsQualifyingTrade, shouldHalt, updateGate } from "../src/gate.js";

const config: RiskConfig = {
  drawdownCapPct: 30,
  internalHaltPct: 20,
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

test("gate trips at the 20% internal halt and stays sticky", () => {
  let gate = initGate(config);
  gate = updateGate(snap(160), gate, config); // 20% below 200 → trip
  assert.equal(gate.halted, true);
  assert.ok(shouldHalt(gate, config));
  assert.match(gate.haltReason ?? "", /internal halt 20%/);
  // recovery does NOT silently un-halt
  gate = updateGate(snap(200), gate, config);
  assert.equal(gate.halted, true);
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
