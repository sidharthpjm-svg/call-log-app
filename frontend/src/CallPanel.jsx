import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";

const API = import.meta.env.VITE_API_URL;
const ROLES = ["Data Analyst", "Backend Engineer", "Customer Support Executive", "Sales Associate"];

// What each agent state looks like on screen
const STATE_LABELS = {
  connecting: "Connecting…",
  waiting: "Waiting for Riya to join…",
  initializing: "Riya is joining…",
  idle: "Riya is ready",
  listening: "Riya is listening",
  thinking: "Riya is thinking…",
  speaking: "Riya is speaking",
  ended: "Call ended",
};

// The Fish Audio voice adds inline tags like <expr .../>; hide them in the transcript
const cleanText = (text) => text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

export default function CallPanel({ initial, onClose }) {
  const [form, setForm] = useState({
    candidate_name: initial?.candidate_name ?? "",
    phone: initial?.phone && initial.phone !== "+910000000000" ? initial.phone : "",
    role: initial?.role ?? ROLES[0],
  });
  const [stage, setStage] = useState("form"); // form | call | ended
  const [agentState, setAgentState] = useState("connecting");
  const [lines, setLines] = useState([]); // [{id, who, text}]
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState("");
  const roomRef = useRef(null);
  const transcriptRef = useRef(null);

  // Keep the transcript scrolled to the newest line
  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight });
  }, [lines]);

  // Hang up if the panel is closed or the page changes
  useEffect(() => () => roomRef.current?.disconnect(), []);

  const upsertLine = (id, who, text) =>
    setLines((prev) => {
      const i = prev.findIndex((l) => l.id === id);
      if (i === -1) return [...prev, { id, who, text }];
      const next = [...prev];
      next[i] = { ...next[i], text };
      return next;
    });

  const startCall = async (e) => {
    e.preventDefault();
    setError("");
    setLines([]);
    setStage("call");
    setAgentState("connecting");

    try {
      // 1. Ask our API for a private room and a ticket that also sends Riya into it
      const res = await fetch(`${API}/voice/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_name: form.candidate_name.trim(),
          role: form.role,
          phone: form.phone.replace(/\s/g, "") || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          Array.isArray(body.detail)
            ? body.detail.map((d) => `${d.loc[d.loc.length - 1]}: ${d.msg}`).join(" · ")
            : body.detail || `Could not start the call (${res.status})`
        );
      }
      const { server_url, participant_token } = await res.json();

      // 2. Join the LiveKit room
      const room = new Room();
      roomRef.current = room;

      // Play Riya's voice
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.dataset.riyaAudio = "true";
          document.body.appendChild(el);
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => track.detach().forEach((el) => el.remove()));

      // Riya's state (listening / thinking / speaking) is published as a participant attribute
      room.on(RoomEvent.ParticipantAttributesChanged, (changed) => {
        if (changed["lk.agent.state"]) setAgentState(changed["lk.agent.state"]);
      });
      room.on(RoomEvent.ParticipantConnected, () => setAgentState((s) => (s === "waiting" ? "initializing" : s)));

      // Live transcript of both sides, sent by the agent as text streams
      room.registerTextStreamHandler("lk.transcription", async (reader, participantInfo) => {
        const attrs = reader.info.attributes ?? {};
        const id = attrs["lk.segment_id"] ?? reader.info.id;
        const micSid = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.trackSid;
        const isMe =
          participantInfo.identity === room.localParticipant.identity ||
          (micSid && attrs["lk.transcribed_track_id"] === micSid);
        let text = "";
        for await (const chunk of reader) {
          text += chunk;
          upsertLine(id, isMe ? "you" : "riya", cleanText(text));
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        document.querySelectorAll("audio[data-riya-audio]").forEach((el) => el.remove());
        setAgentState("ended");
        setStage("ended");
      });

      await room.connect(server_url, participant_token);
      await room.startAudio();
      await room.localParticipant.setMicrophoneEnabled(true);
      setAgentState((s) => (s === "connecting" ? "waiting" : s));

      // If Riya hasn't joined after 20 seconds, the agent probably isn't running
      setTimeout(() => {
        if (roomRef.current === room && room.remoteParticipants.size === 0 && room.state === "connected") {
          setError("Riya hasn't joined yet. Check that the voice agent is running (lk agent dev, or deployed on LiveKit Cloud).");
        }
      }, 20000);
    } catch (err) {
      setError(
        err.name === "NotAllowedError"
          ? "Microphone access was blocked. Allow the microphone for this site and try again."
          : err.message
      );
      roomRef.current?.disconnect();
      setStage("form");
    }
  };

  const toggleMute = async () => {
    const room = roomRef.current;
    if (!room) return;
    await room.localParticipant.setMicrophoneEnabled(muted);
    setMuted(!muted);
  };

  const endCall = () => roomRef.current?.disconnect();

  const close = () => {
    roomRef.current?.disconnect();
    onClose(stage === "ended");
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal call-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{stage === "form" ? "Start a screening call" : `Screening call · ${form.candidate_name}`}</h2>
          <button className="icon-btn" onClick={close} title="Close">✕</button>
        </div>

        {error && <div className="error">{error}</div>}

        {stage === "form" && (
          <form onSubmit={startCall} className="form">
            <p className="muted small">
              Riya, the AI recruiter, will call this candidate in your browser. You play the candidate,
              so use your microphone. When the call ends, the result appears in the dashboard.
            </p>
            <label>
              Candidate name
              <input required value={form.candidate_name} onChange={update("candidate_name")} placeholder="Priya Nair" />
            </label>
            <div className="row">
              <label>
                Role applied for
                <select value={form.role} onChange={update("role")}>
                  {[...new Set([form.role, ...ROLES])].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </label>
              <label>
                Phone (optional)
                <input
                  value={form.phone}
                  onChange={update("phone")}
                  placeholder="+919876543210"
                  pattern="\+?[0-9 ]{10,18}"
                  title="10–15 digits, optionally starting with +"
                />
              </label>
            </div>
            <button className="btn">📞 Call with Riya</button>
          </form>
        )}

        {stage !== "form" && (
          <>
            <div className="call-stage">
              <div className={`orb large ${agentState}`}><span /></div>
              <div className="call-state-label">{STATE_LABELS[agentState] ?? agentState}</div>
              <div className="muted small">{form.role}{form.phone ? ` · ${form.phone}` : ""}</div>
            </div>

            <div className="transcript" ref={transcriptRef}>
              {lines.length === 0 ? (
                <p className="muted">The live transcript appears here once the conversation starts.</p>
              ) : (
                lines.map((l) => (
                  <div key={l.id} className={`bubble ${l.who}`}>
                    <span className="who">{l.who === "you" ? "Candidate (you)" : "Riya"}</span>
                    {l.text}
                  </div>
                ))
              )}
            </div>

            {stage === "call" ? (
              <div className="call-actions">
                <button className="btn ghost" onClick={toggleMute}>{muted ? "Unmute" : "Mute"}</button>
                <button className="btn danger" onClick={endCall}>End call</button>
              </div>
            ) : (
              <div className="call-actions">
                <p className="muted small">
                  Call ended. If Riya finished the screening, the result appears in the table within a few seconds.
                </p>
                <button className="btn" onClick={close}>Back to dashboard</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
