import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { RiskConfig } from "../../shared/contract.js";
import type {
  DashboardDecision,
  DashboardState,
  SponsorStatus,
} from "../../shared/dashboard.js";
import type { ThrawnState } from "./loop.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const STATE_PATH = join(ROOT, "dashboard", "public", "state.json");

/** Read the real on-chain identity proof if it exists (written by register_identity.py). */
function loadIdentity(): DashboardState["identity"] {
  const p = join(ROOT, "proof", "identity-testnet.json");
  if (!existsSync(p)) return null;
  try {
    const j = JSON.parse(readFileSync(p, "utf8"));
    return {
      agentId: j.agentId ?? null,
      agentAddress: j.agentAddress,
      txHash: j.transactionHash ?? null,
      explorerTx: j.explorerTx ?? null,
      explorerAddress: j.explorerAddress ?? "",
      registry: j.registry ?? "",
    };
  } catch {
    return null;
  }
}

export function buildDashboardState(args: {
  mode: "mock" | "live";
  network: string;
  config: RiskConfig;
  state: ThrawnState;
  equityUsd: number;
  decisions: DashboardDecision[];
  sponsors: { cmc: SponsorStatus; trustWallet: SponsorStatus; bnbSdk: SponsorStatus };
  competitionRegistered?: boolean;
}): DashboardState {
  return {
    updatedAt: new Date().toISOString(),
    network: args.network,
    mode: args.mode,
    identity: loadIdentity(),
    risk: {
      drawdownCapPct: args.config.drawdownCapPct,
      internalHaltPct: args.config.internalHaltPct,
      rearmPct: args.config.rearmPct,
      startingCapitalUsd: args.config.startingCapitalUsd,
      minTradesPerDay: args.config.minTradesPerDay,
    },
    gate: args.state.gate,
    equityUsd: args.equityUsd,
    positions: args.state.positions,
    decisions: args.decisions.slice(0, 50),
    sponsors: args.sponsors,
    competition: {
      registered: args.competitionRegistered ?? false,
      contract: "0x212c61b9b72c95d95bf29cf032f5e5635629aed5",
    },
  };
}

/** Writes the snapshot to dashboard/public/state.json (best-effort — never throws into the loop). */
export function writeDashboardState(state: DashboardState): void {
  try {
    writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n");
  } catch {
    /* dashboard/ may not be scaffolded yet — ignore */
  }
}
