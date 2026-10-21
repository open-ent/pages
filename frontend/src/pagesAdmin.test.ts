import { describe, expect, it } from 'vitest';

import { canManageSite, duplicatePage, movePage, pageLink, removePage, renamePage, reindexPages, rightsEntries } from './pagesAdmin';

const pages = () => reindexPages([{ title: 'Accueil', titleLink: 'accueil' }, { title: 'Planning', titleLink: 'planning' }, { title: 'Contact', titleLink: 'contact' }]);

describe('pageLink', () => {
  it('retire espaces, ponctuation et accents', () => expect(pageLink('Ma page été', [])).toBe('mapageete'));
  it('suffixe quand le lien existe', () => {
    expect(pageLink('Planning', ['planning'])).toBe('planning-1');
    expect(pageLink('Planning', ['planning', 'planning-1'])).toBe('planning-2');
  });
});

describe('ordre', () => {
  it('monte, descend, réindexe', () => {
    const up = movePage(pages(), 1, -1);
    expect(up.map((p) => p.titleLink)).toEqual(['planning', 'accueil', 'contact']);
    expect(up.map((p) => p.index)).toEqual([0, 1, 2]);
    expect(movePage(pages(), 0, -1)).toEqual(pages());
    expect(movePage(pages(), 2, 1)).toEqual(pages());
  });
});

describe('renommer / dupliquer / supprimer', () => {
  it('renomme sans changer le lien ; titre vide ignoré', () => {
    const out = renamePage(pages(), 1, '  Emploi du temps ');
    expect(out[1]).toMatchObject({ title: 'Emploi du temps', titleLink: 'planning' });
    expect(renamePage(pages(), 1, '   ')).toEqual(pages());
  });
  it('duplique en fin de liste avec un lien unique', () => {
    const out = duplicatePage(pages(), 1, 'copie');
    expect(out).toHaveLength(4);
    expect(out[3]).toMatchObject({ title: 'Planning (copie)', index: 3 });
    expect(out[3].titleLink).not.toBe('planning');
    expect(duplicatePage(out, 1, 'copie')[4].titleLink).not.toBe(out[3].titleLink);
  });
  it('supprimer l\'accueil reporte l\'accueil sur la première page restante', () => {
    const out = removePage(pages(), 0, 'accueil');
    expect(out.pages.map((p) => p.titleLink)).toEqual(['planning', 'contact']);
    expect(out.landingPage).toBe('planning');
    expect(removePage(pages(), 2, 'accueil').landingPage).toBe('accueil');
    expect(removePage(pages().slice(0, 1), 0, 'accueil').landingPage).toBeUndefined();
  });
});

describe('droits', () => {
  const site = { owner: { userId: 'u1' }, shared: [{ groupId: 'g1', 'fr-wseduc-pages-controllers-PagesController|manager': true }, { userId: 'u2', 'fr-wseduc-pages-controllers-PagesController|update': true }] };
  it('propriétaire du site ou de la page, gestionnaire via groupe', () => {
    expect(canManageSite(site, undefined, 'u1')).toBe(true);
    expect(canManageSite(site, { owner: 'u3' }, 'u3')).toBe(true);
    expect(canManageSite(site, undefined, 'u4', ['g1'])).toBe(true);
  });
  it('contributeur simple ou inconnu : non', () => {
    expect(canManageSite(site, undefined, 'u2')).toBe(false);
    expect(canManageSite(site, undefined, undefined)).toBe(false);
  });
  it('lignes de droits : seulement les partages actifs, cochés selon contrib', () => {
    const share = { groups: { visibles: [{ id: 'g1', name: 'Profs' }, { id: 'g2', name: 'Élèves' }], checked: { g1: ['x'] } }, users: { visibles: [{ id: 'u2', username: 'Alice' }], checked: { u2: ['x'] } } };
    expect(rightsEntries(share, ['u2'])).toEqual([
      { id: 'g1', name: 'Profs', type: 'group', checked: false },
      { id: 'u2', name: 'Alice', type: 'user', checked: true },
    ]);
  });
});
