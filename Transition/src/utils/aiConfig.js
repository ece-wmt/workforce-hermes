// ── Gemini AI assistant configuration ───────────────────────────────────────
//
// API KEY: paste your Gemini key in ONE of these places (checked in order):
//   1. Settings → AI Assistant  (stored in localStorage as "wf_gemini_key")
//   2. .env.local  →  VITE_GEMINI_API_KEY=your_key_here   (then restart dev)
//
// The key lives client-side (this is an internal tool). If you'd rather keep it
// off the browser, we can move the Gemini call into a Convex action later.

// Model tier — "flash lite". The primary + a backup (used automatically if the
// primary is missing / rate-limited / erroring). Override either in .env.local
// via VITE_GEMINI_MODEL and VITE_GEMINI_MODEL_FALLBACK.
//   • gemini-flash-lite-latest  → currently resolves to gemini-3.1-flash-lite
//   • gemini-flash-latest       → heavier "flash" fallback
const DEFAULT_MODEL = "gemini-flash-lite-latest";
const DEFAULT_FALLBACK = "gemini-flash-latest";

export const GEMINI_MODEL = (import.meta.env.VITE_GEMINI_MODEL || DEFAULT_MODEL).trim();
export const GEMINI_MODEL_FALLBACK = (import.meta.env.VITE_GEMINI_MODEL_FALLBACK || DEFAULT_FALLBACK).trim();

// Ordered, de-duplicated model list the client tries in turn.
export function getGeminiModels() {
  return [...new Set([GEMINI_MODEL, GEMINI_MODEL_FALLBACK].map((m) => (m || "").trim()).filter(Boolean))];
}

// Google Search grounding lets Caddy research the web — but it draws on a
// SEPARATE grounding quota that the free tier barely allows, so leaving it on
// causes 429s even when token/RPD usage is tiny. OFF by default; set
// VITE_GEMINI_WEB_SEARCH=true once you have billing/quota for grounding.
export const ENABLE_WEB_SEARCH = String(import.meta.env.VITE_GEMINI_WEB_SEARCH || "").toLowerCase() === "true";

// Google Generative Language REST endpoint.
export const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

const KEY_STORAGE = "wf_gemini_key";

export function getGeminiApiKey() {
  try {
    const fromSettings = (localStorage.getItem(KEY_STORAGE) || "").trim();
    if (fromSettings) return fromSettings;
  } catch {
    /* localStorage unavailable */
  }
  return (import.meta.env.VITE_GEMINI_API_KEY || "").trim();
}

export function setGeminiApiKey(key) {
  try {
    if (key && key.trim()) localStorage.setItem(KEY_STORAGE, key.trim());
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* ignore */
  }
}

export function hasGeminiApiKey() {
  return !!getGeminiApiKey();
}

// ── Enable / disable the whole Caddy assistant ──────────────────────────────
const ENABLED_STORAGE = "wf_caddy_enabled";

export function isCaddyEnabled() {
  try {
    return localStorage.getItem(ENABLED_STORAGE) !== "false"; // default ON
  } catch {
    return true;
  }
}

export function setCaddyEnabled(on) {
  try {
    localStorage.setItem(ENABLED_STORAGE, on ? "true" : "false");
  } catch {
    /* ignore */
  }
  // Let the app react live (App listens for this to show/hide the launcher).
  try { window.dispatchEvent(new Event("caddy-enabled-changed")); } catch { /* ssr */ }
}
