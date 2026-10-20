/** Widget configuration provided by the embedding site. */
export interface WidgetConfig {
  /** Unguessable app ID (UUID) the new chat endpoint addresses. */
  app_id: string;
  /** core-service origin, e.g. https://ai.example.com. */
  base_url: string;
  /** Optional display name shown in the panel header; defaults to a localized "AI Support". */
  title?: string;
  /** Optional locale tag (e.g. zh-CN, en); defaults to the browser language. */
  locale?: string;
}

/** One grounding chunk of a RAG answer. */
export interface Reference {
  text: string;
  score: number;
  document_name: string;
}

/** Body of POST /api/v1/pub/chat/completions/{project}/{app}. */
export interface ChatRequestBody {
  conversation_id?: string;
  user_id?: string;
  message: string;
}

/** Response of the public chat endpoint. */
export interface ChatResponseBody {
  conversation_id: string;
  user_id: string;
  message_id: string;
  answer: string;
  references: Reference[] | null;
  usage: { prompt_tokens: number; completion_tokens: number };
}

/** A message kept in the local conversation history. */
export interface StoredMessage {
  role: 'user' | 'assistant';
  text: string;
  references?: Reference[];
}

/** What the widget persists in localStorage per project+app. */
export interface StoredConversation {
  user_id?: string;
  conversation_id?: string;
  messages: StoredMessage[];
}

/** One curated FAQ entry of the app (answer null = chat starter). */
export interface FaqEntry {
  question: string;
  answer: string | null;
}

/** Response of GET /api/v1/pub/apps/{app_id}/faq. */
export interface FaqResponseBody {
  questions: FaqEntry[];
}

export class ChatApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ChatApiError';
  }
}
