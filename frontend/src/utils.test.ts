import { describe, expect, it } from 'vitest';

import { pagePreview } from './utils';

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
