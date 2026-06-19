// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title DecisionRegistry
/// @notice Append-only provenance log for Thrawn Live trading-agent decisions on BSC.
///         Each EXECUTE / REFUSE / DERISK decision is stamped on-chain with its evidence
///         hash so judges can audit exactly what the agent decided, when, and why — the
///         on-chain proof the hackathon requires. Ported from the Agora DecisionRegistry
///         (chain-agnostic EVM); re-targeted from Arc to BNB Smart Chain.
contract DecisionRegistry {
    event DecisionRecorded(
        bytes32 indexed id,
        address indexed recorder,
        string kind,
        bytes32 evidenceHash,
        uint256 amount,
        uint256 recordedAt
    );

    /// @notice Total number of decisions stamped to this registry.
    uint256 public decisionCount;
    /// @notice Id of the most recently stamped decision.
    bytes32 public lastDecisionId;
    /// @notice Evidence hash of the most recently stamped decision.
    bytes32 public lastEvidenceHash;
    /// @notice Unix timestamp a given decision id was recorded (0 if never).
    mapping(bytes32 => uint256) public recordedAt;

    function recordDecision(
        bytes32 id,
        string calldata kind,
        bytes32 evidenceHash,
        uint256 amount
    ) external {
        decisionCount += 1;
        lastDecisionId = id;
        lastEvidenceHash = evidenceHash;
        recordedAt[id] = block.timestamp;
        emit DecisionRecorded(id, msg.sender, kind, evidenceHash, amount, block.timestamp);
    }
}
