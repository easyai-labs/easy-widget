import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: true, async: false });

/** Elements markdown itself may produce; anything else in the answer is
 *  unwrapped (its text survives, the tag does not). */
const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'em', 'strong', 'del', 's',
  'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
]);

/** Elements whose entire content is code, not prose — drop them whole. */
const DROPPED_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'title', 'textarea']);

/**
 * Renders assistant answers as GitHub-flavored markdown into the given
 * element. The input is untrusted LLM output, so the parsed result is
 * sanitized in a detached document: only whitelisted elements survive
 * (with all attributes stripped except validated link hrefs), images
 * degrade to their alt text, and links to non-HTTP schemes lose their
 * href.
 */
export function renderMarkdown(el: HTMLElement, markdown: string): void {
  const html = marked.parse(markdown) as string;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  sanitize(doc.body);
  el.innerHTML = doc.body.innerHTML;
}

function sanitize(root: HTMLElement): void {
  for (const node of [...root.querySelectorAll('*')]) {
    if (node.parentElement === null) continue; // already detached

    if (DROPPED_TAGS.has(node.tagName.toLowerCase())) {
      node.remove();
      continue;
    }
    if (node.tagName === 'IMG') {
      // Never auto-load remote images from answers (tracking vector).
      node.replaceWith(node.ownerDocument.createTextNode((node as HTMLImageElement).alt || '[image]'));
      continue;
    }
    if (!ALLOWED_TAGS.has(node.tagName.toLowerCase())) {
      node.replaceWith(...node.childNodes); // unwrap: keep the text
      continue;
    }
    if (node.tagName === 'A') {
      const anchor = node as HTMLAnchorElement;
      const href = anchor.getAttribute('href') ?? '';
      if (/^(https?:)?\/\//i.test(href) || href.startsWith('/') || href.startsWith('#')) {
        anchor.setAttribute('href', href);
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
      } else {
        anchor.removeAttribute('href'); // javascript:, data:, … — plain text
      }
      continue;
    }
    for (const attr of [...node.attributes]) {
      node.removeAttribute(attr.name); // no classes, styles, or handlers
    }
  }
}
