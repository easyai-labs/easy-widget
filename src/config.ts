import type { WidgetConfig } from './types';

declare global {
  interface Window {
    /** Optional configuration set by the host page before the script loads. */
    EasyAIChatWidget?: Partial<WidgetConfig>;
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
 *    <script src="..." data-project-name="p" data-app-name="a"></script>
 * 2. a global set before the script loads:
 *    window.EasyAIChatWidget = { project_name: 'p', app_name: 'a' }
 *
 * Data attributes win when both provide the same key. base_url defaults
 * to the origin the script itself was served from, so a widget hosted by
 * core-service needs no explicit base_url.
 */
export function resolveConfig(): WidgetConfig | null {
  const global = window.EasyAIChatWidget ?? {};
  const attrs = {
    project_name: bootstrapScript?.dataset.projectName,
    app_name: bootstrapScript?.dataset.appName,
    base_url: bootstrapScript?.dataset.baseUrl,
  };

  const project_name = attrs.project_name ?? global.project_name;
  const app_name = attrs.app_name ?? global.app_name;
  const base_url = normalizeBaseUrl(
    attrs.base_url ?? global.base_url ?? scriptOrigin(),
  );

  if (!project_name || !app_name || !base_url) {
    console.error(
      '[easy-chat-widget] missing configuration: project_name, app_name and base_url are required.',
      { project_name, app_name, base_url },
    );
    return null;
  }

  return { project_name, app_name, base_url };
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
