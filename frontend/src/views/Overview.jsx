import { OUTCOMES, OUTCOME, formatDuration, formatHours, greeting, isBotCall, slug, timeAgo, useNow } from "../lib.js";
import { Avatar, BotTag, Kpi, OutcomeBadge } from "../components/ui.jsx";

const VERB = { shortlisted: "shortlisted", callback: "booked a callback with", rejected: "screened out", "no answer": "couldn't reach" };

export default function Overview({ calls, stats, onStartCall, onOpen, onGo }) {
  useNow();
  const total = stats?.total ?? 0;
  const recent = calls.slice(0, 7);
  const botCalls = calls.filter(isBotCall).length;

  return (
    <div className="view">
      {/* Hero */}
      <section className="hero">
        <div className="hero-text">
          <div className="eyebrow">{greeting()} · Screening HQ</div>
          <h1>
            {stats?.today ? <><em>{stats.today}</em> {stats.today === 1 ? "candidate" : "candidates"} screened today.</> : <>Ready when you are.</>}
          </h1>
          <p>
            Riya, your AI recruiter, makes first-round phone screens and logs every result here the moment the call ends.
            {stats?.callbacks ? ` ${stats.callbacks} ${stats.callbacks === 1 ? "candidate is" : "candidates are"} waiting for a callback.` : ""}
          </p>
          <div className="hero-actions">
            <button className="btn big" onClick={() => onStartCall({})}>📞 Start a screening call</button>
            <button className="btn ghost-light big" onClick={() => onGo("pipeline")}>Open pipeline →</button>
          </div>
        </div>
        <div className="hero-orb" aria-hidden>
          <div className="orb idle"><span /></div>
          <div className="orb-caption">Riya · online</div>
        </div>
      </section>

      {/* KPIs */}
      <section className="kpis">
        <Kpi label="Candidates screened" value={stats?.total} sub={`${stats?.today ?? 0} today · ${botCalls} by Riya`} />
        <Kpi label="Shortlisted" value={stats?.shortlisted} sub={`${stats?.shortlist_rate ?? 0}% shortlist rate`} accent="good" />
        <Kpi label="Callbacks pending" value={stats?.callbacks} sub="to call again" accent="warn" />
        <Kpi label="Avg screen" value={stats?.avg_duration_seconds ?? null} format={(v) => formatDuration(Math.round(v))} sub="per call" />
        <Kpi label="Recruiter time saved" value={stats?.total_duration_seconds ?? 0} format={(v) => formatHours(Math.round(v))} sub="of screening calls" accent="brand" />
      </section>

      <div className="two-col">
        {/* Outcome split: one segmented bar, part-to-whole */}
        <section className="card">
          <div className="card-head">
            <h2>Outcome split</h2>
            <span className="muted small">{total} calls</span>
          </div>
          {total === 0 ? (
            <p className="muted">No calls yet. Start one with Riya.</p>
          ) : (
            <>
              <div className="split-bar" role="img" aria-label="Share of calls by outcome">
                {OUTCOMES.map((o) => {
                  const n = stats.by_outcome.find((b) => b.outcome === o.key)?.count ?? 0;
                  if (!n) return null;
                  return (
                    <div key={o.key} className={`split-seg ${slug(o.key)}`} style={{ flexGrow: n }}>
                      <span className="tip">{o.label}: {n} ({Math.round((100 * n) / total)}%)</span>
                    </div>
                  );
                })}
              </div>
              <div className="split-legend">
                {OUTCOMES.map((o) => {
                  const n = stats.by_outcome.find((b) => b.outcome === o.key)?.count ?? 0;
                  return (
                    <button key={o.key} className="legend-item" onClick={() => onGo("pipeline")} title={o.hint}>
                      <span className={`swatch ${slug(o.key)}`} />
                      <span className="legend-label">{o.icon} {o.label}</span>
                      <span className="legend-value">{n}</span>
                      <span className="muted small">{Math.round((100 * n) / total)}%</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="card-head spaced">
            <h2>Roles</h2>
            <button className="link" onClick={() => onGo("roles")}>All roles →</button>
          </div>
          <div className="role-mini">
            {(stats?.by_role ?? []).slice(0, 4).map((r) => {
              const pct = Math.round((100 * r.shortlisted) / r.screened);
              return (
                <div key={r.role} className="role-mini-row" title={`${r.shortlisted} of ${r.screened} shortlisted`}>
                  <span className="role-mini-name">{r.role}</span>
                  <span className="role-mini-track"><span className="role-mini-fill" style={{ width: `${pct}%` }} /></span>
                  <span className="role-mini-val">{pct}%</span>
                </div>
              );
            })}
            {!stats?.by_role?.length && <p className="muted">Roles appear once candidates are screened.</p>}
          </div>
        </section>

        {/* Live activity feed */}
        <section className="card">
          <div className="card-head">
            <h2>Live activity</h2>
            <span className="live-dot">Live</span>
          </div>
          {recent.length === 0 ? (
            <p className="muted">Nothing yet. Calls appear here as soon as Riya finishes them.</p>
          ) : (
            <ul className="feed">
              {recent.map((c) => {
                const fresh = Date.now() - new Date(c.created_at).getTime() < 10 * 60 * 1000;
                return (
                  <li key={c.id} className={`feed-item ${fresh ? "fresh" : ""}`} onClick={() => onOpen(c)}>
                    <Avatar name={c.candidate_name} size={34} />
                    <div className="feed-text">
                      <div>
                        {isBotCall(c) ? <><strong>Riya</strong> {VERB[c.outcome] ?? "screened"} </> : <>Logged </>}
                        <strong>{c.candidate_name}</strong>
                        {" "}for {c.role}
                      </div>
                      <div className="feed-meta">
                        <OutcomeBadge outcome={c.outcome} size="sm" />
                        {isBotCall(c) && <BotTag />}
                        <span className="muted small">{timeAgo(c.created_at)}</span>
                      </div>
                    </div>
                    {fresh && <span className="new-pill">New</span>}
                  </li>
                );
              })}
            </ul>
          )}
          {calls.length > 7 && <button className="link" onClick={() => onGo("log")}>See all calls →</button>}
        </section>
      </div>
    </div>
  );
}
