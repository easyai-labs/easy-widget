import styles from './styles.css?inline';
import { renderMarkdown } from './markdown';
import { stringsFor } from './i18n';
import type { WidgetStrings } from './i18n';
import type { ChatApiClient } from './api';
import type { ConversationStore } from './storage';
import type { FaqEntry } from './types';
import type { Reference, StoredMessage, WidgetConfig } from './types';

const MAX_MESSAGE_LENGTH = 4096;

const ICON_CHAT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
const ICON_CLOSE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const ICON_BOT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8V4"/><circle cx="12" cy="3" r="1"/><circle cx="9" cy="13" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="13" r="1" fill="currentColor" stroke="none"/></svg>`;
const ICON_RESET = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>`;
const ICON_SEND = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" stroke="none"/></svg>`;
const ICON_COPY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const ICON_CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;

/**
 * The chat widget UI: a launcher button fixed to the bottom-right corner
 * and a chat panel, both rendered inside a shadow root so the host page's
 * CSS cannot affect them.
 */
export class ChatWidget {
  private readonly host: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly messagesEl: HTMLElement;
  private readonly inputEl: HTMLTextAreaElement;
  private readonly sendBtnEl: HTMLButtonElement;
  private readonly t: WidgetStrings;
  private pending = false;
  /** Bumped on every history clear; in-flight responses from an older
   *  epoch are stale (their conversation was discarded) and get dropped. */
  private epoch = 0;
  /** Aborts the in-flight chat request when the history is cleared. */
  private abortCtl: AbortController | null = null;
  /** Curated FAQ of the app, kept so a fresh conversation can re-show it. */
  private faqs: FaqEntry[] = [];

  constructor(
    private readonly config: WidgetConfig,
    private readonly api: ChatApiClient,
    private readonly store: ConversationStore,
  ) {
    this.t = stringsFor(config.locale);
    this.host = document.createElement('easy-chat-widget');
    const root = this.host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>${styles}</style>
      <div class="panel" hidden role="dialog" aria-label="${this.t.panelAria}">
        <header class="panel-header">
          <div class="avatar">${ICON_BOT}</div>
          <div class="header-text">
            <div class="header-title"></div>
            <div class="header-status"><span class="status-dot"></span><span>${this.t.statusOnline}</span></div>
          </div>
          <div class="header-actions">
            <button type="button" class="new-chat-btn" title="${this.t.newChatTitle}" aria-label="${this.t.newChatAria}">${ICON_RESET}<span>${this.t.newChatLabel}</span></button>
            <button type="button" class="icon-btn close-btn" title="${this.t.closeTitle}" aria-label="${this.t.closeAria}">${ICON_CLOSE}</button>
          </div>
        </header>
        <div class="messages"></div>
        <form class="composer">
          <textarea rows="1" placeholder="${this.t.inputPlaceholder}" maxlength="${MAX_MESSAGE_LENGTH}" aria-label="${this.t.inputAria}"></textarea>
          <button type="submit" class="send-btn" aria-label="${this.t.sendAria}">${ICON_SEND}</button>
        </form>
      </div>
      <button type="button" class="launcher" aria-label="${this.t.launcherAria}" aria-expanded="false">${ICON_CHAT}</button>
    `;

    this.panel = root.querySelector('.panel')!;
    this.messagesEl = root.querySelector('.messages')!;
    this.inputEl = root.querySelector('textarea')!;
    this.sendBtnEl = root.querySelector('.send-btn')!;
    root.querySelector('.header-title')!.textContent = this.config.title ?? this.t.defaultTitle;

    const launcher = root.querySelector('.launcher')!;
    launcher.addEventListener('click', () => this.toggle());
    root.querySelector('.close-btn')!.addEventListener('click', () => this.toggle(false));
    root.querySelector('.new-chat-btn')!.addEventListener('click', () => this.clearHistory());

    const form = root.querySelector('form')!;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.sendMessage();
    });
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void this.sendMessage();
      }
    });
    this.inputEl.addEventListener('input', () => this.autogrow());
  }

  /** Append the widget to the page and restore any stored history. */
  mount(): void {
    document.body.appendChild(this.host);
    const stored = this.store.load();
    if (stored.messages.length === 0) {
      this.renderMessage({ role: 'assistant', text: this.t.greeting(this.config.title ?? this.t.defaultTitle) });
      void this.loadFaqs(); // suggestions for a fresh conversation
    } else {
      for (const msg of stored.messages) this.renderMessage(msg);
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.toggle(false);
    });
  }

  /** Fetch the curated FAQ; failures are silent — it is an enhancement. */
  private async loadFaqs(): Promise<void> {
    try {
      const res = await this.api.faqs();
      this.faqs = (res.questions ?? []).filter((entry) => entry.question);
      this.renderFaqs();
    } catch {
      // FAQ is optional; the chat keeps working without it.
    }
  }

  /** Show the FAQ chips below the greeting of a fresh conversation. */
  private renderFaqs(): void {
    this.messagesEl.querySelector('.faq-list')?.remove();
    if (this.faqs.length === 0) return;
    const list = document.createElement('div');
    list.className = 'faq-list';
    const heading = document.createElement('div');
    heading.className = 'faq-heading';
    heading.textContent = this.t.faqHeading;
    list.appendChild(heading);
    for (const entry of this.faqs) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'faq-chip';
      chip.textContent = entry.question;
      chip.addEventListener('click', () => {
        list.remove();
        if (entry.answer && entry.answer.trim() !== '') {
          // Curated answer: show it directly, no chat round-trip.
          this.renderMessage({ role: 'user', text: entry.question });
          this.renderMessage({ role: 'assistant', text: entry.answer });
          this.inputEl.focus();
        } else {
          // No canned answer: ask through the normal chat pipeline.
          this.inputEl.value = entry.question;
          void this.sendMessage();
        }
      });
      list.appendChild(chip);
    }
    this.messagesEl.appendChild(list);
    this.scrollToEnd();
  }

  private toggle(open?: boolean): void {
    const willOpen = open ?? this.panel.hidden;
    this.panel.hidden = !willOpen;
    const launcher = this.host.shadowRoot!.querySelector('.launcher') as HTMLButtonElement;
    launcher.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) this.inputEl.focus();
  }

  /** Drop the stored history and identifiers, starting a new conversation. */
  private clearHistory(): void {
    this.epoch++;
    this.abortCtl?.abort(); // the in-flight request belongs to the discarded conversation
    this.abortCtl = null;
    this.store.clear();
    this.messagesEl.replaceChildren();
    if (this.pending) this.setPending(false); // free the composer immediately
    this.renderMessage({ role: 'assistant', text: this.t.newConversationNotice });
    this.renderFaqs(); // fresh conversation: suggest the FAQ again
  }

  private async sendMessage(): Promise<void> {
    if (this.pending) return;
    const text = this.inputEl.value.trim();
    if (!text) return;

    this.inputEl.value = '';
    this.autogrow();
    this.renderMessage({ role: 'user', text });
    this.setPending(true);
    const epoch = this.epoch;
    this.abortCtl = new AbortController();

    const conv = this.store.load();
    try {
      const res = await this.api.chat(
        {
          message: text,
          user_id: conv.user_id,
          conversation_id: conv.conversation_id,
        },
        this.abortCtl.signal,
      );
      if (epoch !== this.epoch) return; // history was cleared mid-flight
      this.renderMessage({ role: 'assistant', text: res.answer, references: res.references ?? [] });
      this.store.save({
        user_id: res.user_id,
        conversation_id: res.conversation_id,
        messages: [
          ...conv.messages,
          { role: 'user', text },
          { role: 'assistant', text: res.answer, references: res.references ?? [] },
        ],
      });
    } catch (err) {
      if (epoch !== this.epoch) return; // history was cleared mid-flight
      // Put the failed text back so the visitor can retry with one click.
      this.inputEl.value = text;
      this.autogrow();
      this.renderMessage({
        role: 'assistant',
        text: `${(err as Error).message}\n${this.t.errorRetryHint}`,
        isError: true,
      });
    } finally {
      this.abortCtl = null;
      if (epoch === this.epoch) {
        this.setPending(false);
        this.inputEl.focus();
      }
    }
  }

  private setPending(pending: boolean): void {
    this.pending = pending;
    this.sendBtnEl.disabled = pending;
    this.inputEl.disabled = pending;
    this.messagesEl.querySelector('.typing')?.remove();
    if (pending) {
      const typing = document.createElement('div');
      typing.className = 'typing';
      typing.innerHTML = '<span></span><span></span><span></span>';
      this.messagesEl.appendChild(typing);
      this.scrollToEnd();
    }
  }

  /** Append one message bubble (or error notice) to the panel. */
  private renderMessage(msg: StoredMessage & { isError?: boolean }): void {
    const el = document.createElement('div');
    if (msg.isError) {
      el.className = 'message message--error';
      el.textContent = msg.text;
    } else if (msg.role === 'assistant') {
      el.className = 'message message--assistant';
      renderMarkdown(el, msg.text); // answers arrive as markdown
      if (msg.references && msg.references.length > 0) {
        el.appendChild(this.renderReferences(msg.references));
      }
      el.appendChild(this.renderCopyButton(msg.text));
    } else {
      el.className = 'message message--user';
      el.textContent = msg.text; // visitor input stays literal
    }
    this.messagesEl.querySelector('.typing')?.remove();
    this.messagesEl.appendChild(el);
    this.scrollToEnd();
  }

  /** Copy-to-clipboard action shown under assistant answers. */
  private renderCopyButton(text: string): HTMLElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-btn';
    btn.setAttribute('aria-label', this.t.copyAria);
    btn.innerHTML = `${ICON_COPY}<span>${this.t.copy}</span>`;
    btn.addEventListener('click', () => {
      void copyText(text).then((ok) => {
        btn.classList.add(ok ? 'copied' : 'failed');
        btn.innerHTML = ok
          ? `${ICON_CHECK}<span>${this.t.copied}</span>`
          : `${ICON_CLOSE}<span>${this.t.copyFailed}</span>`;
        setTimeout(() => {
          btn.classList.remove('copied', 'failed');
          btn.innerHTML = `${ICON_COPY}<span>${this.t.copy}</span>`;
        }, 2000);
      });
    });
    return btn;
  }

  /** Collapsible list of the grounding chunks behind an answer. */
  private renderReferences(refs: Reference[]): HTMLElement {
    const details = document.createElement('details');
    details.className = 'refs';
    const summary = document.createElement('summary');
    summary.textContent = this.t.refsSummary(refs.length);
    const list = document.createElement('ul');
    for (const ref of refs) {
      const item = document.createElement('li');
      item.className = 'ref-item';
      const name = document.createElement('div');
      name.className = 'ref-name';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = ref.document_name;
      const score = document.createElement('span');
      score.className = 'ref-score';
      score.textContent = `${(ref.score * 100).toFixed(0)}%`;
      name.append(nameSpan, score);
      const text = document.createElement('div');
      text.textContent = ref.text;
      item.append(name, text);
      list.appendChild(item);
    }
    details.append(summary, list);
    return details;
  }

  private autogrow(): void {
    this.inputEl.style.height = 'auto';
    this.inputEl.style.height = `${Math.min(this.inputEl.scrollHeight, 110)}px`;
  }

  private scrollToEnd(): void {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }
}

/**
 * Copy text to the clipboard. Falls back to a hidden textarea +
 * execCommand when the async Clipboard API is unavailable (non-secure
 * http embeds) or rejected.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
