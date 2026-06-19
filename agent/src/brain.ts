import type {
  AgentDecision,
  RiskConfig,
  RiskGate,
  Signal,
} from "../../shared/contract.js";
import { isEligible } from "./allowlist.js";
import { evidenceHash } from "./hash.js";

/**
 * The decision engine — the Agora evaluateEvent() veto pattern re-pointed at trade signals.
 * It REFUSES (with a reasoning trace) below threshold and only EXECUTEs a clean, eligible,
 * confident signal when the drawdown gate is open. Every decision carries an evidence hash for
 * the on-chain DecisionRegistry log.
 */
const MIN_CONFIDENCE = Number(process.env.MIN_CONFIDENCE ?? 0.55); // mirrors Agora's qualityScore<55 veto

export function evaluate(
  signal: Signal,
  gate: RiskGate,
  config: RiskConfig,
): AgentDecision {
  const createdAt = new Date().toISOString();
  const baseTrace = [
    `Signal #${signal.id}: ${signal.direction} ${signal.asset} from ${signal.traderName} @ confidence ${(signal.confidence * 100).toFixed(0)}%.`,
    `Portfolio drawdown ${gate.currentDrawdownPct.toFixed(2)}% vs internal halt ${config.internalHaltPct}% / DQ cap ${config.drawdownCapPct}%.`,
  ];

  const refuse = (reason: string, why: string): AgentDecision => ({
    id: `decision-${signal.id}-${Date.parse(createdAt)}`,
    signalId: signal.id,
    decision: "REFUSE",
    reasoningTrace: [...baseTrace, why],
    refusalReason: reason,
    evidenceHash: evidenceHash({ signal, gate, reason }),
    createdAt,
  });

  if (gate.halted)
    return refuse(
      "drawdown gate",
      "Gate HALTED — refusing new risk-on entries until de-risked / recovered.",
    );
  if (!isEligible(signal.asset))
    return refuse(
      "off-allowlist",
      `${signal.asset} is not in the eligible set — the trade would not count.`,
    );
  if (
    signal.entryPrice == null ||
    !Number.isFinite(signal.entryPrice) ||
    signal.entryPrice <= 0
  )
    return refuse(
      "invalid entry",
      `Entry price ${signal.entryPrice} is missing or non-positive — cannot size.`,
    );
  if (
    !Number.isFinite(signal.confidence) ||
    signal.confidence < 0 ||
    signal.confidence > 1
  )
    return refuse(
      "malformed confidence",
      `Confidence ${signal.confidence} is outside [0,1] — treating the signal as malformed.`,
    );
  if (signal.confidence < MIN_CONFIDENCE)
    return refuse(
      "low confidence",
      `Confidence ${(signal.confidence * 100).toFixed(0)}% below ${(MIN_CONFIDENCE * 100).toFixed(0)}% threshold.`,
    );
  if (signal.sl != null) {
    const wrongSide =
      signal.direction === "LONG"
        ? signal.sl >= signal.entryPrice
        : signal.sl <= signal.entryPrice;
    if (wrongSide)
      return refuse(
        "invalid stop",
        `SL ${signal.sl} is on the wrong side of entry ${signal.entryPrice} for a ${signal.direction} — risk would sit in the profit zone.`,
      );
  }

  return {
    id: `decision-${signal.id}-${Date.parse(createdAt)}`,
    signalId: signal.id,
    decision: "EXECUTE",
    reasoningTrace: [
      ...baseTrace,
      `Cleared all vetoes — EXECUTE ${signal.direction} ${signal.asset} on PancakeSwap (spot).`,
    ],
    evidenceHash: evidenceHash({ signal, gate, decision: "EXECUTE" }),
    createdAt,
  };
}
