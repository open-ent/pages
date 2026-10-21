// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { cleanStyle, isSafeUrl, sanitizeHtml } from './sanitize';
import { normalizeRows, subRows } from './gridModel';
import { isPagePublished } from './utils';

describe('sanitizeHtml', () => {
  it('retire les scripts et les gestionnaires d\'événements', () => {
    const out = sanitizeHtml('<p onclick="x()">Bonjour</p><script>alert(1)</script><img src="/a.png" onerror="y()">');
    expect(out).toContain('<p>Bonjour</p>');
    expect(out).not.toMatch(/script|onclick|onerror/i);
    expect(out).toContain('<img src="/a.png">');
  });
  it('refuse les liens javascript: mais garde le texte', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">cliquer</a>');
    expect(out).not.toContain('javascript');
    expect(out).toContain('cliquer');
  });
  it('ne garde une iframe que pour une vidéo https', () => {
    const iframe = '<iframe src="https://video.example/embed/1"></iframe>';
    expect(sanitizeHtml(iframe)).toBe('');
    expect(sanitizeHtml(iframe, true)).toContain('<iframe');
    expect(sanitizeHtml('<iframe src="javascript:alert(1)"></iframe>', true)).toBe('');
    expect(sanitizeHtml('<iframe src="/local"></iframe>', true)).toBe('');
  });
  it('admet les lecteurs vidéo/audio seulement dans une cellule vidéo, avec une source sûre', () => {
    const video = '<video controls src="/workspace/document/42"></video>';
    expect(sanitizeHtml(video, true)).toContain('<video controls="" src="/workspace/document/42">');
    expect(sanitizeHtml(video)).toBe('');
    expect(sanitizeHtml('<video src="javascript:alert(1)"></video>', true)).not.toContain('javascript');
  });
  it('filtre les styles dangereux', () => {
    expect(cleanStyle('color:red; background:url(javascript:x); text-align:center')).toBe('color:red; text-align:center');
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('/workspace/document/1')).toBe(true);
  });
  it('conserve le contenu d\'une balise inconnue', () => {
    expect(sanitizeHtml('<custom-tag>texte <b>gras</b></custom-tag>')).toBe('texte <b>gras</b>');
  });
});

describe('grille', () => {
  it('trie lignes et cellules et borne la largeur', () => {
    const rows = normalizeRows([
      { index: 1, cells: [{ index: 0, width: 4 }] },
      { index: 0, cells: [{ index: 1, width: 6 }, { index: 0, width: 0 }, { index: 2, width: 99 }] },
    ]);
    expect(rows[0].cells!.map((c) => c.width)).toEqual([12, 6, 12]);
    expect(rows[1].cells![0].width).toBe(4);
  });
  it('lit les sous-pages d\'une cellule « grille »', () => {
    expect(subRows({ media: { type: 'grid', source: { rows: [{ index: 0, cells: [{ width: 12 }] }] } } })).toHaveLength(1);
    expect(subRows({ media: { type: 'grid' } })).toEqual([]);
  });
  it('publiée par défaut', () => {
    expect(isPagePublished({})).toBe(true);
    expect(isPagePublished({ published: false })).toBe(false);
  });
});
