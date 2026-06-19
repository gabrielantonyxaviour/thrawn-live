import type {
  AgentDecision,
  CompetitionRegistration,
  CompetitionService,
  DataService,
  Execution,
  ExecutionService,
  IdentityService,
  OpenPosition,
  RegistryService,
  TradeOrder,
} from "../../shared/contract.js";

/**
 * Mock implementations of every external-IO service seam, so the full decision loop runs
 * end-to-end on fake data with $0 and zero network. The brain + gate are REAL (not mocked) —
 * only the things that touch CMC / TWAK / chain are stubbed here. Phase 2 swaps these for the
 * real adapters behind the identical contract.
 */
const fakeTx = (prefix: number) => {
  let n = 0;
  return () =>
    `0x${(prefix.toString(16) + (++n).toString(16).padStart(2, "0")).padEnd(64, "0")}` as `0x${string}`;
};

export function mockDataService(prices: Record<string, number>): DataService {
  const px = (a: string) => prices[a.toUpperCase()] ?? 0;
  return {
    async getPrice(asset) {
      return px(asset);
    },
    async getMarket(asset) {
      return { price: px(asset), change24hPct: 0 };
    },
  };
}

export function mockExecutionService(): ExecutionService {
  const tx = fakeTx(0xe);
  return {
    async execute(decision: AgentDecision, order: TradeOrder): Promise<Execution> {
      return {
        decisionId: decision.id,
        asset: order.asset,
        side: order.side,
        size: order.size,
        venue: order.venue,
        signer: "trust-wallet-agent-kit",
        txHash: tx(),
        status: "filled",
      };
    },
    async derisk(positions: OpenPosition[]): Promise<Execution[]> {
      return positions.map((p) => ({
        decisionId: "derisk",
        asset: p.asset,
        side: p.side === "BUY" ? "SELL" : "BUY",
        size: {
          positionUnits: p.units,
          notionalUsd: p.notionalUsd,
          impliedLeverage: 1,
          riskUsd: 0,
        },
        venue: "pancakeswap",
        signer: "trust-wallet-agent-kit",
        txHash: tx(),
        status: "filled",
      }));
    },
  };
}

export function mockRegistryService(): RegistryService {
  const tx = fakeTx(0xab);
  return {
    async record(_decision, _amount) {
      return tx();
    },
  };
}

export function mockIdentityService(address: `0x${string}`): IdentityService {
  const tx = fakeTx(0x1d);
  return {
    async registerIdentity(agentAddress) {
      return {
        agentId: "mock-erc8004-1",
        agentAddress: agentAddress ?? address,
        identityTx: tx(),
        chain: "bsc-testnet",
        registeredAt: new Date().toISOString(),
      };
    },
  };
}

export function mockCompetitionService(): CompetitionService {
  const tx = fakeTx(0xc0);
  return {
    async register(agentAddress): Promise<CompetitionRegistration> {
      return {
        agentAddress,
        competitionContract: "0x212c61b9b72c95d95bf29cf032f5e5635629aed5",
        registrationTx: tx(),
        registeredAt: new Date().toISOString(),
      };
    },
    async readDrawdownCapPct() {
      return null; // not exposed by the mock → loop falls back to config default
    },
  };
}
