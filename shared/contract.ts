/**
 * Thrawn Live — shared contract (the seam between signal brain, risk gate, decision engine,
 * and on-chain execution). Seed derived from REAL code:
 *   ~/Documents/trading/src/parser/signal.ts, src/market/outcome.ts, src/paper/sizing.ts
 *   ~/Documents/hackathons/agora-agents-hackathon/.../src/lib/{agent,types}.ts + DecisionRegistry.sol
 *
 * Thrawn Live is POLYGLOT: Python (bnbagent ERC-8004 identity, one-shot) + TS (live decision
 * loop, signer/executor, analyzer brain). This contract defines the process boundary.
 *
 * Verified against the LIVE DoraHacks rules page on 2026-06-19 (see FACTS.md):
 *  - PRIMARY signer = Trust Wallet Agent Kit (@trustwallet/cli), Agent Wallet mode — NOT OKX.
 *  - CMC Agent Hub is the scored data layer (REST/MCP/x402).
 *  - Track-1 registration is via TWAK (`twak compete register`), writing to the competition
 *    contract 0x212c61b9b72c95d95bf29cf032f5e5635629aed5 on BSC. This is SEPARATE from the
 *    bnbagent ERC-8004 identity (which is a sponsor-scoring action, not the comp entry).
 *  - The max-drawdown cap is NOT publicly pinned — the rules say only "for example 30%".
 *    It is enforced by the competition contract. Treat it as runtime config; halt BELOW it.
 */

// ────────────────────────────────────────────────────────────────────────────
// Eligibility — the fixed 149-token BEP-20 allowlist. Trades outside DO NOT COUNT.
// The authoritative list lives in shared/eligible-tokens.json (captured from the
// live rules page). Re-confirm against the competition contract at registration.
// ────────────────────────────────────────────────────────────────────────────
export type EligibleToken = string; // BEP-20 ticker, must be in eligible-tokens.json
export const STABLE_DERISK_TARGETS = ["USDT", "USDC", "DAI", "FDUSD", "TUSD"] as const;

// ────────────────────────────────────────────────────────────────────────────
// Signal — output of the analyzer brain (trading/src). 17-channel labeled caller alpha.
// ────────────────────────────────────────────────────────────────────────────
export interface Signal {
  id: number;
  asset: EligibleToken; // must resolve to the allowlist or it's vetoed pre-trade
  direction: "LONG" | "SHORT";
  entryPrice: number | null;
  tp1: number | null;
  tp2: number | null;
  tp3: number | null;
  sl: number | null;
  leverage: number | null;
  traderName: string;
  signalTime: number; // unix ms
  confidence: number; // 0–1 (performance-weighted by the caller's historical hit-rate)
}

// from calculatePositionSize(entryPrice, sl, riskUsd=50)
export interface PositionSize {
  positionUnits: number;
  notionalUsd: number;
  impliedLeverage: number;
  riskUsd: number; // default 50
}

// ────────────────────────────────────────────────────────────────────────────
// Risk — the anti-DQ edge. Two thresholds, deliberately separated:
//   drawdownCapPct   = the OFFICIAL DQ cap (config; default 30, "e.g." only — read from
//                      the competition contract / `twak compete` at registration).
//   internalHaltPct  = OUR conservative trip-wire, strictly < cap. When portfolio drawdown
//                      from peak crosses this, we de-risk to stables and refuse new entries.
// Scoring is hour-by-hour total return; drawdown is measured from PEAK equity, portfolio-wide
// (not per-position). The outcome.ts excursion math informs SL placement; this gate is the DQ
// metric and operates on PortfolioSnapshot history.
// ────────────────────────────────────────────────────────────────────────────
export interface RiskConfig {
  drawdownCapPct: number; // official DQ cap (default 30; confirm at registration)
  internalHaltPct: number; // our halt, < cap (e.g. 20). The "never blow up" margin.
  minTradesPerDay: number; // 1 (7 over the week) — qualification minimum
  perTradeRiskUsd: number; // -> calculatePositionSize riskUsd
  maxNotionalPerTradeUsd: number;
  slippageBps: number;
  startingCapitalUsd: number; // must keep portfolio > $1 every hour to be scored
}

export interface OpenPosition {
  asset: EligibleToken;
  side: "BUY" | "SELL";
  entryPrice: number;
  units: number;
  notionalUsd: number;
  txHash?: `0x${string}`;
}

export interface PortfolioSnapshot {
  ts: number; // unix ms; sampled ≥ hourly (matches the hourly scoring cadence)
  equityUsd: number; // total portfolio value in USD
  positions: OpenPosition[];
}

export interface RiskGate {
  peakEquityUsd: number; // running peak — drawdown is measured from here
  currentEquityUsd: number;
  currentDrawdownPct: number; // (peak - current) / peak * 100
  tradesToday: number; // must end each UTC day ≥ minTradesPerDay
  halted: boolean; // true once internalHaltPct is crossed
  haltReason?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Decision — from the Agora evaluateEvent() veto pattern. EXECUTE / REFUSE / DERISK.
// Every decision carries a reasoning trace + evidence hash, logged to DecisionRegistry.
// ────────────────────────────────────────────────────────────────────────────
export interface AgentDecision {
  id: string;
  signalId: number | null; // null for a gate-initiated DERISK with no source signal
  decision: "EXECUTE" | "REFUSE" | "DERISK";
  reasoningTrace: string[];
  refusalReason?: string; // set when REFUSE (e.g. "drawdown gate", "off-allowlist", "low confidence")
  evidenceHash: `0x${string}`; // logged to DecisionRegistry.sol on BSC
  createdAt: string; // ISO
}

export interface Execution {
  decisionId: string;
  asset: EligibleToken;
  side: "BUY" | "SELL";
  size: PositionSize;
  venue: "pancakeswap" | "bsc-perps"; // named Track-1 venues
  signer: "trust-wallet-agent-kit";
  txHash?: `0x${string}`; // BSC
  status: "pending" | "filled" | "failed";
}

// ────────────────────────────────────────────────────────────────────────────
// On-chain identity vs competition registration — TWO distinct actions.
// ────────────────────────────────────────────────────────────────────────────
export interface AgentIdentity {
  // BNB AI Agent SDK (Python bnbagent, ERC-8004). Sponsor-scoring identity for the agent
  // wallet. Gas-free on BSC testnet via MegaFuel; small gas on mainnet.
  agentId: string; // ERC-8004 agentId
  agentAddress: `0x${string}`; // the TWAK Agent Wallet address
  identityTx: `0x${string}`;
  chain: "bsc-mainnet" | "bsc-testnet";
  registeredAt: string;
}

export interface CompetitionRegistration {
  // `twak compete register` / MCP competition_register -> the competition contract.
  // This is the on-chain proof required by Track 1. MUST land before Jun 22 (trading open).
  agentAddress: `0x${string}`;
  competitionContract: "0x212c61b9b72c95d95bf29cf032f5e5635629aed5";
  registrationTx: `0x${string}`;
  registeredAt: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Service seams (mock first, then wire sponsor tools). The live loop (TS) owns all of
// these except IdentityService, which is fulfilled once by the Python bnbagent process.
// ────────────────────────────────────────────────────────────────────────────
export interface DataService {
  // CMC Agent Hub (scored data layer): pro-api.coinmarketcap.com, X-CMC_PRO_API_KEY.
  // x402 variant pays per call (keyless) — scores the TWAK rubric's "native x402" points.
  getPrice(asset: EligibleToken): Promise<number>;
  getMarket(asset: EligibleToken): Promise<{ price: number; change24hPct: number }>;
  getRegimeSignals?(): Promise<{ regime: string; riskFlags: string[] }>; // optional CMC pre-computed signals
}

export interface BrainService {
  // signal brain (trading/src) -> a gated decision. The risk gate can veto here.
  evaluate(signal: Signal, gate: RiskGate, config: RiskConfig): AgentDecision;
}

export interface RiskService {
  // Portfolio drawdown-from-peak, updated ≥ hourly. shouldHalt trips at internalHaltPct.
  updateGate(snapshot: PortfolioSnapshot, prev: RiskGate, config: RiskConfig): RiskGate;
  shouldHalt(gate: RiskGate, config: RiskConfig): boolean;
  needsQualifyingTrade(gate: RiskGate, config: RiskConfig, nowUtcMs: number): boolean; // ≥1/day guard
}

export interface TradeOrder {
  asset: EligibleToken;
  side: "BUY" | "SELL";
  size: PositionSize;
  venue: Execution["venue"];
}

export interface ExecutionService {
  // PRIMARY signer = Trust Wallet Agent Kit (Agent Wallet mode). Sole execution layer.
  // Takes an explicit order because AgentDecision only references a signalId, not what to trade.
  execute(decision: AgentDecision, order: TradeOrder): Promise<Execution>;
  derisk(positions: OpenPosition[]): Promise<Execution[]>; // emergency swap to stables
}

export interface RegistryService {
  // DecisionRegistry.sol on BSC — recordDecision(id, kind, evidenceHash, amount).
  record(decision: AgentDecision, notionalOrConfidence: number): Promise<`0x${string}`>;
}

export interface IdentityService {
  // Fulfilled by the Python bnbagent process (one-shot at setup). Output consumed by the TS loop.
  registerIdentity(agentAddress: `0x${string}`): Promise<AgentIdentity>;
}

export interface CompetitionService {
  // Wraps `twak compete register`. Confirms the official drawdownCapPct if the tooling exposes it.
  register(agentAddress: `0x${string}`): Promise<CompetitionRegistration>;
  readDrawdownCapPct?(): Promise<number | null>; // null if not exposed -> fall back to config default
}
