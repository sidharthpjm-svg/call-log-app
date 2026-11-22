import { useState } from "react";
import { OUTCOMES, SUGGESTED_ROLES } from "../lib.js";

const EMPTY = {
  candidate_name: "", phone: "", role: "", outcome: "shortlisted",
  experience_years: "", expected_ctc_lpa: "", notice_period_days: "", duration_seconds: "", notes: "",
};
const numOrNull = (v) => (v === "" ? null : Number(v));

// Log a call by hand (for screens done by a human recruiter)
export default function AddCallModal({ roles, onSave, onClose }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const update = (f) => (e) => setForm({ ...form, [f]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const ok = await onSave({
      candidate_name: form.candidate_name.trim(),
      phone: form.phone.replace(/\s/g, ""),
      role: form.role.trim(),
      outcome: form.outcome,
      experience_years: numOrNull(form.experience_years),
      expected_ctc_lpa: numOrNull(form.expected_ctc_lpa),
      notice_period_days: numOrNull(form.notice_period_days),
      duration_seconds: numOrNull(form.duration_seconds),
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Log a call manually</h2>
          <button className="icon-btn" onClick={onClose} title="Close">✕</button>
        </div>
        <form onSubmit={submit} className="form">
          <div className="row">
            <label>Candidate name<input required value={form.candidate_name} onChange={update("candidate_name")} placeholder="Priya Nair" /></label>
            <label>Phone<input required value={form.phone} onChange={update("phone")} placeholder="+919876543210" pattern="\+?[0-9 ]{10,18}" title="10–15 digits, optionally starting with +" /></label>
          </div>
          <div className="row">
            <label>
              Role
              <input required list="role-list" value={form.role} onChange={update("role")} placeholder="Data Analyst" />
              <datalist id="role-list">{[...new Set([...roles, ...SUGGESTED_ROLES])].map((r) => <option key={r} value={r} />)}</datalist>
            </label>
            <label>
              Outcome
              <select value={form.outcome} onChange={update("outcome")}>
                {OUTCOMES.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </label>
          </div>
          <div className="row">
            <label>Experience (yrs)<input type="number" min="0" step="0.5" value={form.experience_years} onChange={update("experience_years")} /></label>
            <label>Expected CTC (LPA)<input type="number" min="0" step="0.1" value={form.expected_ctc_lpa} onChange={update("expected_ctc_lpa")} /></label>
          </div>
          <div className="row">
            <label>Notice (days)<input type="number" min="0" value={form.notice_period_days} onChange={update("notice_period_days")} /></label>
            <label>Call length (sec)<input type="number" min="0" value={form.duration_seconds} onChange={update("duration_seconds")} /></label>
          </div>
          <label>Notes<textarea rows="2" value={form.notes} onChange={update("notes")} /></label>
          <button className="btn" disabled={saving}>{saving ? "Saving…" : "Save call"}</button>
        </form>
      </div>
    </div>
  );
}
