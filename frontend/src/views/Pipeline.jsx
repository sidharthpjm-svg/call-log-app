import { useState } from "react";
import { OUTCOMES, cleanNotes, formatCTC, formatExp, formatNotice, isBotCall, slug, timeAgo, useNow } from "../lib.js";
import { Avatar, BotTag } from "../components/ui.jsx";

export default function Pipeline({ calls, roles, roleFilter, setRoleFilter, onOutcome, onOpen, onStartCall }) {
  useNow();
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const shown = roleFilter ? calls.filter((c) => c.role === roleFilter) : calls;

  const drop = (outcome) => {
    const call = calls.find((c) => c.id === dragId);
    if (call && call.outcome !== outcome) onOutcome(call.id, outcome);
    setDragId(null);
    setOverCol(null);
  };

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1>Pipeline</h1>
          <p className="muted">Drag a candidate to another column to change their outcome. Click a card for the full profile.</p>
        </div>
        <div className="filters">
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">All roles</option>
            {roles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button className="btn" onClick={() => onStartCall({ role: roleFilter || undefined })}>📞 New call</button>
        </div>
      </div>

      <div className="board">
        {OUTCOMES.map((o) => {
          const items = shown.filter((c) => c.outcome === o.key);
          return (
            <div
              key={o.key}
              className={`column ${slug(o.key)} ${overCol === o.key ? "drag-over" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setOverCol(o.key); }}
              onDragLeave={() => setOverCol((c) => (c === o.key ? null : c))}
              onDrop={() => drop(o.key)}
            >
              <div className="column-head">
                <span className={`column-icon ${slug(o.key)}`}>{o.icon}</span>
                <span className="column-title">{o.label}</span>
                <span className="column-count">{items.length}</span>
              </div>
              <div className="column-body">
                {items.length === 0 && <div className="column-empty">{o.hint}</div>}
                {items.map((c) => (
                  <article
                    key={c.id}
                    className={`cand-card ${dragId === c.id ? "dragging" : ""}`}
                    draggable
                    onDragStart={() => setDragId(c.id)}
                    onDragEnd={() => { setDragId(null); setOverCol(null); }}
                    onClick={() => onOpen(c)}
                  >
                    <div className="cand-top">
                      <Avatar name={c.candidate_name} size={32} />
                      <div className="cand-name">
                        <strong>{c.candidate_name}</strong>
                        <span className="role-chip">{c.role}</span>
                      </div>
                    </div>
                    {(c.experience_years != null || c.expected_ctc_lpa != null || c.notice_period_days != null) && (
                      <div className="cand-facts">
                        {c.experience_years != null && <span>{formatExp(c.experience_years)}</span>}
                        {c.expected_ctc_lpa != null && <span>{formatCTC(c.expected_ctc_lpa)}</span>}
                        {c.notice_period_days != null && <span>{formatNotice(c.notice_period_days)}</span>}
                      </div>
                    )}
                    {cleanNotes(c.notes) && <p className="cand-note">{cleanNotes(c.notes)}</p>}
                    <div className="cand-foot">
                      {isBotCall(c) ? <BotTag /> : <span className="muted small">Manual</span>}
                      <span className="muted small">{timeAgo(c.created_at)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
