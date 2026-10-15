# easy-chat-widget

An embeddable AI customer-service chat widget for third-party websites. Once embedded, a support button appears in the bottom-right corner of the site; clicking it opens a chat window whose messages are answered by the public chat endpoint of [core-service](../core-service) using the app's RAG knowledge base.

## Quick Start

```html
<script
  src="https://<your-core-service-host>/widget/easy-chat-widget.js"
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
<script src="easy-chat-widget.js"></script>
```

## Configuration

| Option | Required | Description |
| --- | --- | --- |
| `app_id` | Yes | The app's ID (UUID, obtained after creating the app in core-service); the endpoint resolves the knowledge base and model from it |
| `base_url` | No | core-service origin; defaults to the origin the script itself is served from (omit when core-service hosts the script) |
| `title` | No | Name shown in the panel header and greeting; defaults to 智能客服 ("AI Support") |

Both configuration styles may be combined; `data-*` attributes take precedence.

## Behavior

- Calls `POST {base_url}/api/v1/pub/chat/completions/{app_id}` — no authentication; the app is addressed by its unguessable UUID, so project and app names are never exposed to the frontend.
- The `user_id` / `conversation_id` returned by the server are persisted in localStorage (namespaced per app_id) and resubmitted automatically to keep the context; the last 50 messages are stored locally so the history survives reloads.
- The clear-history button in the panel header wipes the local history and identifiers (with a two-click confirmation) so the next message starts a fresh server-side conversation; an in-flight answer from the cleared conversation is aborted and discarded.
- Answers grounded in RAG chunks show a collapsible "cited N sources" section listing each source.
- Every assistant answer carries a copy button (async Clipboard API, with an `execCommand` fallback for non-secure http embeds); it flips to "copied" for two seconds on success.
- All styles live inside a Shadow DOM and cannot interfere with (or be affected by) the host page; on small screens (≤480px) the panel goes fullscreen.

## Development

```bash
npm run dev     # start the dev server and open the demo page at the project root
npm run build   # build dist/easy-chat-widget.js (single-file IIFE, zero dependencies)
```

Local testing requires core-service running on `127.0.0.1:8080` (see ../core-service). To verify the built bundle: run `npm run build`, then serve the demo/ directory with any static file server and open `demo.html`.

## Note

The public chat endpoint requires CORS on core-service for `/api/v1/pub/*` (core-service's `middleware.CORS` is mounted on the public route group); without it, cross-origin calls from third-party sites are blocked by the browser.
