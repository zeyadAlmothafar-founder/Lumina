import Dexie from 'dexie';

// LuminaDB — one table for all session types.
// Each record: { id (auto), type, title, data, createdAt }
export const db = new Dexie('LuminaDB');

db.version(1).stores({
  sessions: '++id, type, createdAt',
});

// ── Session types ─────────────────────────────────────────────────────────────
// 'gps'        → { goal, weeks, hours, roadmap }
// 'quiz'       → { topic, cards }
// 'debate'     → { topic, totalRounds, history, synthesis }
// 'exam'       → { subject, difficulty, history, report }
// 'whiteboard' → { messages }

export async function saveSession(type, title, data) {
  return db.sessions.add({ type, title, data, createdAt: new Date() });
}

export async function updateSession(id, data) {
  return db.sessions.update(id, { data, updatedAt: new Date() });
}

export async function getAllSessions() {
  return db.sessions.orderBy('createdAt').reverse().toArray();
}

export async function getSessionsByType(type) {
  return db.sessions.where('type').equals(type).reverse().sortBy('createdAt');
}

export async function deleteSession(id) {
  return db.sessions.delete(id);
}

export async function clearAllSessions() {
  return db.sessions.clear();
}
