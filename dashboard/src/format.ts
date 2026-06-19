export const usd = (n: number): string =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const pct = (n: number): string => `${n.toFixed(2)}%`;

export const shortHash = (h?: string | null, head = 6, tail = 4): string =>
  !h ? "—" : h.length <= head + tail + 2 ? h : `${h.slice(0, head)}…${h.slice(-tail)}`;

export function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
