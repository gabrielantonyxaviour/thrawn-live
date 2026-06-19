import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  Execution,
  ExecutionService,
} from "../../../shared/contract.js";

const run = promisify(execFile);

/**
 * Trust Wallet Agent Kit ExecutionService — the PRIMARY signer, sole execution layer.
 * Drives `twak swap` (PancakeSwap spot on BSC) via subprocess; never fabricates a tx hash.
 *   BUY  asset → `twak swap --usd <notionalUsd> <stable> <asset>`  (spend USD-equiv of the stable)
 *   SELL asset → `twak swap <units> <asset> <stable>`              (exit to stable)
 * Password is passed via the TWAK_WALLET_PASSWORD env (not argv) so it never hits the process list.
 * Verified flags against `twak swap --help` (v0.19.1).
 */
export interface TwakOpts {
  bin?: string; // default "twak"
  chain?: string; // "bsc" (mainnet) | "bsctestnet"
  stable?: string; // default "USDT"
  slippagePct?: number;
  password?: string;
}

interface SwapResult {
  txHash?: `0x${string}`;
  status: Execution["status"];
}

export function twakExecutionService(opts: TwakOpts = {}): ExecutionService {
  const bin = opts.bin ?? process.env.TWAK_BIN ?? "twak";
  const chain =
    opts.chain ?? (process.env.THRAWN_NETWORK === "bsc-mainnet" ? "bsc" : "bsctestnet");
  const stable = opts.stable ?? "USDT";
  const slippage = String(opts.slippagePct ?? 1);
  const password = opts.password ?? process.env.TWAK_WALLET_PASSWORD;

  async function swap(args: string[]): Promise<SwapResult> {
    const argv = ["swap", ...args, "--chain", chain, "--slippage", slippage, "--json"];
    try {
      const { stdout } = await run(bin, argv, {
        timeout: 120_000,
        env: password ? { ...process.env, TWAK_WALLET_PASSWORD: password } : process.env,
      });
      const last = stdout.trim().split("\n").pop() ?? "{}";
      const json = JSON.parse(last) as {
        txHash?: string;
        transactionHash?: string;
        hash?: string;
        status?: string;
      };
      const txHash = (json.txHash ?? json.transactionHash ?? json.hash) as
        | `0x${string}`
        | undefined;
      return { txHash, status: txHash || json.status === "success" ? "filled" : "failed" };
    } catch {
      return { status: "failed" };
    }
  }

  return {
    async execute(decision, order) {
      const r =
        order.side === "BUY"
          ? await swap(["--usd", String(order.size.notionalUsd), stable, order.asset])
          : await swap([String(order.size.positionUnits), order.asset, stable]);
      return {
        decisionId: decision.id,
        asset: order.asset,
        side: order.side,
        size: order.size,
        venue: order.venue,
        signer: "trust-wallet-agent-kit",
        txHash: r.txHash,
        status: r.status,
      };
    },
    async derisk(positions) {
      const out: Execution[] = [];
      for (const p of positions) {
        const r = await swap([String(p.units), p.asset, stable]);
        out.push({
          decisionId: "derisk",
          asset: p.asset,
          side: "SELL",
          size: { positionUnits: p.units, notionalUsd: p.notionalUsd, impliedLeverage: 1, riskUsd: 0 },
          venue: "pancakeswap",
          signer: "trust-wallet-agent-kit",
          txHash: r.txHash,
          status: r.status,
        });
      }
      return out;
    },
  };
}
