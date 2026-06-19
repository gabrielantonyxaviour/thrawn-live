import type { AgentDecision, Execution, OpenPosition, RiskGate } from "./contract.js";

/** The snapshot the agent emits and the dashboard renders. One JSON file = the whole UI state. */
export type SponsorStatus = "live" | "mock" | "pending";

export interface DashboardDecision extends AgentDecision {
  executions: Execution[];
}

export interface DashboardState {
  updatedAt: string; // ISO
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
  gate: RiskGate;
  equityUsd: number;
  positions: OpenPosition[];
  decisions: DashboardDecision[]; // most-recent-first
  sponsors: { cmc: SponsorStatus; trustWallet: SponsorStatus; bnbSdk: SponsorStatus };
  competition: { registered: boolean; contract: string };
}
