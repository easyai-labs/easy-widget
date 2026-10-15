import type { WidgetConfig } from './types';

/**
 * The global config object. Canonical keys are snake_case; camelCase
 * aliases are accepted because host pages frequently write them.
 */
export interface WidgetGlobal {
  app_id?: string;
  appId?: string;
  base_url?: string;
  baseUrl?: string;
  title?: string;
}

declare global {
  interface Window {
    /** Optional configuration set by the host page before the script loads. */
    EasyAIChatWidget?: WidgetGlobal;
  }
}

/**
 * Captured while the bundle executes: document.currentScript is only set
 * during the script's own synchronous run, and is null again by the time
 * boot may be deferred (e.g. to DOMContentLoaded).
 */
const bootstrapScript = document.currentScript as HTMLScriptElement | null;

/**
 * Resolve the widget configuration. Both sources are supported:
 *
 * 1. data attributes on the script tag:
 *    <script src="..." data-app-id="uuid" data-title="客服"></script>
 * 2. a global set before the script loads:
 *    window.EasyAIChatWidget = { app_id: 'uuid' }
 *
 * Data attributes win when both provide the same key. base_url defaults
 * to the origin the script itself was served from, so a widget hosted by
 * core-service needs no explicit base_url.
 */
export function resolveConfig(): WidgetConfig | null {
  if (!bootstrapScript) {
    console.info(
      '[easy-widget] loaded without its own <script> context (e.g. as an ES module or bundled by the host app); data-* attributes cannot be read — configure via window.EasyAIChatWidget.',
    );
  }
  const global = window.EasyAIChatWidget ?? {};
  const attrs = {
    app_id: bootstrapScript?.dataset.appId,
    base_url: bootstrapScript?.dataset.baseUrl,
    title: bootstrapScript?.dataset.title,
  };

  const app_id = attrs.app_id ?? global.app_id ?? global.appId;
  const base_url = normalizeBaseUrl(
    attrs.base_url ?? global.base_url ?? global.baseUrl ?? scriptOrigin(),
  );
  const title = attrs.title ?? global.title;

  if (!app_id || !base_url) {
    console.error(
      '[easy-widget] missing configuration: app_id and base_url are required.',
      { app_id, base_url },
    );
    return null;
  }

  const config = { app_id, base_url, title };
  console.info('[easy-widget] booted with', config);
  return config;
}

/** The origin serving this script, when it can be determined. */
function scriptOrigin(): string | undefined {
  const src = bootstrapScript?.src;
  if (!src) return undefined;
  try {
    return new URL(src, document.baseURI).origin;
  } catch {
    return undefined;
  }
}

/** Strip a trailing slash so base_url + path joins cleanly. */
function normalizeBaseUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return url.replace(/\/+$/, '');
}
