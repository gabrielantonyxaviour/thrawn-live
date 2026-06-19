import type { Hex } from "viem";
import type {
  CompetitionService,
  DataService,
  ExecutionService,
  RegistryService,
} from "../../../shared/contract.js";
import type { Services } from "../loop.js";
import {
  mockCompetitionService,
  mockDataService,
  mockExecutionService,
  mockRegistryService,
} from "../mocks.js";
import { cmcDataService } from "./cmc.js";
import { twakCompetitionService } from "./competition.js";
import { decisionRegistryService } from "./decision-registry.js";
import { twakExecutionService } from "./twak.js";
import type { ThrawnMode } from "./types.js";

export interface LiveServices extends Services {
  competition: CompetitionService;
}

/**
 * Selects services by THRAWN_MODE=mock|live. In live mode each edge degrades INDEPENDENTLY to its
 * mock when its dependency (CMC key / TWAK creds / deployed registry) is missing — so the loop
 * never hard-crashes, and `notes` records exactly what ran live vs mock. The brain + gate + loop
 * are unchanged across modes (mock-first contract seam).
 */
export function buildServices(): {
  mode: ThrawnMode;
  services: LiveServices;
  notes: string[];
} {
  const mode = (process.env.THRAWN_MODE ?? "mock") as ThrawnMode;
  const notes: string[] = [];

  if (mode !== "live") {
    return {
      mode: "mock",
      services: {
        data: mockDataService({}),
        exec: mockExecutionService(),
        registry: mockRegistryService(),
        competition: mockCompetitionService(),
      },
      notes: ["THRAWN_MODE=mock — all services mocked"],
    };
  }

  let data: DataService;
  if (process.env.CMC_PRO_API_KEY) {
    data = cmcDataService(process.env.CMC_PRO_API_KEY);
    notes.push("data: CMC (live)");
  } else {
    data = mockDataService({});
    notes.push("data: MOCK (no CMC_PRO_API_KEY)");
  }

  const hasTwak = Boolean(process.env.TWAK_ACCESS_ID && process.env.TWAK_HMAC_SECRET);
  let exec: ExecutionService;
  if (hasTwak) {
    exec = twakExecutionService();
    notes.push("exec: TWAK (live)");
  } else {
    exec = mockExecutionService();
    notes.push("exec: MOCK (no TWAK creds)");
  }

  let registry: RegistryService;
  if (process.env.DECISION_REGISTRY_ADDRESS && process.env.DEPLOYER_PRIVATE_KEY) {
    registry = decisionRegistryService({
      address: process.env.DECISION_REGISTRY_ADDRESS as Hex,
      privateKey: process.env.DEPLOYER_PRIVATE_KEY as Hex,
      rpcUrl: process.env.BSC_RPC_URL ?? "https://bsc-testnet-rpc.publicnode.com",
      chainId: process.env.THRAWN_NETWORK === "bsc-mainnet" ? 56 : 97,
    });
    notes.push("registry: on-chain DecisionRegistry (live)");
  } else {
    registry = mockRegistryService();
    notes.push("registry: MOCK (no DECISION_REGISTRY_ADDRESS)");
  }

  const competition: CompetitionService = hasTwak
    ? twakCompetitionService()
    : mockCompetitionService();

  return { mode: "live", services: { data, exec, registry, competition }, notes };
}
