import type { StoredConversation } from './types';

const HISTORY_CAP = 50;

/**
 * Persists the end user's identifiers and visible message history in
 * localStorage, namespaced per app so several widgets on the same site
 * do not collide.
 */
export class ConversationStore {
  private readonly key: string;

  constructor(appId: string) {
    this.key = `easychat:${appId}`;
  }

  load(): StoredConversation {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return { messages: [] };
      const parsed = JSON.parse(raw) as StoredConversation;
      if (!Array.isArray(parsed.messages)) return { messages: [] };
      return parsed;
    } catch {
      // Corrupted or unavailable storage (private mode): start fresh.
      return { messages: [] };
    }
  }

  save(conv: StoredConversation): void {
    const trimmed: StoredConversation = {
      ...conv,
      messages: conv.messages.slice(-HISTORY_CAP),
    };
    try {
      localStorage.setItem(this.key, JSON.stringify(trimmed));
    } catch {
      // Storage full or blocked; the chat still works without persistence.
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.key);
    } catch {
      // Ignore, see save().
    }
  }
}
