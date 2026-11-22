import { OUTCOMES, slug } from "../lib.js";
import { Ring } from "../components/ui.jsx";

export default function Roles({ calls, stats, onPick, onStartCall }) {
  const roles = stats?.by_role ?? [];
  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1>Open roles</h1>
          <p className="muted">How screening is going for each opening. Click a role to see its candidates.</p>
        </div>
      </div>
      {roles.length === 0 && <p className="muted">Roles appear here once candidates are screened.</p>}
      <div className="role-grid">
        {roles.map((r) => {
          const pct = Math.round((100 * r.shortlisted) / r.screened);
          const mine = calls.filter((c) => c.role === r.role);
          const avgCtc = mine.filter((c) => c.expected_ctc_lpa != null);
          const ctc = avgCtc.length ? (avgCtc.reduce((s, c) => s + Number(c.expected_ctc_lpa), 0) / avgCtc.length).toFixed(1) : null;
          return (
            <article key={r.role} className="role-card" onClick={() => onPick(r.role)}>
              <div className="role-card-top">
                <div>
                  <h3>{r.role}</h3>
                  <div className="muted small">{r.screened} screened · {r.shortlisted} shortlisted</div>
                </div>
                <Ring pct={pct} />
              </div>
              <div className="role-outcomes">
                {OUTCOMES.map((o) => {
                  const n = mine.filter((c) => c.outcome === o.key).length;
                  return (
                    <span key={o.key} className="role-outcome" title={o.label}>
                      <span className={`swatch ${slug(o.key)}`} /> {o.icon} {n}
                    </span>
                  );
                })}
              </div>
              <div className="role-card-foot">
                <span className="muted small">{ctc ? `Avg expected CTC ₹${ctc} LPA` : "No CTC data yet"}</span>
                <button className="btn ghost small-btn" onClick={(e) => { e.stopPropagation(); onStartCall({ role: r.role }); }}>📞 Screen someone</button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
