# easy-chat-widget

An embeddable AI customer-service chat widget for third-party websites. Once embedded, a support button appears in the bottom-right corner of the site; clicking it opens a chat window whose messages are answered by the public chat endpoint of [core-service](../core-service) using the app's RAG knowledge base.

## Quick Start

```html
<script
  src="https://<your-core-service-host>/widget/easy-widget.js"
  data-app-id="d19f5e7c-a67d-47d2-8761-6f6e7988396b"
></script>
```

Or set a global before the script loads:

```html
<script>
  window.EasyAIChatWidget = {
    app_id: 'd19f5e7c-a67d-47d2-8761-6f6e7988396b',
    base_url: 'https://your-core-service-host',
    title: 'Support',
  };
</script>
<script src="easy-widget.js"></script>
```

## Configuration

| Option | Required | Description |
| --- | --- | --- |
| `app_id` | Yes | The app's ID (UUID, obtained after creating the app in core-service); the endpoint resolves the knowledge base and model from it |
| `base_url` | No | core-service origin; defaults to the origin the script itself is served from (omit when core-service hosts the script) |
| `title` | No | Fallback display name used only when the backend bootstrap is unreachable; defaults to a localized "AI Support" / 智能客服 |
| `locale` | No | UI language tag (`zh-CN`, `en`); defaults to the visitor's browser language. To add a language, extend the dictionaries in `src/i18n.ts` |

Both configuration styles may be combined; `data-*` attributes take precedence. The global object also accepts camelCase aliases (`appId`, `baseUrl`). The effective configuration is logged to the browser console at startup as `[easy-widget] booted with …` — check it when requests seem to hit the wrong origin.

## Appearance customization

The widget's default look is built in; per-app customization is served by `GET {base_url}/api/v1/pub/apps/{app_id}/widget` (loaded once at page load to theme the launcher, and reloaded on every panel open so admin changes apply without a page refresh). The `widget` object carries only the fields the admin actually set (`null` when never customized) and each set field overrides the built-in default:

| Field | Effect |
| --- | --- |
| `display_name` | Name in the hero identity line |
| `greeting` | Replaces the hero subtitle line |
| `theme_color` | Launcher, send button, user bubbles, links, focus rings (hex only; invalid values fall back to the default indigo) |
| `avatar_url` | Round avatar in the hero; absolute http(s) or a path relative to the core-service origin (e.g. `/api/v1/pub/uploads/…`) |
| `position` | `right` (default) or `left` launcher/panel placement |
| `input_placeholder` | Composer placeholder |
| `show_faq` / `faq_limit` | Resolved backend-side into the `faqs` list the widget renders; `faq_limit` also sets the batch size of the refresh control |

When the endpoint is unreachable the widget keeps its defaults entirely.

## Behavior

- Calls `POST {base_url}/api/v1/pub/chat/completions/{app_id}` — no authentication; the app is addressed by its unguessable UUID, so project and app names are never exposed to the frontend.
- The `user_id` / `conversation_id` returned by the server are persisted in localStorage (namespaced per app_id) and resubmitted automatically to keep the context; the last 50 messages are stored locally so the history survives reloads.
- The panel opens on a greeting hero above the FAQ card, both fed by the widget bootstrap. The card shows up to `faq_limit` backend-curated entries (`show_faq: false` hides it) and the refresh control below cycles to the next batch (via the paged `faqs` endpoint, wrapping back to the first); entries with a canned answer display instantly without a chat round-trip, entries without one send the question through the chat pipeline.
- The clear-history button in the panel header wipes the local history and identifiers so the next message starts a fresh server-side conversation; an in-flight answer from the cleared conversation is aborted and discarded.
- Answers grounded in RAG chunks show a collapsible "cited N sources" section listing each source.
- Assistant answers render as GitHub-flavored markdown (headings, lists, tables, code blocks, links, images, and raw img/video/iframe embeds) with the input treated as untrusted text: everything outside a whitelist is escaped or unwrapped, media sources must be http(s) or relative, event handlers and non-HTTP link schemes are stripped, and iframes are sandboxed; media is size-constrained to stay inside the panel. The copy button copies the raw markdown source.
- Every assistant answer carries a copy button (async Clipboard API, with an `execCommand` fallback for non-secure http embeds); it flips to "copied" for two seconds on success.
- All styles live inside a Shadow DOM and cannot interfere with (or be affected by) the host page; on small screens (≤480px) the panel goes fullscreen.

## Development

```bash
npm run dev     # start the dev server and open the demo page at the project root
npm run build   # build dist/easy-widget.js (single-file IIFE, zero dependencies)
```

Local testing requires core-service running on `127.0.0.1:8080` (see ../core-service). To verify the built bundle: run `npm run build`, then serve the demo/ directory with any static file server and open `demo.html`.

## Note

The public chat endpoint requires CORS on core-service for `/api/v1/pub/*` (core-service's `middleware.CORS` is mounted on the public route group); without it, cross-origin calls from third-party sites are blocked by the browser.
