/**
 * Assainit le HTML d'une page avant affichage (contenus saisis par des utilisateurs : risque de XSS stocké).
 * Liste blanche de balises et d'attributs ; tout le reste est retiré (le texte des balises inconnues est conservé).
 * `allowIframe` n'est vrai que pour les cellules « vidéo » : l'iframe n'est gardée que si sa source est en https.
 */
const ALLOWED_TAGS = new Set([
  'a', 'b', 'blockquote', 'br', 'code', 'div', 'em', 'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img',
  'li', 'ol', 'p', 'pre', 's', 'span', 'strong', 'sub', 'sup', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul',
]);
const DROPPED_WITH_CONTENT = new Set(['script', 'style', 'object', 'embed', 'link', 'meta', 'form', 'input', 'button', 'textarea', 'select', 'noscript', 'template']);
const ALLOWED_ATTRS = new Set(['href', 'src', 'alt', 'title', 'class', 'style', 'colspan', 'rowspan', 'target', 'rel', 'width', 'height', 'controls']);
/** Balises de lecteur, admises seulement dans une cellule vidéo (`allowIframe`). */
const MEDIA_TAGS = new Set(['video', 'audio', 'source']);
const ALLOWED_STYLE_PROPS = new Set([
  'color', 'background-color', 'text-align', 'font-size', 'font-weight', 'font-style', 'font-family', 'text-decoration', 'width', 'height',
  'margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right', 'padding', 'float', 'display', 'line-height',
]);

/** Adresse autorisée : http(s), mailto, relative (/…, #…, ./…). Ex. « javascript:alert(1) » est refusée. */
export function isSafeUrl(url: string, allowHttpOnly = false): boolean {
  const u = url.trim().replace(/[\u0000-\u001f\s]+/g, '');
  if (/^(https?:)?\/\//i.test(u)) return true;
  if (allowHttpOnly) return false;
  return /^(mailto:|\/|#|\.\/|\.\.\/)/i.test(u) || !/^[a-z][a-z0-9+.-]*:/i.test(u);
}

/** Ne garde de `style` que les propriétés autorisées, sans valeur dangereuse (url(), expression…). */
export function cleanStyle(style: string): string {
  return style
    .split(';')
    .map((d) => d.trim())
    .filter((d) => {
      const i = d.indexOf(':');
      if (i < 0) return false;
      const prop = d.slice(0, i).trim().toLowerCase();
      const value = d.slice(i + 1).toLowerCase();
      return ALLOWED_STYLE_PROPS.has(prop) && !/url\s*\(|expression|javascript:|@import|behavior/.test(value);
    })
    .join('; ');
}

function cleanNode(node: Node, doc: Document, allowIframe: boolean): Node | null {
  if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.textContent ?? '');
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (DROPPED_WITH_CONTENT.has(tag)) return null;
  if (tag === 'iframe') {
    const src = el.getAttribute('src') ?? '';
    if (!allowIframe || !isSafeUrl(src, true)) return null;
    const f = doc.createElement('iframe');
    f.setAttribute('src', src);
    f.setAttribute('allowfullscreen', '');
    f.setAttribute('loading', 'lazy');
    f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-popups');
    for (const a of ['width', 'height', 'title']) if (el.hasAttribute(a)) f.setAttribute(a, el.getAttribute(a)!);
    return f;
  }
  if (!ALLOWED_TAGS.has(tag) && !(allowIframe && MEDIA_TAGS.has(tag))) {
    // balise inconnue : on garde son contenu (texte, balises autorisées) sans la balise
    const frag = doc.createDocumentFragment();
    el.childNodes.forEach((c) => { const n = cleanNode(c, doc, allowIframe); if (n) frag.appendChild(n); });
    return frag;
  }
  const out = doc.createElement(tag);
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    if (!ALLOWED_ATTRS.has(name)) continue;
    if ((name === 'href' || name === 'src') && !isSafeUrl(attr.value)) continue;
    if (name === 'style') {
      const s = cleanStyle(attr.value);
      if (s) out.setAttribute('style', s);
      continue;
    }
    out.setAttribute(name, attr.value);
  }
  if (tag === 'a') out.setAttribute('rel', 'noopener noreferrer');
  el.childNodes.forEach((c) => { const n = cleanNode(c, doc, allowIframe); if (n) out.appendChild(n); });
  return out;
}

export function sanitizeHtml(html: string, allowIframe = false): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const holder = doc.createElement('div');
  doc.body.childNodes.forEach((c) => { const n = cleanNode(c, doc, allowIframe); if (n) holder.appendChild(n); });
  return holder.innerHTML;
}
