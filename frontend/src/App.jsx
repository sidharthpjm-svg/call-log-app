import { useCallback, useEffect, useRef, useState } from "react";
import "./styles.css";
import { OUTCOME, apiFetch, isBotCall } from "./lib.js";
import CallPanel from "./CallPanel.jsx";
import CandidateDrawer from "./components/CandidateDrawer.jsx";
import AddCallModal from "./components/AddCallModal.jsx";
import { Toasts } from "./components/ui.jsx";
import Overview from "./views/Overview.jsx";
import Pipeline from "./views/Pipeline.jsx";
import Roles from "./views/Roles.jsx";
import CallLog from "./views/CallLog.jsx";

const VIEWS = [
  { key: "overview", label: "Overview", icon: "◎" },
  { key: "pipeline", label: "Pipeline", icon: "▦" },
  { key: "roles", label: "Roles", icon: "◈" },
  { key: "log", label: "Call log", icon: "☰" },
];
const REFRESH_MS = 10000;
const viewFromHash = () => {
  const v = window.location.hash.replace("#", "");
  return VIEWS.some((x) => x.key === v) ? v : "overview";
};

export default function App() {
  const [view, setView] = useState(viewFromHash);
  const [calls, setCalls] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [openId, setOpenId] = useState(null); // candidate drawer
  const [callTarget, setCallTarget] = useState(null); // call panel: null | {} | candidate
  const [adding, setAdding] = useState(false);
  const [roleFilter, setRoleFilter] = useState("");
  const [toasts, setToasts] = useState([]);
  const knownIds = useRef(null);

  // Keep the URL hash in sync so each screen has its own link (#pipeline, #roles…)
  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const go = (v) => { window.location.hash = v; setView(v); };

  // Esc closes the candidate drawer and the manual-entry form (not a live call, to avoid hanging up by accident)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { setOpenId(null); setAdding(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toast = useCallback((t) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...t, id }].slice(-4));
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 6000);
  }, []);

  const load = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([apiFetch("/calls?limit=500"), apiFetch("/stats")]);
      // Pop a notification for calls that arrived since the last refresh (e.g. Riya just finished one)
      if (knownIds.current) {
        c.filter((x) => !knownIds.current.has(x.id)).forEach((x) =>
          toast({
            icon: isBotCall(x) ? "🎙" : "＋",
            title: isBotCall(x) ? `Riya screened ${x.candidate_name}` : `${x.candidate_name} was added`,
            body: `${x.role} · ${OUTCOME[x.outcome]?.icon ?? ""} ${OUTCOME[x.outcome]?.label ?? x.outcome}`,
          })
        );
      }
      knownIds.current = new Set(c.map((x) => x.id));
      setCalls(c);
      setStats(s);
      setLastUpdated(new Date());
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  // --- actions -------------------------------------------------------------
  const changeOutcome = async (id, outcome) => {
    setCalls((prev) => prev.map((c) => (c.id === id ? { ...c, outcome } : c))); // instant feedback
    try {
      await apiFetch(`/calls/${id}`, { method: "PATCH", body: JSON.stringify({ outcome }) });
      toast({ icon: OUTCOME[outcome].icon, title: `Moved to ${OUTCOME[outcome].label}` });
    } catch (e) {
      setError(e.message);
    }
    load();
  };

  const saveNotes = async (id, notes) => {
    try {
      await apiFetch(`/calls/${id}`, { method: "PATCH", body: JSON.stringify({ notes }) });
      toast({ icon: "✎", title: "Notes saved" });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const deleteCall = async (call) => {
    if (!window.confirm(`Delete the screening call with ${call.candidate_name}?`)) return;
    try {
      await apiFetch(`/calls/${call.id}`, { method: "DELETE" });
      setOpenId(null);
      toast({ icon: "🗑", title: `Deleted ${call.candidate_name}` });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const addCall = async (body) => {
    try {
      await apiFetch("/calls", { method: "POST", body: JSON.stringify(body) });
      load();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  };

  const startCall = (target) => { setOpenId(null); setCallTarget(target || {}); };
  const openCall = calls.find((c) => c.id === openId);
  const roles = (stats?.by_role ?? []).map((r) => r.role);
  const callbacks = stats?.callbacks ?? 0;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">TB</span>
          <div>
            <div className="brand-name">TalentBridge</div>
            <div className="brand-sub">Screening HQ</div>
          </div>
        </div>

        <nav className="nav">
          {VIEWS.map((v) => (
            <button key={v.key} className={`nav-item ${view === v.key ? "active" : ""}`} onClick={() => go(v.key)}>
              <span className="nav-icon">{v.icon}</span>
              {v.label}
              {v.key === "pipeline" && callbacks > 0 && <span className="nav-badge" title="Callbacks pending">{callbacks}</span>}
            </button>
          ))}
        </nav>

        <div className="riya-card">
          <div className="orb small idle"><span /></div>
          <div>
            <div className="riya-name">Riya</div>
            <div className="riya-sub">AI recruiter · voice</div>
          </div>
          <button className="btn full" onClick={() => startCall({})}>📞 Start a call</button>
        </div>

        <div className="sidebar-foot">
          {lastUpdated ? `Synced ${lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Connecting…"}
          <button className="link light" onClick={load}>Refresh</button>
        </div>
      </aside>

      <main className="main">
        {error && <div className="error" onClick={() => setError("")}>{error} <span className="muted">(click to dismiss)</span></div>}
        {loading ? (
          <div className="loading"><div className="orb thinking"><span /></div>Loading Screening HQ…</div>
        ) : (
          <>
            {view === "overview" && <Overview calls={calls} stats={stats} onStartCall={startCall} onOpen={(c) => setOpenId(c.id)} onGo={go} />}
            {view === "pipeline" && (
              <Pipeline calls={calls} roles={roles} roleFilter={roleFilter} setRoleFilter={setRoleFilter}
                onOutcome={changeOutcome} onOpen={(c) => setOpenId(c.id)} onStartCall={startCall} />
            )}
            {view === "roles" && <Roles calls={calls} stats={stats} onStartCall={startCall} onPick={(r) => { setRoleFilter(r); go("pipeline"); }} />}
            {view === "log" && <CallLog calls={calls} roles={roles} onOpen={(c) => setOpenId(c.id)} onAdd={() => setAdding(true)} />}
          </>
        )}
      </main>

      {openCall && (
        <CandidateDrawer call={openCall} onClose={() => setOpenId(null)} onOutcome={changeOutcome}
          onSaveNotes={saveNotes} onDelete={deleteCall} onCall={startCall} />
      )}
      {adding && <AddCallModal roles={roles} onSave={addCall} onClose={() => setAdding(false)} />}
      {callTarget && (
        <CallPanel
          initial={callTarget}
          onClose={(callHappened) => {
            setCallTarget(null);
            // Riya saves the result a few seconds after the call ends
            if (callHappened) [2000, 6000, 12000].forEach((ms) => setTimeout(load, ms));
          }}
        />
      )}
      <Toasts toasts={toasts} onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </div>
  );
}
