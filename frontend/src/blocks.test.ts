// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { filterBlocks, loadBlockHtml, loadBlockNames, resolveBlockHtml } from './blocks';
import { setSanitizeTranslator } from './sanitize';

afterEach(() => { vi.unstubAllGlobals(); setSanitizeTranslator((k) => k); });

describe('resolveBlockHtml', () => {
  it('résout <i18n> et skin-src, retire le BOM', () => {
    setSanitizeTranslator((k) => (k === 'title' ? 'Titre' : k));
    const html = '﻿<div class="title-block pages-template-block"><h1><i18n>title</i18n></h1><img skin-src="/img/illustrations/image-default.svg"></div>';
    const out = resolveBlockHtml(html);
    expect(out).toContain('<h1>Titre</h1>');
    expect(out).toContain('src="/assets/themes/entcore-css-lib/editor-resources/img/image-default.svg"');
    expect(out).not.toMatch(/i18n|skin-src/);
    expect(out).toContain('pages-template-block');
  });
  it('ignore un skin-src inconnu (pas d\'image cassée vers un chemin arbitraire)', () => {
    expect(resolveBlockHtml('<img skin-src="/autre/chemin.png">')).toBe('<img>');
  });
});

describe('filterBlocks', () => {
  const blocks = [
    { name: 'quote', title: 'Citation', description: 'Ajoutez une citation', keywords: 'texte paragraphe citation' },
    { name: 'image', title: 'Illustration', description: 'Ajoutez une illustration seule', keywords: 'image img' },
  ];
  it('recherche sans accents ni casse dans titre, description et mots-clés', () => {
    expect(filterBlocks(blocks, 'CITATION').map((b) => b.name)).toEqual(['quote']);
    expect(filterBlocks(blocks, 'illustré').map((b) => b.name)).toEqual([]);
    expect(filterBlocks(blocks, 'img').map((b) => b.name)).toEqual(['image']);
  });
  it('recherche vide : tous les blocs', () => expect(filterBlocks(blocks, '  ')).toHaveLength(2));
});

describe('chargement', () => {
  it('noms des blocs et HTML d\'un bloc', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ['quote'] }).mockResolvedValueOnce({ ok: true, text: async () => '<p>Lorem</p>' }));
    expect(await loadBlockNames()).toEqual(['quote']);
    expect(await loadBlockHtml('quote')).toBe('<p>Lorem</p>');
  });
  it('erreur serveur', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(loadBlockHtml('absent')).rejects.toThrow('404');
  });
});
