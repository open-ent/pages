import { describe, expect, it } from 'vitest';

import { isGridPage, pagePreview, slugify } from './utils';

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
