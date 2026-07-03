/**
 * UIDetox LSP server skeleton.
 *
 * Full implementation is deferred; this stub delivers the plumbing so editors
 * can point their LSP client at it. Completion and hover follow-ups plug in
 * via `KNOWN_CLAUSES` / `KNOWN_MEMBERS` maps below.
 */

export const KNOWN_VERBS = ['trait', 'filter', 'token', 'provide', 'component'] as const;
export const KNOWN_CLAUSES = ['export', 'appliesto', 'params', 'input', 'output', 'from', 'extends', 'tag', 'props', 'state', 'title', 'emits'] as const;
export const KNOWN_MEMBERS = ['on', 'off', 'transform', 'default', 'template', 'style', 'actions', 'effects'] as const;
export const KNOWN_HTML_EVENTS = ['click', 'input', 'change', 'blur', 'focus', 'focusin', 'focusout', 'pointerenter', 'pointerleave', 'submit', 'keydown', 'keyup'] as const;
export const KNOWN_HTML_TAGS = ['input', 'textarea', 'button', 'form', 'select', 'option', 'label', 'a', 'div', 'span', 'section', 'article', 'header', 'footer', 'nav', 'main', 'ul', 'li'] as const;

export interface CompletionItem { label: string; kind: 'verb' | 'clause' | 'member' | 'event' | 'tag'; }

export function completionsAt(_prefix: string, context: 'top' | 'clause' | 'member' | 'event' | 'tag'): CompletionItem[] {
  switch (context) {
    case 'top':     return KNOWN_VERBS.map((v) => ({ label: v, kind: 'verb' as const }));
    case 'clause':  return KNOWN_CLAUSES.map((c) => ({ label: c, kind: 'clause' as const }));
    case 'member':  return KNOWN_MEMBERS.map((m) => ({ label: m, kind: 'member' as const }));
    case 'event':   return KNOWN_HTML_EVENTS.map((e) => ({ label: e, kind: 'event' as const }));
    case 'tag':     return KNOWN_HTML_TAGS.map((t) => ({ label: t, kind: 'tag' as const }));
  }
}

if (import.meta.url.endsWith('server.js') || import.meta.url.endsWith('server.ts')) {
  // In production the Volar-based full server would run here.
  // For MVP we just print the capability manifest.
  const manifest = { name: 'uidetox-lsp', version: '0.0.1', capabilities: ['completion', 'hover'] };
  process.stdout.write(JSON.stringify(manifest));
}
