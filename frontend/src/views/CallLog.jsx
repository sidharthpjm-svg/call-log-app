import { useMemo, useState } from "react";
import { OUTCOMES, PLACEHOLDER_PHONE, cleanNotes, formatCTC, formatDuration, formatExp, formatNotice, formatTime, isBotCall } from "../lib.js";
import { Avatar, BotTag, OutcomeBadge } from "../components/ui.jsx";

export default function CallLog({ calls, roles, onOpen, onAdd }) {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [outcome, setOutcome] = useState("");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return calls.filter(
      (c) =>
        (!role || c.role === role) &&
        (!outcome || c.outcome === outcome) &&
        (!q || [c.candidate_name, c.phone, c.notes, c.role].some((v) => (v || "").toLowerCase().includes(q)))
    );
  }, [calls, search, role, outcome]);

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1>Call log</h1>
          <p className="muted">Every screening call, newest first.</p>
        </div>
        <button className="btn ghost" onClick={onAdd}>+ Log a call manually</button>
      </div>

      <div className="card">
        <div className="filters wide">
          <input className="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone, role or notes" />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            {roles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="">All outcomes</option>
            {OUTCOMES.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <span className="muted small">{rows.length} of {calls.length}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Candidate</th><th>Role</th><th>Outcome</th><th>Exp</th><th>CTC</th><th>Notice</th><th>Call</th><th>Notes</th><th>When</th></tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} onClick={() => onOpen(c)} className="clickable">
                  <td>
                    <div className="person">
                      <Avatar name={c.candidate_name} size={28} />
                      <div>
                        <div className="strong">{c.candidate_name}</div>
                        <div className="mono muted small">{c.phone === PLACEHOLDER_PHONE ? "no phone" : c.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td>{c.role}</td>
                  <td><OutcomeBadge outcome={c.outcome} size="sm" /></td>
                  <td className="nowrap">{formatExp(c.experience_years)}</td>
                  <td className="nowrap">{formatCTC(c.expected_ctc_lpa)}</td>
                  <td className="nowrap">{formatNotice(c.notice_period_days)}</td>
                  <td className="nowrap">{formatDuration(c.duration_seconds)}</td>
                  <td className="notes">{isBotCall(c) && <BotTag />} {cleanNotes(c.notes) || <span className="muted">—</span>}</td>
                  <td className="muted nowrap">{formatTime(c.created_at)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan="9" className="muted">No calls match.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
