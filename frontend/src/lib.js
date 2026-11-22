import { useEffect, useRef, useState } from "react";

// The backend URL: localhost while developing, your Render URL once deployed
export const API = import.meta.env.VITE_API_URL;

// Outcomes are statuses, so each always shows an icon + label, never colour alone
export const OUTCOMES = [
  { key: "shortlisted", label: "Shortlisted", icon: "✓", hint: "Meets the role's needs" },
  { key: "callback", label: "Callback", icon: "↻", hint: "Asked to talk later" },
  { key: "rejected", label: "Rejected", icon: "✕", hint: "Misses a requirement" },
  { key: "no answer", label: "No answer", icon: "–", hint: "Didn't pick up" },
];
export const OUTCOME = Object.fromEntries(OUTCOMES.map((o) => [o.key, o]));
export const SUGGESTED_ROLES = ["Data Analyst", "Backend Engineer", "Customer Support Executive", "Sales Associate"];
export const PLACEHOLDER_PHONE = "+910000000000";

export const slug = (outcome) => outcome.replace(/\s+/g, "-");
export const isBotCall = (c) => (c.notes || "").startsWith("[Voice bot");
export const cleanNotes = (notes) => (notes || "").replace(/^\[Voice bot[^\]]*\]\s*/, "");

export const initials = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

export const formatDuration = (s) => (s == null ? "—" : `${Math.floor(s / 60)}m ${s % 60}s`);
export const formatHours = (s) => {
  if (!s) return "0m";
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};
export const formatCTC = (v) => (v == null ? "—" : `₹${Number(v)} LPA`);
export const formatExp = (v) => (v == null ? "—" : `${Number(v)} yrs`);
export const formatNotice = (v) => (v == null ? "—" : `${v} days`);
export const formatTime = (iso) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

// Turn FastAPI's errors into one readable line
export async function readError(res) {
  try {
    const body = await res.json();
    if (Array.isArray(body.detail)) return body.detail.map((d) => `${d.loc[d.loc.length - 1]}: ${d.msg}`).join(" · ");
    return body.detail || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export async function apiFetch(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      ...options,
      headers: options.body ? { "Content-Type": "application/json", ...(options.headers || {}) } : options.headers,
      // Give up after 60 s (long enough for Render's free plan to wake up) instead of waiting forever
      signal: AbortSignal.timeout(60000),
    });
  } catch (e) {
    if (e.name === "TimeoutError") {
      throw new Error(`The API at ${API} didn't answer within 60 seconds. Check that the backend is running and has no errors.`);
    }
    throw new Error(`Can't reach the API at ${API}. Check that the backend is running (or, on Render's free plan, give it a minute to wake up).`);
  }
  if (!res.ok) throw new Error(await readError(res));
  return res.status === 204 ? null : res.json();
}

// Animate a number from its previous value to the new one
export function useCountUp(value, duration = 700) {
  const [shown, setShown] = useState(typeof value === "number" ? value : 0);
  const from = useRef(shown);
  useEffect(() => {
    if (typeof value !== "number") return;
    const start = performance.now();
    const begin = from.current;
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = begin + (value - begin) * eased;
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return shown;
}

// Re-render every 30 s so "2m ago" labels stay fresh
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
