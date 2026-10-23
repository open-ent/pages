import { useQuery } from '@tanstack/react-query';
import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { highlightStyle, loadPrism } from '../prism';
import { compilePageStyle } from '../sassCompile';

/** Police et marges COMMUNES au champ de saisie et au rendu coloré placé derrière lui : elles doivent être identiques pour que le texte se superpose. */
const EDITOR_TEXT = { fontFamily: 'monospace', fontSize: 13, lineHeight: '20px', padding: '8px 12px', whiteSpace: 'pre', tabSize: 2 } as const;

/** Éditeur du style d'une page en SASS, avec un aperçu qui applique le style en direct et l'erreur de syntaxe éventuelle. */
export function StylePanel({ value, onChange }: { value: string; onChange: (sass: string) => void }) {
  const { t } = useTranslation(['pages', 'common']);
  const area = useRef<HTMLTextAreaElement>(null);
  const pre = useRef<HTMLPreElement>(null);
  // Coloration (Prism de la plateforme) : sans lui, le texte reste lisible, sans couleur.
  const [prism, setPrism] = useState<Awaited<ReturnType<typeof loadPrism>>>(null);
  useEffect(() => {
    let alive = true;
    void loadPrism().then((p) => { if (alive) setPrism(p); });
    return () => { alive = false; };
  }, []);
  const compiled = useQuery({ queryKey: ['pages', 'style', value], queryFn: () => compilePageStyle(value), enabled: !!value.trim(), retry: false, staleTime: Infinity });

  // La touche Tab insère une tabulation au lieu de quitter le champ
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const el = e.currentTarget;
    const next = `${value.slice(0, el.selectionStart)}\t${value.slice(el.selectionEnd)}`;
    const caret = el.selectionStart + 1;
    onChange(next);
    requestAnimationFrame(() => { if (area.current) area.current.selectionStart = area.current.selectionEnd = caret; });
  };

  return (
    <section className="card p-12 mb-12" data-style-panel>
      <h2 style={{ fontSize: 18 }} className="mb-4">{t('css.title', { defaultValue: 'Modifier le style' })}</h2>
      <p className="text-muted mb-8" style={{ fontSize: 13 }}>{t('css.help', { defaultValue: 'Le style de la page doit être écrit en SASS. Il impactera tous les blocs.' })}</p>
      <div className="d-flex gap-12 flex-wrap">
        <div className="flex-grow-1 position-relative" style={{ minWidth: 280, height: 220 }} data-style-editor>
          <pre ref={pre} className="language-css" aria-hidden="true" data-style-highlight style={{ ...EDITOR_TEXT, position: 'absolute', inset: 0, margin: 0, overflow: 'auto', pointerEvents: 'none', background: '#f8f8f8', border: '1px solid #ced4da', borderRadius: 4 }}>
            <code className="language-css" style={{ font: 'inherit' }} dangerouslySetInnerHTML={{ __html: highlightStyle(prism, value) }} />
          </pre>
          <textarea
            ref={area}
            wrap="off"
            spellCheck={false}
            aria-label={t('css.title', { defaultValue: 'Modifier le style' })}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            onScroll={(e) => { if (pre.current) { pre.current.scrollTop = e.currentTarget.scrollTop; pre.current.scrollLeft = e.currentTarget.scrollLeft; } }}
            style={{ ...EDITOR_TEXT, position: 'absolute', inset: 0, width: '100%', height: '100%', resize: 'none', overflow: 'auto', background: 'transparent', color: 'transparent', WebkitTextFillColor: 'transparent', caretColor: '#212529', border: '1px solid transparent', borderRadius: 4 }}
            data-style-input
          />
        </div>
        <div className="flex-grow-1" style={{ minWidth: 280 }}>
          <h3 style={{ fontSize: 15 }}>{t('pages.style.preview', { defaultValue: 'Aperçu' })}</h3>
          {compiled.data && <style data-style-preview>{compiled.data}</style>}
          <div className="page-style-preview border rounded p-8">
            <h1 style={{ fontSize: 24 }}>{t('pages.style.sample.title1', { defaultValue: 'Titre 1' })}</h1>
            <h2 style={{ fontSize: 20 }}>{t('pages.style.sample.title2', { defaultValue: 'Titre 2' })}</h2>
            <p>{t('pages.style.sample.text', { defaultValue: 'Voici un exemple de paragraphe avec du texte' })} <strong>strong</strong> {t('pages.style.sample.and', { defaultValue: 'et' })} <em>em</em>.</p>
          </div>
        </div>
      </div>
      {compiled.isError && <div className="alert alert-warning mt-8 mb-0" role="alert" data-style-error>{(compiled.error as Error).message}</div>}
    </section>
  );
}

export default StylePanel;
