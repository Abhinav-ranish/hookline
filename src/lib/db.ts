import { env } from "cloudflare:workers";
import type { ChatMessage, Conversation, Question, Script } from "./schemas";

const db = () => (env as unknown as { DB: D1Database }).DB;
const now = () => new Date().toISOString();

type MessageRow = { id: string; role: "user" | "assistant"; content: string; script: string | null; questions: string | null; view_card: string | null; created_at: string };

const MESSAGE_COLUMNS = "id, role, content, script, questions, view_card, created_at";

const toMessage = (row: MessageRow): ChatMessage => ({
  id: row.id,
  role: row.role,
  content: row.content,
  script: row.script ? (JSON.parse(row.script) as Script) : null,
  questions: row.questions ? (JSON.parse(row.questions) as Question[]) : null,
  view: row.view_card ? (JSON.parse(row.view_card) as ChatMessage["view"]) : null,
  createdAt: row.created_at,
});

export async function listConversations(): Promise<Conversation[]> {
  const { results } = await db().prepare("SELECT id, title, updated_at FROM conversations ORDER BY updated_at DESC").all<{ id: string; title: string; updated_at: string }>();
  return results.map((r) => ({ id: r.id, title: r.title, updatedAt: r.updated_at }));
}

export async function createConversation(title: string): Promise<Conversation> {
  const conversation = { id: crypto.randomUUID(), title, updatedAt: now() };
  await db().prepare("INSERT INTO conversations (id, title, updated_at) VALUES (?, ?, ?)").bind(conversation.id, title, conversation.updatedAt).run();
  return conversation;
}

export const conversationExists = async (id: string) => (await db().prepare("SELECT 1 FROM conversations WHERE id = ?").bind(id).first()) !== null;

export async function deleteConversation(id: string) {
  await db().prepare("DELETE FROM conversations WHERE id = ?").bind(id).run();
}

export async function listMessages(conversationId: string): Promise<ChatMessage[]> {
  const { results } = await db().prepare(`SELECT ${MESSAGE_COLUMNS} FROM messages WHERE conversation_id = ? ORDER BY created_at, rowid`).bind(conversationId).all<MessageRow>();
  return results.map(toMessage);
}

export async function addMessage(conversationId: string, role: "user" | "assistant", content: string, script: Script | null = null, questions: Question[] | null = null, view: ChatMessage["view"] = null): Promise<ChatMessage> {
  const message: ChatMessage = { id: crypto.randomUUID(), role, content, script, questions, view, createdAt: now() };
  await db().batch([
    db()
      .prepare("INSERT INTO messages (id, conversation_id, role, content, script, questions, view_card, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(message.id, conversationId, role, content, script ? JSON.stringify(script) : null, questions ? JSON.stringify(questions) : null, view ? JSON.stringify(view) : null, message.createdAt),
    db().prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").bind(message.createdAt, conversationId),
  ]);
  return message;
}

export async function getMessage(id: string): Promise<ChatMessage | null> {
  const row = await db().prepare(`SELECT ${MESSAGE_COLUMNS} FROM messages WHERE id = ?`).bind(id).first<MessageRow>();
  return row ? toMessage(row) : null;
}

export async function updateScript(id: string, script: Script) {
  await db().prepare("UPDATE messages SET script = ? WHERE id = ?").bind(JSON.stringify(script), id).run();
}

export async function latestScript(conversationId: string): Promise<{ messageId: string; script: Script } | null> {
  const row = await db().prepare("SELECT id, script FROM messages WHERE conversation_id = ? AND script IS NOT NULL ORDER BY created_at DESC, rowid DESC LIMIT 1").bind(conversationId).first<{ id: string; script: string }>();
  return row ? { messageId: row.id, script: JSON.parse(row.script) as Script } : null;
}

export async function getCachedTrends<T>(key: string, maxAgeMs: number): Promise<{ value: T; fetchedAt: string } | null> {
  const row = await db().prepare("SELECT value, fetched_at FROM trend_cache WHERE key = ?").bind(key).first<{ value: string; fetched_at: string }>();
  if (!row || Date.now() - Date.parse(row.fetched_at) > maxAgeMs) return null;
  return { value: JSON.parse(row.value) as T, fetchedAt: row.fetched_at };
}

export async function setCachedTrends(key: string, value: unknown): Promise<string> {
  const fetchedAt = now();
  await db().prepare("INSERT OR REPLACE INTO trend_cache (key, value, fetched_at) VALUES (?, ?, ?)").bind(key, JSON.stringify(value), fetchedAt).run();
  return fetchedAt;
}

export async function latestTrendScan(): Promise<{ topic: string; scanned: number; fetchedAt: string } | null> {
  const row = await db().prepare("SELECT key, value, fetched_at FROM trend_cache ORDER BY fetched_at DESC LIMIT 1").first<{ key: string; value: string; fetched_at: string }>();
  return row ? { topic: row.key, scanned: (JSON.parse(row.value) as { scanned: number }).scanned, fetchedAt: row.fetched_at } : null;
}

export async function getSetting(key: string): Promise<string> {
  const row = await db().prepare("SELECT value FROM settings WHERE key = ?").bind(key).first<{ value: string }>();
  return row?.value ?? "";
}

export async function setSetting(key: string, value: string) {
  await db().prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").bind(key, value).run();
}
