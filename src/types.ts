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
  /** UI instruction for the widget, e.g. {type: "open_form"}. */
  action?: { type: string } | null;
}

/** One field of the app's customer-service form definition. */
export interface FormField {
  key: string;
  label: string;
  type: string; // text | textarea
  required: boolean;
}

/** The app's stored form definition; the widget keeps a default when
 *  the backend returns null. */
export interface FormConfig {
  title: string;
  description: string;
  fields: FormField[];
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
  id: string;
  question: string;
  answer: string | null;
}

/**
 * Stored display customization, verbatim: null when the app was never
 * customized, and only the fields the admin actually set are present.
 * The widget owns every default; each set field overrides it.
 */
export interface WidgetSettings {
  display_name?: string;
  greeting?: string;
  theme_color?: string;
  avatar_url?: string;
  position?: string;
  input_placeholder?: string;
  show_faq?: boolean;
  faq_limit?: number;
}

/** Response of GET /api/v1/pub/apps/{app_id}/widget: the stored
 *  customization (nullable), the form definition (nullable), and the
 *  FAQ entries to show — the backend already applied show_faq/faq_limit
 *  when resolving the list. */
export interface WidgetBootstrap {
  widget: WidgetSettings | null;
  form: FormConfig | null;
  faqs: FaqEntry[] | null;
}

/** Response of GET /api/v1/pub/apps/{app_id}/faqs. */
export interface FaqPagedResponse {
  faqs: FaqEntry[];
  page: number;
  page_size: number;
  total: number;
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
