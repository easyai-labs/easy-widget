import { ChatApiClient } from './api';
import { resolveConfig } from './config';
import { stringsFor } from './i18n';
import { ConversationStore } from './storage';
import { ChatWidget } from './ui';

/**
 * easy-chat-widget entry point. Boot once per page: read the config from
 * the global object or the script's data attributes, then mount the
 * launcher button and chat panel.
 */
function boot(): void {
  if (document.querySelector('easy-chat-widget')) return; // already booted

  const config = resolveConfig();
  if (!config) return; // resolveConfig logged the problem

  const api = new ChatApiClient(config, stringsFor(config.locale));
  const store = new ConversationStore(config.app_id);
  new ChatWidget(config, api, store).mount();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
