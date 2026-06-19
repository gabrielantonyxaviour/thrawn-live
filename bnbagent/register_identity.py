#!/usr/bin/env python3
"""
One-shot: register Thrawn Live's ERC-8004 agent identity on BSC via the BNB AI Agent SDK.

Defaults to bsc-testnet (chain 97), where MegaFuel sponsors gas → a fresh zero-balance wallet
registers for FREE. This is the polyglot identity seam: Python mints + registers the identity,
the TS loop consumes the resulting agent address (see shared/contract.ts AgentIdentity).

  BNBAGENT_WALLET_PASSWORD=... bnbagent/.venv/bin/python bnbagent/register_identity.py

The keystore is written to ~/.bnbagent/wallets/<addr>.json (OUTSIDE the repo). The password is
the only way to recover the key — keep it safe; NEVER commit it or the keystore (public repo).
Public on-chain proof (address, agentId, tx) is written to proof/identity-testnet.json.
"""
import json
import os
import pathlib
import sys

from bnbagent import AgentEndpoint, ERC8004Agent, EVMWalletProvider

PW = os.environ.get("BNBAGENT_WALLET_PASSWORD")
if not PW:
    sys.exit("Set BNBAGENT_WALLET_PASSWORD (keystore password) before running. Aborting.")

NETWORK = os.environ.get("BNBAGENT_NETWORK", "bsc-testnet")
NAME = os.environ.get("BNBAGENT_NAME", "Thrawn Live")
REGISTRY = {
    "bsc-testnet": "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    "bsc-mainnet": "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
}
EXPLORER = "https://testnet.bscscan.com" if NETWORK == "bsc-testnet" else "https://bscscan.com"


def main() -> None:
    wallet = EVMWalletProvider(password=PW)  # first run auto-creates keypair + keystore
    addr = wallet.address
    print(f"[identity] wallet={addr} network={NETWORK}")

    sdk = ERC8004Agent(wallet_provider=wallet, network=NETWORK, debug=True)

    agent_id = None
    tx = None
    existing = None
    try:
        existing = sdk.get_local_agent_info(NAME)  # 8004scan lookup; None if unregistered
    except Exception as e:  # indexer can lag / be down — proceed to register
        print(f"[identity] local lookup skipped: {e}")

    if existing:
        print(f"[identity] already registered: {existing}")
        agent_id = existing.get("agentId")
        tx = existing.get("transactionHash")
    else:
        agent_uri = sdk.generate_agent_uri(
            name=NAME,
            description=(
                "Autonomous BSC trading agent — trades performance-weighted signal alpha "
                "behind a hard drawdown gate (most profit without blowing up)."
            ),
            endpoints=[
                AgentEndpoint(
                    name="A2A",
                    endpoint="https://thrawn-live.example/.well-known/agent-card.json",
                )
            ],
        )
        result = sdk.register_agent(agent_uri=agent_uri)
        print(f"[identity] register result: success={result.get('success')} agentId={result.get('agentId')}")
        agent_id = result.get("agentId")
        tx = result.get("transactionHash")

    proof = {
        "network": NETWORK,
        "agentAddress": addr,
        "agentId": agent_id,
        "transactionHash": tx,
        "registry": REGISTRY.get(NETWORK),
        "explorerTx": f"{EXPLORER}/tx/{tx}" if tx else None,
        "explorerAddress": f"{EXPLORER}/address/{addr}",
        "scan8004": "https://www.8004scan.io",
    }
    out = pathlib.Path(__file__).resolve().parent.parent / "proof" / "identity-testnet.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(proof, indent=2) + "\n")
    print(f"[identity] proof → {out}")
    print(json.dumps(proof, indent=2))


if __name__ == "__main__":
    main()
