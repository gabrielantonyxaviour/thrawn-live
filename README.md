# Thrawn Live

> An autonomous BSC trading agent that trades performance-weighted signal alpha behind a hard drawdown gate — built to survive Track 1's "most profit without blowing up" judging.

Built for **BNB AI Trading Agent Edition**.

## The thesis
Most agents in a live-PnL contest blow their drawdown cap and get DQ'd. Thrawn Live's edge isn't a fancier strategy — it's **risk discipline**: a real intra-trade drawdown gate (ported from a working signal analyzer) vetoes execution before the agent can disqualify itself, while it trades labeled caller-alpha that most entrants don't have.

## Architecture (assembly of owned parts + scored sponsor tools)
```
CMC Agent Hub (data) → signal brain → decision loop (evaluate + veto)
        → RISK GATE (live drawdown from outcome.ts; halt before the cap)
        → Trust Wallet Agent Kit (primary signer, Agent Wallet mode) → BSC execution
        → DecisionRegistry.sol (on-chain audit) ; identity via BNB AI Agent SDK (ERC-8004)
```
Polyglot: Python (`bnbagent` identity) + TS (signer/executor + analyzer). Seam in `shared/contract.ts`.

## Sponsor tools (all three = top scoring)
- **BNB AI Agent SDK** — on-chain agent identity / Track-1 registration.
- **Trust Wallet Agent Kit** — primary autonomous signer.
- **CMC Agent Hub** — market data layer.

## Status
Scaffold. Assembles `~/Documents/trading` + Agora decision engine. Build in progress. See `CLAUDE.md` / `KICKOFF.md` / `FACTS.md`.
