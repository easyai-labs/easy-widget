import { ChatApiError } from './types';
import type { WidgetStrings } from './i18n';
import type {
  ChatRequestBody,
  ChatResponseBody,
  FaqResponseBody,
  WidgetConfig,
} from './types';

/**
 * Client for the core-service public chat endpoint:
 * POST {base_url}/api/v1/pub/chat/completions/{app_id}
 */
export class ChatApiClient {
  constructor(
    private readonly config: WidgetConfig,
    private readonly strings: WidgetStrings,
  ) {}

  private get endpoint(): string {
    const { base_url, app_id } = this.config;
    return `${base_url}/api/v1/pub/chat/completions/${encodeURIComponent(app_id)}`;
  }

  async chat(body: ChatRequestBody, signal?: AbortSignal): Promise<ChatResponseBody> {
    let res: Response;
    try {
      res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err;
      throw new ChatApiError(0, this.strings.networkError);
    }

    if (!res.ok) {
      throw new ChatApiError(res.status, await this.errorMessage(res));
    }
    return (await res.json()) as ChatResponseBody;
  }

  /** The app's curated FAQ; entries without an answer are chat starters. */
  async faqs(): Promise<FaqResponseBody> {
    const { base_url, app_id } = this.config;
    let res: Response;
    try {
      res = await fetch(
        `${base_url}/api/v1/pub/apps/${encodeURIComponent(app_id)}/faq`,
      );
    } catch {
      throw new ChatApiError(0, this.strings.networkError);
    }
    if (!res.ok) {
      throw new ChatApiError(res.status, await this.errorMessage(res));
    }
    return (await res.json()) as FaqResponseBody;
  }

  /** Prefer the server's error field, fall back to the HTTP reason. */
  private async errorMessage(res: Response): Promise<string> {
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) return data.error;
    } catch {
      // Not a JSON error body.
    }
    return this.strings.httpError(res.status);
  }
}
