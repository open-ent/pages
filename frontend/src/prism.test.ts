import { describe, expect, it } from 'vitest';

import { escapeHtml, highlightStyle } from './prism';

describe('highlightStyle', () => {
  it('sans Prism : le texte est échappé tel quel', () => {
    expect(highlightStyle(null, 'a > b { x: "<y>"; }')).toBe('a &gt; b { x: "&lt;y&gt;"; }');
  });
  it('avec Prism : le HTML coloré est celui de la grammaire CSS', () => {
    const prism = { languages: { css: {} }, highlight: (text: string, _g: unknown, lang: string) => `<span class="token ${lang}">${escapeHtml(text)}</span>` };
    expect(highlightStyle(prism, 'p { color: red; }')).toBe('<span class="token css">p { color: red; }</span>');
  });
  it('un retour à la ligne final reste visible (espace ajouté) pour que la dernière ligne ait sa hauteur', () => {
    expect(highlightStyle(null, 'a\n')).toBe('a\n ');
  });
  it('grammaire CSS absente : texte échappé', () => {
    expect(highlightStyle({ languages: {}, highlight: () => 'x' }, '<b>')).toBe('&lt;b&gt;');
  });
});
