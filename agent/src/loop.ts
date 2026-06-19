import type {
  AgentDecision,
  DataService,
  Execution,
  ExecutionService,
  OpenPosition,
  PortfolioSnapshot,
  PositionSize,
  RegistryService,
  RiskConfig,
  RiskGate,
  Signal,
  TradeOrder,
} from "../../shared/contract.js";
import { STABLES } from "./allowlist.js";
import { evaluate } from "./brain.js";
import { MIN_TRADE_NOTIONAL_USD, QUALIFYING_ASSET } from "./config.js";
import { needsQualifyingTrade, shouldHalt, updateGate } from "./gate.js";
import { evidenceHash } from "./hash.js";
import { calculatePositionSize } from "./sizing.js";

export interface ThrawnState {
  gate: RiskGate;
  positions: OpenPosition[];
}

export interface Services {
  data: DataService;
  exec: ExecutionService;
  registry: RegistryService;
}

export interface TickResult {
  decision: AgentDecision;
  executions: Execution[];
  registryTx: `0x${string}`[];
  state: ThrawnState;
}

/**
 * One decision tick: refresh the gate from the latest portfolio snapshot, then either
 *   (1) DERISK to stables if the drawdown halt is tripped (counts as the day's trade), or
 *   (2) evaluate an incoming signal through the veto brain and EXECUTE if it clears.
 * Every decision (EXECUTE / REFUSE / DERISK) is logged to the DecisionRegistry for provenance.
 */
export async function runTick(
  state: ThrawnState,
  signal: Signal | null,
  snapshot: PortfolioSnapshot,
  services: Services,
  config: RiskConfig,
): Promise<TickResult> {
  const gate = updateGate(snapshot, state.gate, config);
  const executions: Execution[] = [];
  const registryTx: `0x${string}`[] = [];

  // (1) Drawdown halt → de-risk to stables.
  if (shouldHalt(gate, config) && state.positions.length > 0) {
    const decision: AgentDecision = {
      id: `derisk-${Date.now()}`,
      signalId: null,
      decision: "DERISK",
      reasoningTrace: [
        `Portfolio drawdown ${gate.currentDrawdownPct.toFixed(2)}% ≥ internal halt ${config.internalHaltPct}%.`,
        `De-risking ${state.positions.length} position(s) to stables to protect the ${config.drawdownCapPct}% DQ cap.`,
      ],
      refusalReason: gate.haltReason,
      evidenceHash: evidenceHash({ gate, positions: state.positions }),
      createdAt: new Date().toISOString(),
    };
    executions.push(...(await services.exec.derisk(state.positions)));
    registryTx.push(await services.registry.record(decision, gate.currentEquityUsd));
    return {
      decision,
      executions,
      registryTx,
      state: { gate: { ...gate, tradesToday: gate.tradesToday + 1 }, positions: [] },
    };
  }

  // (2a) No signal this tick → idle, but record the gate state.
  if (!signal) {
    const decision: AgentDecision = {
      id: `idle-${Date.now()}`,
      signalId: null,
      decision: "REFUSE",
      reasoningTrace: [
        `No signal this tick. Drawdown ${gate.currentDrawdownPct.toFixed(2)}%, trades today ${gate.tradesToday}.`,
      ],
      refusalReason: "no signal",
      evidenceHash: evidenceHash({ gate, idle: true }),
      createdAt: new Date().toISOString(),
    };
    return { decision, executions, registryTx, state: { gate, positions: state.positions } };
  }

  // (2b) Evaluate the signal through the veto brain.
  const decision = evaluate(signal, gate, config);
  registryTx.push(await services.registry.record(decision, signal.confidence));

  if (decision.decision !== "EXECUTE" || signal.entryPrice == null) {
    return { decision, executions, registryTx, state: { gate, positions: state.positions } };
  }

  // (2c) Size (capped at maxNotional) + execute on PancakeSwap spot.
  let size = calculatePositionSize(signal.entryPrice, signal.sl, config.perTradeRiskUsd);
  if (size.notionalUsd > config.maxNotionalPerTradeUsd) {
    const scale = config.maxNotionalPerTradeUsd / size.notionalUsd;
    size = {
      positionUnits: size.positionUnits * scale,
      notionalUsd: config.maxNotionalPerTradeUsd,
      impliedLeverage: config.maxNotionalPerTradeUsd / size.riskUsd,
      riskUsd: size.riskUsd,
    };
  }
  const order: TradeOrder = {
    asset: signal.asset,
    side: signal.direction === "LONG" ? "BUY" : "SELL",
    size,
    venue: "pancakeswap",
  };
  const execution = await services.exec.execute(decision, order);
  executions.push(execution);

  const positions: OpenPosition[] = [
    ...state.positions,
    {
      asset: order.asset,
      side: order.side,
      entryPrice: signal.entryPrice,
      units: size.positionUnits,
      notionalUsd: size.notionalUsd,
      txHash: execution.txHash,
    },
  ];
  return {
    decision,
    executions,
    registryTx,
    state: { gate: { ...gate, tradesToday: gate.tradesToday + 1 }, positions },
  };
}

/**
 * Satisfies the ≥1-trade/day qualification on an otherwise quiet or halted day. When the gate is
 * HALTED we route a RISK-NEUTRAL stable→stable swap (no new directional exposure); otherwise a
 * minimal eligible position. Counts as the day's trade. This is the fallback that prevents a
 * silent ≥1/day DQ — the bug the re-arm fix and this path together close.
 */
export async function placeQualifyingTrade(
  state: ThrawnState,
  services: Services,
  config: RiskConfig,
): Promise<TickResult> {
  const halted = state.gate.halted;
  const size: PositionSize = {
    positionUnits: 0,
    notionalUsd: MIN_TRADE_NOTIONAL_USD,
    impliedLeverage: 1,
    riskUsd: MIN_TRADE_NOTIONAL_USD,
  };
  const order: TradeOrder = {
    asset: halted ? (STABLES[1] ?? STABLES[0]) : QUALIFYING_ASSET,
    side: "BUY",
    size,
    venue: "pancakeswap",
  };
  const decision: AgentDecision = {
    id: `qualify-${Date.now()}`,
    signalId: null,
    decision: "EXECUTE",
    reasoningTrace: [
      `Placing a minimal qualifying trade to satisfy ≥${config.minTradesPerDay} trade/day (halted=${halted}).`,
      halted
        ? `Halted → risk-neutral stable→${order.asset} swap, no new directional exposure.`
        : `Open → minimal ${order.asset} position ($${MIN_TRADE_NOTIONAL_USD}).`,
    ],
    evidenceHash: evidenceHash({ qualify: true, halted, asset: order.asset }),
    createdAt: new Date().toISOString(),
  };
  const execution = await services.exec.execute(decision, order);
  const registryTx = [await services.registry.record(decision, size.notionalUsd)];
  return {
    decision,
    executions: [execution],
    registryTx,
    // Minimal/neutral — not tracked as a risk position.
    state: { gate: { ...state.gate, tradesToday: state.gate.tradesToday + 1 }, positions: state.positions },
  };
}

/** Daemon hook: if the ≥1-trade/day quota is unmet, place the qualifying trade; else no-op. */
export async function maybeQualify(
  state: ThrawnState,
  services: Services,
  config: RiskConfig,
): Promise<TickResult | null> {
  if (!needsQualifyingTrade(state.gate, config)) return null;
  return placeQualifyingTrade(state, services, config);
}
