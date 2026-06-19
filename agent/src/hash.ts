import { createHash } from "node:crypto";

/**
 * Deterministic evidence hash for a decision's inputs. sha256 → 32 bytes, which maps cleanly
 * onto the DecisionRegistry.sol `bytes32 evidenceHash` field. Anchors what the agent decided
 * and why, so the on-chain log is auditable.
 */
export function evidenceHash(obj: unknown): `0x${string}` {
  return `0x${createHash("sha256").update(JSON.stringify(obj)).digest("hex")}`;
}
