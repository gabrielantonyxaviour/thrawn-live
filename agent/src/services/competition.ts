import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  CompetitionRegistration,
  CompetitionService,
} from "../../../shared/contract.js";

const run = promisify(execFile);

/**
 * Wraps `twak compete register/status` — the Track-1 on-chain registration to the competition
 * contract on BSC MAINNET (hard-coded in twak; no testnet). Run BEFORE Jun 22. The drawdown cap
 * is NOT exposed on-chain (confirmed: absent from the contract ABI), so readDrawdownCapPct → null.
 */
export function twakCompetitionService(opts: { bin?: string; password?: string } = {}): CompetitionService {
  const bin = opts.bin ?? process.env.TWAK_BIN ?? "twak";
  const password = opts.password ?? process.env.TWAK_WALLET_PASSWORD;

  async function compete(args: string[]): Promise<Record<string, unknown>> {
    const { stdout } = await run(bin, ["compete", ...args, "--json"], {
      timeout: 120_000,
      env: password ? { ...process.env, TWAK_WALLET_PASSWORD: password } : process.env,
    });
    return JSON.parse(stdout.trim().split("\n").pop() ?? "{}");
  }

  return {
    async register(agentAddress) {
      const j = await compete(["register"]);
      const registrationTx = (j.txHash ?? j.transactionHash) as `0x${string}`;
      const reg: CompetitionRegistration = {
        agentAddress,
        competitionContract: "0x212c61b9b72c95d95bf29cf032f5e5635629aed5",
        registrationTx,
        registeredAt: new Date().toISOString(),
      };
      return reg;
    },
    async readDrawdownCapPct() {
      return null; // off-chain judging rule — not queryable
    },
  };
}
