import { useCallback, useEffect, useState } from "react";
import "./styles.css";

// The backend URL: localhost while developing, your Render URL once deployed
const API = import.meta.env.VITE_API_URL;

const OUTCOMES = ["shortlisted", "callback", "rejected", "no answer"];
const SUGGESTED_ROLES = ["Backend Engineer", "Data Analyst", "Customer Support Executive", "Sales Associate"];
const EMPTY_FORM = {
  candidate_name: "",
  phone: "",
  role: "",
  outcome: "shortlisted",
  experience_years: "",
  expected_ctc_lpa: "",
  notice_period_days: "",
  duration_seconds: "",
  notes: "",
};
const REFRESH_MS = 10000;

const formatDuration = (s) => (s == null ? "—" : `${Math.floor(s / 60)}m ${s % 60}s`);
const formatHours = (s) => {
  if (!s) return "0m";
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};
const formatTime = (iso) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const numOrNull = (v) => (v === "" ? null : Number(v));
const slug = (outcome) => outcome.replace(/\s+/g, "-");

// Turn FastAPI's validation errors into one readable line
async function readError(res) {
  try {
    const body = await res.json();
    if (Array.isArray(body.detail)) {
      return body.detail.map((d) => `${d.loc[d.loc.length - 1]}: ${d.msg}`).join(" · ");
    }
    return body.detail || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export default function App() {
  const [calls, setCalls] = useState([]);
  const [stats, setStats] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Wait until the user stops typing before searching
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (outcomeFilter) params.set("outcome", outcomeFilter);
      if (roleFilter) params.set("role", roleFilter);
      const [callsRes, statsRes] = await Promise.all([
        fetch(`${API}/calls?${params}`),
        fetch(`${API}/stats`),
      ]);
      if (!callsRes.ok) throw new Error(await readError(callsRes));
      if (!statsRes.ok) throw new Error(await readError(statsRes));
      setCalls(await callsRes.json());
      setStats(await statsRes.json());
      setLastUpdated(new Date());
      setError("");
    } catch (e) {
      setError(
        e.message === "Failed to fetch"
          ? "Can't reach the API. On Render's free plan it may be waking up, so try again in a minute."
          : e.message
      );
    } finally {
      setLoading(false);
    }
  }, [search, outcomeFilter, roleFilter]);

  // Load now, then refresh every 10 seconds so new screening calls appear on their own
  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const addCall = async (e) => {
    e.preventDefault();
    setSaving(true);
    const body = {
      candidate_name: form.candidate_name.trim(),
      phone: form.phone.replace(/\s/g, ""),
      role: form.role.trim(),
      outcome: form.outcome,
      experience_years: numOrNull(form.experience_years),
      expected_ctc_lpa: numOrNull(form.expected_ctc_lpa),
      notice_period_days: numOrNull(form.notice_period_days),
      duration_seconds: numOrNull(form.duration_seconds),
      notes: form.notes.trim() || null,
    };
    const res = await fetch(`${API}/calls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) return setError(await readError(res));
    setForm(EMPTY_FORM);
    load();
  };

  const changeOutcome = async (id, outcome) => {
    const res = await fetch(`${API}/calls/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome }),
    });
    if (!res.ok) return setError(await readError(res));
    load();
  };

  const deleteCall = async (id, name) => {
    if (!window.confirm(`Delete the screening call with ${name}?`)) return;
    const res = await fetch(`${API}/calls/${id}`, { method: "DELETE" });
    if (!res.ok) return setError(await readError(res));
    load();
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const roles = stats?.by_role?.map((r) => r.role) ?? [];
  const roleOptions = [...new Set([...roles, ...SUGGESTED_ROLES])];

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>Candidate Screening Dashboard</h1>
          <p className="muted">
            First-round phone screens done by an AI voice agent: who we reached, who made the shortlist, and who needs a callback.
            {lastUpdated && <> · Updated {lastUpdated.toLocaleTimeString("en-IN")}</>}
          </p>
        </div>
        <button className="btn ghost" onClick={load}>Refresh</button>
      </header>

      {error && (
        <div className="error" onClick={() => setError("")}>
          {error} <span className="muted">(click to dismiss)</span>
        </div>
      )}

      {/* Stat cards */}
      <section className="cards">
        <StatCard label="Candidates screened" value={stats?.total ?? "—"} sub={`${stats?.today ?? 0} today`} />
        <StatCard label="Shortlisted" value={stats?.shortlisted ?? "—"} sub={`${stats?.shortlist_rate ?? 0}% shortlist rate`} />
        <StatCard label="Callbacks pending" value={stats?.callbacks ?? "—"} sub="candidates to call again" />
        <StatCard label="Avg screen length" value={formatDuration(stats?.avg_duration_seconds)} sub="per screening call" />
        <StatCard label="Recruiter time saved" value={formatHours(stats?.total_duration_seconds)} sub="of calls the agent handled" />
      </section>

      <div className="grid">
        {/* Log a screening call */}
        <section className="panel">
          <h2>Log a screening call</h2>
          <form onSubmit={addCall} className="form">
            <div className="row">
              <label>
                Candidate name
                <input required value={form.candidate_name} onChange={update("candidate_name")} placeholder="Priya Nair" />
              </label>
              <label>
                Phone
                <input
                  required
                  value={form.phone}
                  onChange={update("phone")}
                  placeholder="+919876543210"
                  pattern="\+?[0-9 ]{10,18}"
                  title="10–15 digits, optionally starting with +"
                />
              </label>
            </div>
            <div className="row">
              <label>
                Role
                <input required list="roles" value={form.role} onChange={update("role")} placeholder="Data Analyst" />
                <datalist id="roles">
                  {roleOptions.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </label>
              <label>
                Outcome
                <select value={form.outcome} onChange={update("outcome")}>
                  {OUTCOMES.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="row">
              <label>
                Experience (yrs)
                <input type="number" min="0" step="0.5" value={form.experience_years} onChange={update("experience_years")} placeholder="3" />
              </label>
              <label>
                Expected CTC (LPA)
                <input type="number" min="0" step="0.1" value={form.expected_ctc_lpa} onChange={update("expected_ctc_lpa")} placeholder="12" />
              </label>
            </div>
            <div className="row">
              <label>
                Notice period (days)
                <input type="number" min="0" value={form.notice_period_days} onChange={update("notice_period_days")} placeholder="30" />
              </label>
              <label>
                Call length (sec)
                <input type="number" min="0" value={form.duration_seconds} onChange={update("duration_seconds")} placeholder="240" />
              </label>
            </div>
            <label>
              Notes
              <textarea rows="2" value={form.notes} onChange={update("notes")} placeholder="Strong SQL, wants hybrid, can join in 30 days" />
            </label>
            <button className="btn" disabled={saving}>{saving ? "Saving…" : "Add screening call"}</button>
          </form>
        </section>

        <div className="stack">
          {/* Outcome breakdown */}
          <section className="panel">
            <h2>Outcomes</h2>
            {stats && stats.total > 0 ? (
              <div className="bars">
                {OUTCOMES.map((o) => {
                  const count = stats.by_outcome.find((b) => b.outcome === o)?.count ?? 0;
                  const pct = Math.round((100 * count) / stats.total);
                  return (
                    <button
                      key={o}
                      className={`bar-row ${outcomeFilter === o ? "active" : ""}`}
                      onClick={() => setOutcomeFilter(outcomeFilter === o ? "" : o)}
                      title="Click to filter the table"
                    >
                      <span className="bar-label">{o}</span>
                      <span className="bar-track">
                        <span className={`bar-fill ${slug(o)}`} style={{ width: `${pct}%` }} />
                      </span>
                      <span className="bar-value">{count} · {pct}%</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="muted">No screening calls yet.</p>
            )}
          </section>

          {/* Per-role funnel */}
          <section className="panel">
            <h2>Open roles</h2>
            {roles.length === 0 ? (
              <p className="muted">Roles appear here once candidates are screened.</p>
            ) : (
              <table className="compact">
                <thead>
                  <tr><th>Role</th><th>Screened</th><th>Shortlisted</th><th>Rate</th></tr>
                </thead>
                <tbody>
                  {stats.by_role.map((r) => (
                    <tr
                      key={r.role}
                      className={`clickable ${roleFilter === r.role ? "selected" : ""}`}
                      onClick={() => setRoleFilter(roleFilter === r.role ? "" : r.role)}
                      title="Click to filter the table"
                    >
                      <td className="strong">{r.role}</td>
                      <td>{r.screened}</td>
                      <td>{r.shortlisted}</td>
                      <td>{Math.round((100 * r.shortlisted) / r.screened)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="muted small">Tip: click an outcome or a role to filter the table.</p>
          </section>
        </div>
      </div>

      {/* Calls table */}
      <section className="panel">
        <div className="table-head">
          <h2>Screening calls {calls.length > 0 && <span className="muted">({calls.length})</span>}</h2>
          <div className="filters">
            <input
              className="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name, phone or notes"
            />
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">All roles</option>
              {roles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <select value={outcomeFilter} onChange={(e) => setOutcomeFilter(e.target.value)}>
              <option value="">All outcomes</option>
              {OUTCOMES.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <p className="muted">Loading screening calls…</p>
        ) : calls.length === 0 ? (
          <p className="muted">No screening calls match.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Role</th>
                  <th>Outcome</th>
                  <th>Exp</th>
                  <th>Expected CTC</th>
                  <th>Notice</th>
                  <th>Call</th>
                  <th>Notes</th>
                  <th>Time</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="strong">{c.candidate_name}</div>
                      <div className="mono muted">{c.phone}</div>
                    </td>
                    <td>{c.role}</td>
                    <td>
                      <select
                        className={`badge ${slug(c.outcome)}`}
                        value={c.outcome}
                        onChange={(e) => changeOutcome(c.id, e.target.value)}
                      >
                        {OUTCOMES.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </td>
                    <td className="nowrap">{c.experience_years == null ? "—" : `${Number(c.experience_years)} yrs`}</td>
                    <td className="nowrap">{c.expected_ctc_lpa == null ? "—" : `₹${Number(c.expected_ctc_lpa)} LPA`}</td>
                    <td className="nowrap">{c.notice_period_days == null ? "—" : `${c.notice_period_days} days`}</td>
                    <td className="nowrap">{formatDuration(c.duration_seconds)}</td>
                    <td className="notes">{c.notes || <span className="muted">—</span>}</td>
                    <td className="muted nowrap">{formatTime(c.created_at)}</td>
                    <td>
                      <button className="icon-btn" title="Delete" onClick={() => deleteCall(c.id, c.candidate_name)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="card">
      <div className="card-label">{label}</div>
      <div className="card-value">{value}</div>
      <div className="card-sub">{sub}</div>
    </div>
  );
}
