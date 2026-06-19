/**
 * Deploys contracts/DecisionRegistry.sol to BNB Smart Chain.
 *
 *   BSC_RPC_URL=... DEPLOYER_PRIVATE_KEY=0x... THRAWN_NETWORK=bsc-testnet \
 *     tsx contracts/deploy-registry.ts
 *
 * Defaults to BSC TESTNET (chain 97, free tBNB). With no key it compiles and prints an honest
 * blocker rather than pretending a deployment happened — it never fabricates an address.
 * Re-targeted from the Agora Arc deployer (same viem + solc pattern).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Abi,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import solc from "solc";

const NETWORK = process.env.THRAWN_NETWORK ?? "bsc-testnet";
const IS_MAINNET = NETWORK === "bsc-mainnet";

const CHAIN = IS_MAINNET
  ? {
      id: 56,
      name: "BNB Smart Chain",
      rpc: process.env.BSC_RPC_URL ?? "https://bsc-rpc.publicnode.com",
      explorer: "https://bscscan.com",
    }
  : {
      id: 97,
      name: "BSC Testnet",
      rpc: process.env.BSC_RPC_URL ?? "https://bsc-testnet-rpc.publicnode.com",
      explorer: "https://testnet.bscscan.com",
    };

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = join(here, "DecisionRegistry.sol");

const chain = {
  id: CHAIN.id,
  name: CHAIN.name,
  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  rpcUrls: { default: { http: [CHAIN.rpc] } },
  blockExplorers: { default: { name: "BscScan", url: CHAIN.explorer } },
} as const;

function compile(): { abi: Abi; bytecode: Hex } {
  const source = readFileSync(SOURCE_PATH, "utf8");
  const input = {
    language: "Solidity",
    sources: { "DecisionRegistry.sol": { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (out.errors ?? []).filter(
    (e: { severity: string }) => e.severity === "error",
  );
  if (errors.length) {
    throw new Error(
      `Solc errors:\n${errors.map((e: { formattedMessage: string }) => e.formattedMessage).join("\n")}`,
    );
  }
  const contract = out.contracts["DecisionRegistry.sol"].DecisionRegistry;
  return {
    abi: contract.abi as Abi,
    bytecode: `0x${contract.evm.bytecode.object}` as Hex,
  };
}

async function main() {
  const { abi, bytecode } = compile();
  console.log(`Compiled DecisionRegistry.sol (${abi.length} ABI entries) for ${CHAIN.name}.`);

  // Emit the compiled artifact for the Python MegaFuel-sponsored deployer (gas-free testnet path).
  if (process.env.EMIT_ARTIFACT) {
    const artifactPath = join(here, "DecisionRegistry.json");
    writeFileSync(artifactPath, JSON.stringify({ abi, bytecode }, null, 2));
    console.log(`Wrote artifact → ${artifactPath}`);
    return;
  }

  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    console.log(
      JSON.stringify(
        {
          status: "blocked",
          reason: "DEPLOYER_PRIVATE_KEY (0x + 32 bytes) not set. Compiled only; no deployment.",
          next: `Set BSC_RPC_URL + a funded DEPLOYER_PRIVATE_KEY (testnet tBNB is free), then re-run.`,
          network: CHAIN.name,
        },
        null,
        2,
      ),
    );
    return;
  }

  const account = privateKeyToAccount(privateKey as Hex);
  const publicClient = createPublicClient({ chain, transport: http(CHAIN.rpc) });
  const walletClient = createWalletClient({ account, chain, transport: http(CHAIN.rpc) });

  console.log(`Deploying from ${account.address} to ${CHAIN.name}…`);
  const hash = await walletClient.deployContract({ abi, bytecode });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  console.log(
    JSON.stringify(
      {
        status: "deployed",
        network: CHAIN.name,
        address: receipt.contractAddress,
        txHash: hash,
        explorer: `${CHAIN.explorer}/address/${receipt.contractAddress}`,
        next: "Set DECISION_REGISTRY_ADDRESS to this address for the agent + dashboard.",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
