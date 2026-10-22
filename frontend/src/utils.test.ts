import { describe, expect, it } from 'vitest';

import { isGridPage, pagePreview, slugify, visiblePages, landingPageOf, matchingPage, canUpdateSite, pageWeight, pageUrl, HEAVY_PAGE_WEIGHT } from './utils';

describe('pagePreview', () => {
  it('retire les balises HTML', () => {
    expect(pagePreview('<p>Bonjour <strong>monde</strong></p>')).toBe('Bonjour monde');
  });
  it('tronque au-delà de la longueur max', () => {
    expect(pagePreview('<p>' + 'a'.repeat(200) + '</p>', 10)).toBe(`${'a'.repeat(10)}…`);
  });
  it('renvoie une chaîne vide pour une entrée absente', () => {
    expect(pagePreview(undefined)).toBe('');
    expect(pagePreview('')).toBe('');
  });
});

describe('isGridPage', () => {
  it('une page avec des lignes de grille vient de l\'éditeur AngularJS', () => {
    expect(isGridPage({ rows: [{ cells: [] }] })).toBe(true);
    expect(isGridPage({ rows: [] })).toBe(false);
    expect(isGridPage({})).toBe(false);
  });
});

describe('slugify', () => {
  it('minuscules, accents retirés, tirets', () => {
    expect(slugify('Ma page été !')).toBe('ma-page-ete');
    expect(slugify('  À propos  ')).toBe('a-propos');
  });
});

describe('pages visibles, accueil, page demandée', () => {
  const pages = [
    { titleLink: 'accueil', title: 'Accueil', published: true },
    { titleLink: 'brouillon', title: 'Brouillon', published: false },
    { titleLink: 'sans-drapeau', title: 'Ancienne' },
  ];
  it('un visiteur ne voit pas les pages non publiées, l\'éditeur les voit toutes', () => {
    expect(visiblePages(pages, false).map((p) => p.titleLink)).toEqual(['accueil', 'sans-drapeau']);
    expect(visiblePages(pages, true)).toHaveLength(3);
  });
  it('l\'accueil est la page désignée si visible, sinon la première visible', () => {
    expect(landingPageOf(pages, 'sans-drapeau', false)?.titleLink).toBe('sans-drapeau');
    expect(landingPageOf(pages, 'brouillon', false)?.titleLink).toBe('accueil');
    expect(landingPageOf(pages, 'brouillon', true)?.titleLink).toBe('brouillon');
    expect(landingPageOf([], undefined, true)).toBeUndefined();
  });
  it('une page inconnue ou invisible retombe sur l\'accueil', () => {
    expect(matchingPage(pages, 'sans-drapeau', 'accueil', false)?.titleLink).toBe('sans-drapeau');
    expect(matchingPage(pages, 'brouillon', 'accueil', false)?.titleLink).toBe('accueil');
    expect(matchingPage(pages, 'brouillon', 'accueil', true)?.titleLink).toBe('brouillon');
    expect(matchingPage(pages, 'inconnue', 'accueil', true)?.titleLink).toBe('accueil');
  });
});

describe('canUpdateSite', () => {
  const site = {
    owner: { userId: 'u1' },
    shared: [
      { userId: 'u2', 'fr-wseduc-pages-controllers-PagesController|get': true },
      { groupId: 'g1', 'fr-wseduc-pages-controllers-PagesController|update': true },
    ],
  };
  it('propriétaire', () => expect(canUpdateSite(site, 'u1')).toBe(true));
  it('lecteur : non', () => expect(canUpdateSite(site, 'u2')).toBe(false));
  it('contributeur via un groupe', () => expect(canUpdateSite(site, 'u3', ['g1'])).toBe(true));
  it('inconnu ou non connecté : non', () => {
    expect(canUpdateSite(site, 'u3', ['g9'])).toBe(false);
    expect(canUpdateSite(site, undefined)).toBe(false);
  });
});

describe('pageWeight / pageUrl', () => {
  it('somme les poids des cellules', () => {
    const rows = [{ cells: [{ media: { type: 'video' } }, { media: { type: 'video' } }, { media: { type: 'text' } }] }, { cells: [{ media: { type: 'empty' } }] }];
    expect(pageWeight(rows)).toBe(10.3);
    expect(pageWeight(undefined)).toBe(0);
  });
  it('une page chargée dépasse le seuil', () => {
    const heavy = [{ cells: [{ media: { type: 'sniplet' } }, { media: { type: 'sniplet' } }, { media: { type: 'sniplet' } }, { media: { type: 'video' } }] }];
    expect(pageWeight(heavy)).toBeGreaterThan(HEAVY_PAGE_WEIGHT);
  });
  it('adresse privée et publique', () => {
    expect(pageUrl('https://ent.fr', { _id: 's1' }, 'accueil')).toBe('https://ent.fr/pages#/website/s1/accueil');
    expect(pageUrl('https://ent.fr', { _id: 's1', visibility: 'PUBLIC' }, 'accueil')).toBe('https://ent.fr/pages/p/website#/website/s1/accueil');
  });
});
