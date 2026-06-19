import { shortHash, timeAgo, usd } from "./format.ts";
import type {
  DashboardDecision,
  DashboardState,
  OpenPosition,
  SponsorStatus,
} from "./types.ts";

export function DecisionStream({ decisions }: { decisions: DashboardDecision[] }) {
  return (
    <section className="panel stream">
      <div className="panel-h">
        <span className="kicker">Decision Stream</span>
        <span className="faint">{decisions.length} logged</span>
      </div>
      {decisions.length === 0 && <div className="empty">No decisions yet — start the loop.</div>}
      {decisions.map((d) => (
        <article className="decision" key={d.id}>
          <div className={`verdict ${d.decision}`}>
            {d.decision}
            <small>{timeAgo(d.createdAt)}</small>
          </div>
          <div className="body">
            <div className="top">
              {d.executions[0] && (
                <span className="asset">
                  {d.executions[0].side} {d.executions[0].asset}
                </span>
              )}
              {d.refusalReason && <span className="reason">{d.refusalReason}</span>}
            </div>
            <div className="trace">
              {d.reasoningTrace.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
            <div className="hash">
              <span>evidence {shortHash(d.evidenceHash, 10, 6)}</span>
              {d.executions.map(
                (e, i) =>
                  e.txHash && (
                    <a
                      key={i}
                      href={`https://testnet.bscscan.com/tx/${e.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      tx {shortHash(e.txHash, 8, 4)} ↗
                    </a>
                  ),
              )}
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

export function Positions({ positions }: { positions: OpenPosition[] }) {
  return (
    <section className="panel poslist">
      <div className="panel-h">
        <span className="kicker">Open Positions</span>
        <span className="faint">{positions.length}</span>
      </div>
      {positions.length === 0 && <div className="empty">Flat — no open exposure.</div>}
      {positions.map((p, i) => (
        <div className="posrow" key={i}>
          <div>
            <span className="a">
              {p.side} {p.asset}
            </span>{" "}
            <span className="d num">@ {p.entryPrice.toLocaleString()}</span>
          </div>
          <div className="n num">{usd(p.notionalUsd)}</div>
        </div>
      ))}
    </section>
  );
}

export function OnChainProof({ identity, network }: Pick<DashboardState, "identity" | "network">) {
  if (!identity) {
    return (
      <section className="panel proof gold">
        <div className="panel-h">
          <span className="kicker">On-Chain Identity</span>
        </div>
        <div className="empty">Not yet registered. Run register_identity.py.</div>
      </section>
    );
  }
  return (
    <section className="panel proof gold">
      <div className="panel-h">
        <span className="kicker">ERC-8004 Identity</span>
        <span className="badge-gas">GAS-FREE · MegaFuel</span>
      </div>
      <div className="kv">
        <div className="row">
          <span className="k">Agent ID</span>
          <span className="v num">#{identity.agentId ?? "—"}</span>
        </div>
        <div className="row">
          <span className="k">Address</span>
          <span className="v addr">
            <a href={identity.explorerAddress} target="_blank" rel="noreferrer">
              {shortHash(identity.agentAddress, 8, 6)} ↗
            </a>
          </span>
        </div>
        <div className="row">
          <span className="k">Register tx</span>
          <span className="v">
            {identity.explorerTx ? (
              <a href={identity.explorerTx} target="_blank" rel="noreferrer">
                {shortHash(identity.txHash, 8, 6)} ↗
              </a>
            ) : (
              "—"
            )}
          </span>
        </div>
        <div className="row">
          <span className="k">Registry</span>
          <span className="v faint">{shortHash(identity.registry, 8, 6)}</span>
        </div>
        <div className="row">
          <span className="k">Network</span>
          <span className="v faint">{network}</span>
        </div>
      </div>
    </section>
  );
}

const SPONSORS: { key: keyof DashboardState["sponsors"]; name: string; role: string }[] = [
  { key: "cmc", name: "CoinMarketCap Agent Hub", role: "Data — quotes + regime" },
  { key: "trustWallet", name: "Trust Wallet Agent Kit", role: "Signer — PancakeSwap spot" },
  { key: "bnbSdk", name: "BNB AI Agent SDK", role: "Identity — ERC-8004" },
];

export function Sponsors({ sponsors }: { sponsors: DashboardState["sponsors"] }) {
  const label: Record<SponsorStatus, string> = { live: "Live", pending: "Pending key", mock: "Mock" };
  return (
    <section className="panel">
      <div className="panel-h">
        <span className="kicker">Sponsor Integration</span>
        <span className="faint">3 / 3 wired</span>
      </div>
      {SPONSORS.map((s) => {
        const st = sponsors[s.key];
        return (
          <div className="sponsor" key={s.key}>
            <span className="name">
              <b>{s.name}</b>
              <small>{s.role}</small>
            </span>
            <span className={`sstatus ${st}`}>
              <span className="dot" />
              {label[st]}
            </span>
          </div>
        );
      })}
    </section>
  );
}
