/**
 * Workspace entry passwords — a soft gate consistent with the app's v1
 * client-trust model.
 *
 * A workspace's password is stored as a SHA-256 HASH in
 * appConfig.workspacePasswordHash (never plaintext). We hash the entered
 * password in the browser and compare. NOTE: because workspace isolation is
 * still client-side in v1 (data queries aren't yet server-guarded — Phase 7),
 * this is a UX barrier, not hard security. When server guards land, the
 * verification should move server-side too.
 */

// SHA-256 hex digest of a string via the Web Crypto API.
export async function hashPassword(plain) {
  const data = new TextEncoder().encode(String(plain));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Workspaces the user has unlocked THIS browser session, so they aren't
// re-prompted on every switch. Session-scoped: cleared when the tab closes and
// on logout.
const UNLOCK_KEY = "wf_ws_unlocked";

function readUnlocked() {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(UNLOCK_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

export function isWorkspaceUnlocked(ws) {
  return readUnlocked().has(ws);
}

export function markWorkspaceUnlocked(ws) {
  try {
    const s = readUnlocked();
    s.add(ws);
    sessionStorage.setItem(UNLOCK_KEY, JSON.stringify([...s]));
  } catch {
    /* ignore */
  }
}

export function clearWorkspaceUnlocks() {
  try {
    sessionStorage.removeItem(UNLOCK_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Whether the current user must enter a password before opening `workspace`.
 * The Main Admin bypasses (all-access superuser — this prevents lockout, since
 * only they can reset a forgotten workspace password from Settings).
 */
export function workspaceNeedsPassword({ passwordHash, workspace, isMainAdmin }) {
  if (isMainAdmin) return false;
  if (!passwordHash) return false;
  return !isWorkspaceUnlocked(workspace);
}
