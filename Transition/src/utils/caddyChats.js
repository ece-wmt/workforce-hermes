// Local persistence for Caddy chat sessions (per browser).
// A session: { id, title, ts, messages:[{role,text,error?}], contents:[Gemini turns] }

const KEY = "wf_caddy_chats";
const MAX = 30; // keep the most recent N chats

export function loadChats() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveChat(session) {
  if (!session || !session.id || !(session.messages || []).length) return;
  const all = loadChats().filter((c) => c.id !== session.id);
  all.unshift(session);
  try {
    localStorage.setItem(KEY, JSON.stringify(all.slice(0, MAX)));
  } catch {
    /* storage full — ignore */
  }
}

export function deleteChat(id) {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadChats().filter((c) => c.id !== id)));
  } catch {
    /* ignore */
  }
}

export function newSessionId() {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
