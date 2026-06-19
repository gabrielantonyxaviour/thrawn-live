import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  stringToHex,
  type Abi,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { RegistryService } from "../../../shared/contract.js";

/**
 * On-chain RegistryService — stamps every decision to DecisionRegistry.sol on BSC for the
 * audit/provenance proof Track 1 requires. recordDecision(bytes32 id, string kind,
 * bytes32 evidenceHash, uint256 amount). Once the contract is deployed, these calls are
 * MegaFuel-sponsorable (gas-free) since they target an existing address.
 */
const ABI = [
  {
    type: "function",
    name: "recordDecision",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "bytes32" },
      { name: "kind", type: "string" },
      { name: "evidenceHash", type: "bytes32" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const satisfies Abi;

export interface RegistryOpts {
  address: Hex;
  privateKey: Hex;
  rpcUrl: string;
  chainId: number;
}

export function decisionRegistryService(opts: RegistryOpts): RegistryService {
  const account = privateKeyToAccount(opts.privateKey);
  const chain = {
    id: opts.chainId,
    name: opts.chainId === 56 ? "BNB Smart Chain" : "BSC Testnet",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: { default: { http: [opts.rpcUrl] } },
  } as const;
  const wallet = createWalletClient({ account, chain, transport: http(opts.rpcUrl) });
  const pub = createPublicClient({ chain, transport: http(opts.rpcUrl) });

  return {
    async record(decision, amount) {
      const id = keccak256(stringToHex(decision.id));
      const amt = BigInt(Math.max(0, Math.round(amount)));
      const hash = await wallet.writeContract({
        address: opts.address,
        abi: ABI,
        functionName: "recordDecision",
        args: [id, decision.decision, decision.evidenceHash, amt],
      });
      await pub.waitForTransactionReceipt({ hash });
      return hash;
    },
  };
}
