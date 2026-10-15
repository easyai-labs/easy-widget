import { ChatApiError } from './types';
import type { ChatRequestBody, ChatResponseBody, WidgetConfig } from './types';

/**
 * Client for the core-service public chat endpoint:
 * POST {base_url}/api/v1/pub/chat/completions/{project}/{app}
 */
export class ChatApiClient {
  constructor(private readonly config: WidgetConfig) {}

  private get endpoint(): string {
    const { base_url, project_name, app_name } = this.config;
    return `${base_url}/api/v1/pub/chat/completions/${encodeURIComponent(project_name)}/${encodeURIComponent(app_name)}`;
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
      throw new ChatApiError(0, '无法连接客服服务，请稍后重试');
    }

    if (!res.ok) {
      throw new ChatApiError(res.status, await errorMessage(res));
    }
    return (await res.json()) as ChatResponseBody;
  }
}

/** Prefer the server's error field, fall back to the HTTP reason. */
async function errorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    if (data?.error) return data.error;
  } catch {
    // Not a JSON error body.
  }
  return `请求失败（HTTP ${res.status}）`;
}
