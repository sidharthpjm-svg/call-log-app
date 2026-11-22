import { useEffect, useState } from "react";
import {
  OUTCOMES, PLACEHOLDER_PHONE, cleanNotes, formatCTC, formatDuration, formatExp, formatNotice, formatTime, isBotCall,
} from "../lib.js";
import { Avatar, BotTag, OutcomeBadge } from "./ui.jsx";

export default function CandidateDrawer({ call, onClose, onOutcome, onSaveNotes, onDelete, onCall }) {
  const [notes, setNotes] = useState(call.notes || "");
  const [saving, setSaving] = useState(false);
  useEffect(() => setNotes(call.notes || ""), [call.id, call.notes]);

  const save = async () => {
    setSaving(true);
    await onSaveNotes(call.id, notes);
    setSaving(false);
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn drawer-close" onClick={onClose} title="Close">✕</button>

        <div className="drawer-head">
          <Avatar name={call.candidate_name} size={56} />
          <div>
            <h2>{call.candidate_name}</h2>
            <div className="muted">{call.role}</div>
            <div className="drawer-tags">
              <OutcomeBadge outcome={call.outcome} />
              {isBotCall(call) && <BotTag />}
            </div>
          </div>
        </div>

        <div className="facts">
          <Fact label="Experience" value={formatExp(call.experience_years)} />
          <Fact label="Expected CTC" value={formatCTC(call.expected_ctc_lpa)} />
          <Fact label="Notice period" value={formatNotice(call.notice_period_days)} />
          <Fact label="Call length" value={formatDuration(call.duration_seconds)} />
          <Fact label="Phone" value={call.phone === PLACEHOLDER_PHONE ? "Not captured" : call.phone} mono />
          <Fact label="Screened" value={formatTime(call.created_at)} />
        </div>

        {isBotCall(call) && cleanNotes(call.notes) && (
          <div className="riya-summary">
            <div className="riya-summary-label">🎙 Riya's summary</div>
            {cleanNotes(call.notes)}
          </div>
        )}

        <div className="drawer-section">
          <div className="section-label">Outcome</div>
          <div className="segmented">
            {OUTCOMES.map((o) => (
              <button
                key={o.key}
                className={`seg ${o.key.replace(/\s+/g, "-")} ${call.outcome === o.key ? "active" : ""}`}
                onClick={() => onOutcome(call.id, o.key)}
              >
                {o.icon} {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="drawer-section">
          <div className="section-label">Recruiter notes</div>
          <textarea rows="4" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button className="btn ghost small-btn" disabled={saving || notes === (call.notes || "")} onClick={save}>
            {saving ? "Saving…" : "Save notes"}
          </button>
        </div>

        <div className="drawer-actions">
          <button className="btn" onClick={() => onCall(call)}>📞 Call again with Riya</button>
          <button className="btn danger-ghost" onClick={() => onDelete(call)}>Delete</button>
        </div>
      </aside>
    </div>
  );
}

function Fact({ label, value, mono }) {
  return (
    <div className="fact">
      <div className="fact-label">{label}</div>
      <div className={`fact-value ${mono ? "mono" : ""}`}>{value}</div>
    </div>
  );
}
