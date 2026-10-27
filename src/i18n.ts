/** Every user-facing string of the widget, per locale. */
export interface WidgetStrings {
  defaultTitle: string;
  inputPlaceholder: string;
  inputAria: string;
  sendAria: string;
  launcherAria: string;
  panelAria: string;
  closeTitle: string;
  closeAria: string;
  newChatTitle: string;
  newChatAria: string;
  heroHi: string;
  heroIdentity: (title: string) => string;
  heroSubtitle: string;
  newConversationNotice: string;
  refreshFaqs: string;
  faqAria: string;
  copyAria: string;
  copy: string;
  copied: string;
  copyFailed: string;
  errorRetryHint: string;
  refsSummary: (count: number) => string;
  networkError: string;
  httpError: (status: number) => string;
  formAria: string;
  formSubmit: string;
  formSuccessTitle: string;
  formSuccessText: string;
  formRequired: (label: string) => string;
  formSubmitFailed: string;
  defaultFormTitle: string;
  defaultFormFieldLabel: string;
}

const zhCN: WidgetStrings = {
  defaultTitle: '智能客服',
  inputPlaceholder: '输入消息…',
  inputAria: '消息输入框',
  sendAria: '发送',
  launcherAria: '打开智能客服',
  panelAria: '智能客服聊天窗口',
  closeTitle: '关闭',
  closeAria: '关闭聊天窗口',
  newChatTitle: '清空聊天记录并开启新会话',
  newChatAria: '开启新会话',
  heroHi: 'Hi～',
  heroIdentity: (title) => `我是 ${title} 🙌`,
  heroSubtitle: '遇到问题、想了解什么，直接告诉我就好',
  newConversationNotice: '已为你开启新的会话。有什么可以帮你的吗？',
  refreshFaqs: '换一批',
  faqAria: '常见问题',
  copyAria: '复制回答',
  copy: '复制',
  copied: '已复制',
  copyFailed: '复制失败',
  errorRetryHint: '（你的消息已恢复到输入框，可直接重试）',
  refsSummary: (count) => `引用了 ${count} 个来源`,
  networkError: '无法连接客服服务，请稍后重试',
  httpError: (status) => `请求失败（HTTP ${status}）`,
  formAria: '填写表单',
  formSubmit: '提交',
  formSuccessTitle: '提交成功',
  formSuccessText: '我们已收到你的信息，会尽快与你联系。',
  formRequired: (label) => `请填写「${label}」`,
  formSubmitFailed: '提交失败',
  defaultFormTitle: '联系我们',
  defaultFormFieldLabel: '描述',
};

const en: WidgetStrings = {
  defaultTitle: 'AI Support',
  inputPlaceholder: 'Type a message…',
  inputAria: 'Message input',
  sendAria: 'Send',
  launcherAria: 'Open AI support chat',
  panelAria: 'AI support chat window',
  closeTitle: 'Close',
  closeAria: 'Close chat window',
  newChatTitle: 'Clear history and start a new conversation',
  newChatAria: 'Start a new conversation',
  heroHi: 'Hi~',
  heroIdentity: (title) => `I'm ${title} 🙌`,
  heroSubtitle: 'Questions, problems, ideas — just tell me',
  newConversationNotice: 'Started a new conversation. How can I help you?',
  refreshFaqs: 'Refresh',
  faqAria: 'Frequently asked questions',
  copyAria: 'Copy answer',
  copy: 'Copy',
  copied: 'Copied',
  copyFailed: 'Copy failed',
  errorRetryHint: '(Your message was restored to the input box — you can retry.)',
  refsSummary: (count) => `Cited ${count} source${count === 1 ? '' : 's'}`,
  networkError: 'Cannot reach the support service. Please try again later.',
  httpError: (status) => `Request failed (HTTP ${status})`,
  formAria: 'Fill in the form',
  formSubmit: 'Submit',
  formSuccessTitle: 'Submitted',
  formSuccessText: "We received your information and will get back to you soon.",
  formRequired: (label) => `Please fill in "${label}"`,
  formSubmitFailed: 'Submit failed',
  defaultFormTitle: 'Contact us',
  defaultFormFieldLabel: 'Description',
};

const DICTS: Record<string, WidgetStrings> = { 'zh-CN': zhCN, en };

/**
 * Picks the dictionary for a locale. Falls back to the browser language
 * when no locale is configured, then to English for unknown languages
 * (any Chinese variant maps to zh-CN).
 */
export function stringsFor(locale?: string): WidgetStrings {
  const tag = locale ?? navigator.language ?? 'en';
  if (DICTS[tag]) return DICTS[tag];
  if (tag.toLowerCase().startsWith('zh')) return DICTS['zh-CN'];
  return DICTS.en;
}
