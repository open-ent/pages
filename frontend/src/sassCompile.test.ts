// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { compilePageStyle, resetSass, scopedSource, STYLE_SCOPE } from './sassCompile';

beforeEach(() => {
  delete (window as unknown as { Sass?: unknown }).Sass;
  resetSass();
});

function installSass(result: { status: number; text?: string; formatted?: string }) {
  const compile = vi.fn((_src: string, cb: (r: typeof result) => void) => cb(result));
  class FakeSass { compile = compile; static setWorkerUrl = vi.fn(); }
  (window as unknown as { Sass: unknown }).Sass = FakeSass;
  return compile;
}

describe('scopedSource', () => {
  it('enveloppe le style dans la portée de la grille et de l\'aperçu', () => {
    expect(scopedSource('p{color:red}')).toBe(`${STYLE_SCOPE}{p{color:red}}`);
    expect(STYLE_SCOPE).toContain('.pages-grid');
  });
});

describe('compilePageStyle', () => {
  it('un style vide ne charge rien', async () => {
    expect(await compilePageStyle(undefined)).toBe('');
    expect(await compilePageStyle('   ')).toBe('');
  });
  it('renvoie le CSS compilé', async () => {
    const compile = installSass({ status: 0, text: '.pages-grid p{color:red}' });
    expect(await compilePageStyle('p{color:red}')).toBe('.pages-grid p{color:red}');
    expect(compile.mock.calls[0][0]).toBe(`${STYLE_SCOPE}{p{color:red}}`);
  });
  it('lève avec le message du compilateur en cas d\'erreur de syntaxe', async () => {
    installSass({ status: 1, formatted: 'Error: expected "}"' });
    await expect(compilePageStyle('p{color:red')).rejects.toThrow('expected');
  });
});
