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
const DROPPED_TAGS = new Set(['script', 'style', 'object', 'embed', 'title', 'textarea']);

/** http(s) or relative URLs; blocks javascript:, data:, vbscript:, … */
function isSafeMediaUrl(url: string): boolean {
  return /^(https?:)?\/\//i.test(url) || url.startsWith('/');
}

/** Strips every attribute so only explicitly re-added safe ones remain. */
function clearAttributes(el: Element): void {
  for (const attr of [...el.attributes]) el.removeAttribute(attr.name);
}

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
    const tag = node.tagName.toLowerCase();

    if (DROPPED_TAGS.has(tag)) {
      node.remove();
      continue;
    }
    if (tag === 'img') {
      const img = node as HTMLImageElement;
      const src = img.getAttribute('src') ?? '';
      const alt = img.alt;
      if (!isSafeMediaUrl(src)) {
        img.replaceWith(node.ownerDocument.createTextNode(alt || '[image]'));
        continue;
      }
      clearAttributes(img); // drops onerror & friends
      img.setAttribute('src', src);
      img.setAttribute('alt', alt);
      img.setAttribute('loading', 'lazy');
      img.setAttribute('referrerpolicy', 'no-referrer');
      continue;
    }
    if (tag === 'video') {
      const video = node as HTMLVideoElement;
      const src = video.getAttribute('src') ?? '';
      if (src && !isSafeMediaUrl(src)) {
        video.remove();
        continue;
      }
      clearAttributes(video);
      if (src) video.setAttribute('src', src);
      video.setAttribute('controls', '');
      video.setAttribute('preload', 'metadata');
      video.setAttribute('playsinline', '');
      continue;
    }
    if (tag === 'source') {
      const src = node.getAttribute('src') ?? '';
      const type = node.getAttribute('type') ?? '';
      clearAttributes(node);
      if (isSafeMediaUrl(src)) {
        node.setAttribute('src', src);
        if (type) node.setAttribute('type', type);
      } else {
        node.remove();
      }
      continue;
    }
    if (tag === 'iframe') {
      const src = node.getAttribute('src') ?? '';
      if (!isSafeMediaUrl(src)) {
        node.remove();
        continue;
      }
      clearAttributes(node); // drops allow-same-origin style escape hatches
      node.setAttribute('src', src);
      node.setAttribute('sandbox', 'allow-scripts allow-popups allow-presentation');
      node.setAttribute('allowfullscreen', '');
      node.setAttribute('loading', 'lazy');
      node.setAttribute('referrerpolicy', 'no-referrer');
      continue;
    }
    if (!ALLOWED_TAGS.has(tag)) {
      node.replaceWith(...node.childNodes); // unwrap: keep the text
      continue;
    }
    if (tag === 'a') {
      const anchor = node as HTMLAnchorElement;
      const href = anchor.getAttribute('href') ?? '';
      if (isSafeMediaUrl(href) || href.startsWith('#')) {
        anchor.setAttribute('href', href);
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
      } else {
        anchor.removeAttribute('href'); // javascript:, data:, … — plain text
      }
      continue;
    }
    clearAttributes(node); // no classes, styles, or handlers
  }
}
