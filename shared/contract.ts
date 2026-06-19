/**
 * Thrawn Live — shared contract (the seam between signal brain, risk gate, decision engine,
 * and on-chain execution). Seed derived from REAL code:
 *   ~/Documents/trading/src/parser/signal.ts, src/market/outcome.ts, src/paper/sizing.ts
 *   ~/Documents/hackathons/agora-agents-hackathon/.../src/lib/types.ts + DecisionRegistry.sol
 *
 * Thrawn Live is POLYGLOT: Python (bnbagent identity) + TS (signer/executor + analyzer).
 * This contract defines the process boundary. Bind the PRIMARY signer to Trust Wallet Agent
 * Kit (TS, @trustwallet/cli) — NOT OKX. CMC Agent Hub is the scored data layer.
 */

export interface Signal {
  id: number;
  asset: string; // "BTC", "BNB", ...
  direction: "LONG" | "SHORT";
  entryPrice: number | null;
  tp1: number | null;
  tp2: number | null;
  tp3: number | null;
  sl: number | null;
  leverage: number | null;
  traderName: string;
  signalTime: number; // unix ms
  confidence: number; // 0–1
}

// from calculatePositionSize(entryPrice, sl, riskUsd=50)
export interface PositionSize {
  positionUnits: number;
  notionalUsd: number;
  impliedLeverage: number;
  riskUsd: number; // default 50
}

/**
 * The anti-DQ edge. currentDrawdownPct is fed live by the outcome.ts excursion math
 * (max-loss excursion). If currentDrawdownPct >= maxDrawdownPct → halt → veto all execution.
 * CONFIRM the exact maxDrawdownPct on the DoraHacks rules page (press only says "e.g. 30%").
 */
export interface RiskGate {
  maxDrawdownPct: number;
  currentDrawdownPct: number;
  tradesToday: number; // must stay ≥ 1/day
  halted: boolean;
}

// from agora types.ts (decision renamed CREATE/REFUSE_MARKET -> EXECUTE/REFUSE)
export interface AgentDecision {
  id: string;
  signalId: number;
  decision: "EXECUTE" | "REFUSE";
  reasoningTrace: string[];
  refusalReason?: string;
  evidenceHash: `0x${string}`; // logged to DecisionRegistry.sol on BSC
  createdAt: string; // ISO
}

export interface Execution {
  decisionId: string;
  asset: string;
  side: "BUY" | "SELL";
  size: PositionSize;
  signer: "trust-wallet-agent-kit";
  txHash?: `0x${string}`; // BSC
  status: "pending" | "filled" | "failed";
}

// ---- Service seams (mock first, then wire sponsor tools) ----

export interface DataService {
  // CMC Agent Hub (scored data layer): pro-api.coinmarketcap.com, X-CMC_PRO_API_KEY
  getPrice(asset: string): Promise<number>;
  getMarket(asset: string): Promise<{ price: number; change24hPct: number }>;
}

export interface BrainService {
  // signal brain (trading/src) -> decision, gated by risk
  evaluate(signal: Signal, gate: RiskGate): AgentDecision;
}

export interface RiskService {
  // outcome.ts excursion math fed live
  updateDrawdown(openPositions: Execution[]): Promise<RiskGate>;
  shouldHalt(gate: RiskGate): boolean;
}

export interface ExecutionService {
  // PRIMARY signer = Trust Wallet Agent Kit (Agent Wallet mode)
  execute(decision: AgentDecision, size: PositionSize): Promise<Execution>;
}

export interface RegistryService {
  // DecisionRegistry.sol on BSC — recordDecision(id, kind, evidenceHash, amount)
  record(decision: AgentDecision, notionalOrConfidence: number): Promise<`0x${string}`>;
}

export interface AgentIdentity {
  // BNB AI Agent SDK (Python bnbagent, ERC-8004). Track-1 on-chain registration.
  agentAddress: `0x${string}`;
  registrationTx: `0x${string}`;
  registeredAt: string;
}
