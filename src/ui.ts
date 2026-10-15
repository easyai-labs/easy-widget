import styles from './styles.css?inline';
import type { ChatApiClient } from './api';
import type { ConversationStore } from './storage';
import type { Reference, StoredMessage, WidgetConfig } from './types';

const MAX_MESSAGE_LENGTH = 4096;

const ICON_CHAT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
const ICON_CLOSE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const ICON_BOT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8V4"/><circle cx="12" cy="3" r="1"/><circle cx="9" cy="13" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="13" r="1" fill="currentColor" stroke="none"/></svg>`;
const ICON_RESET = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>`;
const ICON_SEND = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" stroke="none"/></svg>`;

const DEFAULT_TITLE = '智能客服';

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
  private pending = false;

  constructor(
    private readonly config: WidgetConfig,
    private readonly api: ChatApiClient,
    private readonly store: ConversationStore,
  ) {
    this.host = document.createElement('easy-chat-widget');
    const root = this.host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>${styles}</style>
      <div class="panel" hidden role="dialog" aria-label="智能客服聊天窗口">
        <header class="panel-header">
          <div class="avatar">${ICON_BOT}</div>
          <div class="header-text">
            <div class="header-title"></div>
            <div class="header-status"><span class="status-dot"></span><span>在线</span></div>
          </div>
          <div class="header-actions">
            <button type="button" class="icon-btn reset-btn" title="新建会话" aria-label="新建会话">${ICON_RESET}</button>
            <button type="button" class="icon-btn close-btn" title="关闭" aria-label="关闭聊天窗口">${ICON_CLOSE}</button>
          </div>
        </header>
        <div class="messages"></div>
        <form class="composer">
          <textarea rows="1" placeholder="输入消息…" maxlength="${MAX_MESSAGE_LENGTH}" aria-label="消息输入框"></textarea>
          <button type="submit" class="send-btn" aria-label="发送">${ICON_SEND}</button>
        </form>
      </div>
      <button type="button" class="launcher" aria-label="打开智能客服" aria-expanded="false">${ICON_CHAT}</button>
    `;

    this.panel = root.querySelector('.panel')!;
    this.messagesEl = root.querySelector('.messages')!;
    this.inputEl = root.querySelector('textarea')!;
    this.sendBtnEl = root.querySelector('.send-btn')!;
    root.querySelector('.header-title')!.textContent = this.config.title ?? DEFAULT_TITLE;

    const launcher = root.querySelector('.launcher')!;
    launcher.addEventListener('click', () => this.toggle());
    root.querySelector('.close-btn')!.addEventListener('click', () => this.toggle(false));
    root.querySelector('.reset-btn')!.addEventListener('click', () => this.resetConversation());

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
      this.renderMessage({ role: 'assistant', text: `你好！我是 ${this.config.title ?? DEFAULT_TITLE}，有什么可以帮你的吗？` });
    } else {
      for (const msg of stored.messages) this.renderMessage(msg);
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.toggle(false);
    });
  }

  private toggle(open?: boolean): void {
    const willOpen = open ?? this.panel.hidden;
    this.panel.hidden = !willOpen;
    const launcher = this.host.shadowRoot!.querySelector('.launcher') as HTMLButtonElement;
    launcher.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) this.inputEl.focus();
  }

  /** Drop the stored conversation and start over with the greeting. */
  private resetConversation(): void {
    this.store.clear();
    this.messagesEl.replaceChildren();
    this.renderMessage({ role: 'assistant', text: '已为你开始新的会话，请问有什么可以帮你？' });
  }

  private async sendMessage(): Promise<void> {
    if (this.pending) return;
    const text = this.inputEl.value.trim();
    if (!text) return;

    this.inputEl.value = '';
    this.autogrow();
    this.renderMessage({ role: 'user', text });
    this.setPending(true);

    const conv = this.store.load();
    try {
      const res = await this.api.chat({
        message: text,
        user_id: conv.user_id,
        conversation_id: conv.conversation_id,
      });
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
      // Put the failed text back so the visitor can retry with one click.
      this.inputEl.value = text;
      this.autogrow();
      this.renderMessage({
        role: 'assistant',
        text: `${(err as Error).message}\n（你的消息已恢复到输入框，可直接重试）`,
        isError: true,
      });
    } finally {
      this.setPending(false);
      this.inputEl.focus();
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
    } else {
      el.className = `message message--${msg.role}`;
      el.textContent = msg.text; // textContent: never inject raw HTML
      if (msg.role === 'assistant' && msg.references && msg.references.length > 0) {
        el.appendChild(this.renderReferences(msg.references));
      }
    }
    this.messagesEl.querySelector('.typing')?.remove();
    this.messagesEl.appendChild(el);
    this.scrollToEnd();
  }

  /** Collapsible list of the grounding chunks behind an answer. */
  private renderReferences(refs: Reference[]): HTMLElement {
    const details = document.createElement('details');
    details.className = 'refs';
    const summary = document.createElement('summary');
    summary.textContent = `引用了 ${refs.length} 个来源`;
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
