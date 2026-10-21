import { afterEach, describe, expect, it, vi } from 'vitest';

import { kindOf, listChoices, loadArticles, loadForum, loadWiki, toSource } from './sniplets';

afterEach(() => vi.unstubAllGlobals());
const reply = (body: unknown, ok = true) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 403, json: async () => body }));

describe('kindOf / toSource', () => {
  it('reconnaît les 4 types', () => {
    expect(kindOf({ application: 'blog', template: 'articles' })).toBe('articles');
    expect(kindOf({ application: 'wiki', template: 'wiki' })).toBe('wiki');
    expect(kindOf({ application: 'forum', template: 'forum' })).toBe('forum');
    expect(kindOf({ application: 'community', template: 'message' })).toBe('message');
  });
  it('type inconnu ou absent → undefined', () => {
    expect(kindOf({ application: 'calendar', template: 'agenda' })).toBeUndefined();
    expect(kindOf(undefined)).toBeUndefined();
  });
  it('toSource : blog b1', () => expect(toSource('articles', 'b1')).toEqual({ application: 'blog', template: 'articles', source: { _id: 'b1' } }));
});

describe('chargement', () => {
  it('articles : seulement les publiés, du plus récent au plus ancien, 5 au plus', async () => {
    const posts = Array.from({ length: 7 }, (_, i) => ({ _id: `p${i}`, title: `A${i}`, content: `<p>${i}</p>`, state: 'PUBLISHED', modified: { $date: `2026-10-0${i + 1}T00:00:00Z` } }));
    reply([...posts, { _id: 'brouillon', title: 'B', state: 'DRAFT', modified: { $date: '2026-12-01T00:00:00Z' } }]);
    const out = await loadArticles('b1');
    expect(out).toHaveLength(5);
    expect(out[0].id).toBe('p6');
    expect(out.map((a) => a.id)).not.toContain('brouillon');
  });
  it('wiki : page d\'accueil + titres des autres pages visibles', async () => {
    reply({ pages: [{ title: 'Suite', isVisible: true }, { title: 'Accueil', content: '<p>x</p>', isIndex: true }, { title: 'Caché', isVisible: false }] });
    const out = await loadWiki('w1');
    expect(out.index).toEqual({ title: 'Accueil', content: '<p>x</p>' });
    expect(out.others).toEqual(['Suite']);
  });
  it('forum : titres des sujets', async () => {
    reply([{ title: 'S1' }, { title: 'S2' }]);
    expect((await loadForum('c1')).subjects).toEqual(['S1', 'S2']);
  });
  it('listes de choix et erreur serveur', async () => {
    reply([{ _id: 'b1', title: 'Mon blog' }]);
    expect(await listChoices('articles')).toEqual([{ id: 'b1', label: 'Mon blog' }]);
    reply({}, false);
    await expect(loadForum('c1')).rejects.toThrow('403');
  });
});
