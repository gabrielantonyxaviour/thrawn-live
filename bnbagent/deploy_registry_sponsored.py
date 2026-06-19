#!/usr/bin/env python3
"""
Deploy DecisionRegistry.sol to BSC testnet GAS-FREE via the MegaFuel paymaster — same sponsor
path bnbagent uses for ERC-8004. Lets a zero-balance wallet deploy without tBNB.

Mirrors bnbagent/erc8004/contract.py: build → isSponsorable → gasPrice=0 → sign → send.
Reuses the SAME keystore wallet as register_identity.py (one agent address).

  EMIT_ARTIFACT=1 npm run deploy:registry         # first: emit contracts/DecisionRegistry.json
  RPC_URL=https://bsc-testnet-rpc.publicnode.com \
    BNBAGENT_WALLET_PASSWORD=... bnbagent/.venv/bin/python bnbagent/deploy_registry_sponsored.py

Writes proof/decision-registry-testnet.json. Falls back to an honest blocker if not sponsorable.
"""
import json
import os
import pathlib
import sys

from web3 import Web3

from bnbagent import EVMWalletProvider
from bnbagent.core.paymaster import Paymaster

PW = os.environ.get("BNBAGENT_WALLET_PASSWORD")
if not PW:
    sys.exit("Set BNBAGENT_WALLET_PASSWORD. Aborting.")

RPC = os.environ.get("RPC_URL", "https://bsc-testnet-rpc.publicnode.com")
PAYMASTER_URL = os.environ.get("PAYMASTER_URL", "https://bsc-megafuel-testnet.nodereal.io")
ROOT = pathlib.Path(__file__).resolve().parent.parent
ARTIFACT = ROOT / "contracts" / "DecisionRegistry.json"
MIN_GAS_PRICE_WEI = 10**8  # 0.1 gwei floor (matches bnbagent)


def main() -> None:
    if not ARTIFACT.exists():
        sys.exit(f"Missing {ARTIFACT}. Run: EMIT_ARTIFACT=1 npm run deploy:registry")
    art = json.loads(ARTIFACT.read_text())
    abi, bytecode = art["abi"], art["bytecode"]

    wallet = EVMWalletProvider(password=PW)  # auto-loads the existing keystore (single wallet)
    addr = Web3.to_checksum_address(wallet.address)
    w3 = Web3(Web3.HTTPProvider(RPC))
    if not w3.is_connected():
        sys.exit(f"RPC not reachable: {RPC}")
    if w3.eth.chain_id != 97:
        sys.exit(f"Wrong chain {w3.eth.chain_id} (want 97 testnet)")
    print(f"[deploy] wallet={addr} rpc={RPC} chain=97")

    pm = Paymaster(PAYMASTER_URL)
    contract = w3.eth.contract(abi=abi, bytecode=bytecode)

    nonce = pm.eth_getTransactionCount(addr, "pending")
    gas_est = contract.constructor().estimate_gas({"from": addr})
    tx = contract.constructor().build_transaction(
        {
            "from": addr,
            "chainId": 97,
            "nonce": nonce,
            "gas": int(gas_est * 1.2),
            "gasPrice": max(w3.eth.gas_price, MIN_GAS_PRICE_WEI),
        }
    )
    # Contract creation has no recipient — drop any empty `to` the builder left, which the
    # paymaster's JSON-RPC cannot unmarshal (odd-length hex).
    if not tx.get("to"):
        tx.pop("to", None)

    if not pm.isSponsorable(tx):
        out = {
            "status": "blocked",
            "reason": "MegaFuel declined to sponsor the deploy (per-policy/rate cap).",
            "next": "Retry later, or fund the wallet with a little tBNB and use `npm run deploy:registry`.",
            "wallet": addr,
        }
        print(json.dumps(out, indent=2))
        sys.exit(2)

    tx["gasPrice"] = 0
    signed = wallet.sign_transaction(tx)
    raw_hex = signed["rawTransaction"].hex()
    tx_hash = pm.eth_sendRawTransaction(raw_hex if raw_hex.startswith("0x") else "0x" + raw_hex,
                                        tx_options={"UserAgent": "thrawn-live/0.1.0"})
    if not tx_hash.startswith("0x"):
        tx_hash = "0x" + tx_hash
    print(f"[deploy] tx sent (sponsored): {tx_hash} — waiting for receipt…")

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=300)
    address = receipt["contractAddress"]
    proof = {
        "network": "bsc-testnet",
        "contract": "DecisionRegistry",
        "address": address,
        "deployer": addr,
        "transactionHash": tx_hash,
        "gasFree": receipt.get("effectiveGasPrice", 0) == 0,
        "explorer": f"https://testnet.bscscan.com/address/{address}",
        "explorerTx": f"https://testnet.bscscan.com/tx/{tx_hash}",
    }
    out = ROOT / "proof" / "decision-registry-testnet.json"
    out.write_text(json.dumps(proof, indent=2) + "\n")
    print(f"[deploy] proof → {out}")
    print(json.dumps(proof, indent=2))


if __name__ == "__main__":
    main()
