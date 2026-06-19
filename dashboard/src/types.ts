// Mirrors shared/dashboard.ts (the snapshot the agent emits to public/state.json).
export type SponsorStatus = "live" | "mock" | "pending";

export interface Execution {
  decisionId: string;
  asset: string;
  side: "BUY" | "SELL";
  size: { positionUnits: number; notionalUsd: number; impliedLeverage: number; riskUsd: number };
  venue: string;
  signer: string;
  txHash?: string;
  status: "pending" | "filled" | "failed";
}

export interface DashboardDecision {
  id: string;
  signalId: number | null;
  decision: "EXECUTE" | "REFUSE" | "DERISK";
  reasoningTrace: string[];
  refusalReason?: string;
  evidenceHash: string;
  createdAt: string;
  executions: Execution[];
}

export interface OpenPosition {
  asset: string;
  side: "BUY" | "SELL";
  entryPrice: number;
  units: number;
  notionalUsd: number;
  txHash?: string;
}

export interface DashboardState {
  updatedAt: string;
  network: string;
  mode: "mock" | "live";
  identity: {
    agentId: number | null;
    agentAddress: string;
    txHash: string | null;
    explorerTx: string | null;
    explorerAddress: string;
    registry: string;
  } | null;
  risk: {
    drawdownCapPct: number;
    internalHaltPct: number;
    rearmPct: number;
    startingCapitalUsd: number;
    minTradesPerDay: number;
  };
  gate: {
    peakEquityUsd: number;
    currentEquityUsd: number;
    currentDrawdownPct: number;
    tradesToday: number;
    halted: boolean;
    haltReason?: string;
  };
  equityUsd: number;
  positions: OpenPosition[];
  decisions: DashboardDecision[];
  sponsors: { cmc: SponsorStatus; trustWallet: SponsorStatus; bnbSdk: SponsorStatus };
  competition: { registered: boolean; contract: string };
}
