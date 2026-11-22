import { OUTCOME, initials, slug, useCountUp } from "../lib.js";

export function OutcomeBadge({ outcome, size = "md" }) {
  const o = OUTCOME[outcome] ?? { label: outcome, icon: "•" };
  return (
    <span className={`badge ${slug(outcome)} ${size}`}>
      <span className="badge-icon" aria-hidden>{o.icon}</span>
      {o.label}
    </span>
  );
}

// Initials avatar; the hue comes from the name so each person keeps their colour
export function Avatar({ name, size = 36 }) {
  let hash = 0;
  for (const ch of name || "") hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, "--h": hash }}>
      {initials(name)}
    </span>
  );
}

export function BotTag() {
  return <span className="bot-tag" title="Screened by Riya, the AI voice agent">🎙 Riya</span>;
}

export function Kpi({ label, value, format = (v) => Math.round(v), sub, accent }) {
  const n = useCountUp(typeof value === "number" ? value : 0);
  return (
    <div className={`kpi ${accent ? `kpi-${accent}` : ""}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value == null ? "—" : format(n)}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

export function Toasts({ toasts, onDismiss }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast" onClick={() => onDismiss(t.id)}>
          <span className="toast-icon">{t.icon}</span>
          <div>
            <div className="toast-title">{t.title}</div>
            {t.body && <div className="toast-body">{t.body}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// Shortlist-rate ring for a role (a single value, so no legend needed)
export function Ring({ pct, size = 84, stroke = 8 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="ring" role="img" aria-label={`${pct}% shortlisted`}>
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r} className="ring-fill" strokeWidth={stroke} fill="none"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="ring-text">{pct}%</text>
    </svg>
  );
}
