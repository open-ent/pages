import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Block, filterBlocks, loadBlockNames } from '../blocks';
import { SNIPLET_KINDS, SnipletKind } from '../sniplets';

/** Élément du panneau « Ajouter du contenu », à glisser vers la grille. */
export type PanelItem =
  | { kind: 'media'; type: 'text' | 'image' | 'video' | 'sound' }
  | { kind: 'sniplet'; sniplet: Exclude<SnipletKind, 'message' | 'navigation'> }
  | { kind: 'block'; name: string };

const PANEL_KEY = 'pages.editor.panel';

const MEDIA: Array<{ type: 'text' | 'image' | 'video' | 'sound'; key: string; label: string; icon: string }> = [
  { type: 'text', key: 'pages.editor.type.text', label: 'Texte', icon: '✎' },
  { type: 'image', key: 'pages.editor.type.image', label: 'Image', icon: '🖼' },
  { type: 'video', key: 'pages.editor.type.video', label: 'Vidéo', icon: '▶' },
  { type: 'sound', key: 'pages.editor.type.sound', label: 'Son', icon: '♪' },
];

/**
 * Panneau « Ajouter du contenu » (comme l'éditeur historique) : on glisse un média, un contenu d'application ou un
 * modèle de bloc vers une cellule (son contenu est remplacé) ou vers la bande « Ajouter une ligne ».
 */
export function ContentPanel({ onDragStart, onDragEnd }: { onDragStart: (item: PanelItem) => void; onDragEnd: () => void }) {
  const { t } = useTranslation(['pages', 'common']);
  const [search, setSearch] = useState('');
  // Panneau repliable (comme l'onglet de l'éditeur historique) ; le choix est retenu d'une visite à l'autre.
  const [open, setOpen] = useState(() => {
    try {
      return window.localStorage.getItem(PANEL_KEY) !== 'closed';
    } catch {
      return true;
    }
  });
  const toggle = () =>
    setOpen((v) => {
      try {
        window.localStorage.setItem(PANEL_KEY, v ? 'closed' : 'open');
      } catch {
        /* stockage indisponible : le choix vaut pour cette visite */
      }
      return !v;
    });
  const names = useQuery({ queryKey: ['pages', 'block-names'], queryFn: loadBlockNames, retry: false, staleTime: Infinity });
  const blocks: Block[] = (names.data ?? []).map((name) => ({
    name,
    title: t(`blocks.${name}.title`, { defaultValue: name }),
    description: t(`blocks.${name}.description`, { defaultValue: '' }),
    keywords: t(`blocks.${name}.keywords`, { defaultValue: '' }),
  }));

  const chip = (item: PanelItem, label: string, extra?: string, icon?: string) => (
    <div
      key={JSON.stringify(item)}
      className="border rounded p-8 mb-8 bg-white"
      style={{ cursor: 'grab', userSelect: 'none' }}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', JSON.stringify(item)); e.dataTransfer.effectAllowed = 'copy'; setTimeout(() => onDragStart(item), 0); }}
      onDragEnd={onDragEnd}
      data-panel-item={item.kind === 'media' ? item.type : item.kind === 'sniplet' ? item.sniplet : item.name}
    >
      {icon && <span aria-hidden="true" className="me-8">{icon}</span>}
      <strong>{label}</strong>
      {extra && <span className="d-block text-muted" style={{ fontSize: 12 }}>{extra}</span>}
    </div>
  );

  if (!open) {
    return (
      <aside className="card p-8" style={{ flex: '0 0 auto', alignSelf: 'flex-start', position: 'sticky', top: 8 }} data-content-panel="closed">
        <button type="button" className="btn btn-sm btn-outline-primary" aria-expanded={false} onClick={toggle} data-panel-toggle>
          + {t('pages.panel.title', { defaultValue: 'Ajouter du contenu' })}
        </button>
      </aside>
    );
  }

  return (
    <aside className="card p-12" style={{ width: 260, flex: '0 0 260px', alignSelf: 'flex-start', position: 'sticky', top: 8, maxHeight: 'calc(100vh - 16px)', overflowY: 'auto' }} data-content-panel aria-label={t('pages.panel.title', { defaultValue: 'Ajouter du contenu' })}>
      <div className="d-flex justify-content-between align-items-start gap-8">
        <h2 style={{ fontSize: 18 }} className="mb-4">{t('pages.panel.title', { defaultValue: 'Ajouter du contenu' })}</h2>
        <button type="button" className="btn btn-sm btn-outline-secondary" aria-expanded onClick={toggle} aria-label={t('pages.panel.collapse', { defaultValue: 'Replier le panneau' })} data-panel-toggle>
          ‹
        </button>
      </div>
      <p className="text-muted" style={{ fontSize: 13 }}>{t('pages.panel.help', { defaultValue: 'Glissez un élément sur une cellule, ou sur une bande « Ajouter une ligne ».' })}</p>

      <h3 style={{ fontSize: 15 }} className="mb-8">{t('pages.panel.media', { defaultValue: 'Médias' })}</h3>
      {MEDIA.map((m) => chip({ kind: 'media', type: m.type }, t(m.key, { defaultValue: m.label }), undefined, m.icon))}

      <h3 style={{ fontSize: 15 }} className="mb-8 mt-12">{t('pages.panel.sniplets', { defaultValue: "Contenus d'applications" })}</h3>
      {SNIPLET_KINDS.map((k) => chip({ kind: 'sniplet', sniplet: k.kind as Exclude<SnipletKind, 'message' | 'navigation'> }, t(k.labelKey, { defaultValue: k.defaultLabel })))}

      <h3 style={{ fontSize: 15 }} className="mb-8 mt-12">{t('pages.panel.blocks', { defaultValue: 'Modèles de blocs' })}</h3>
      <input type="search" className="form-control form-control-sm mb-8" aria-label={t('blocks.search-block-style', { defaultValue: 'Rechercher un modèle' })} placeholder={t('blocks.search-block-style', { defaultValue: 'Rechercher un modèle' })} value={search} onChange={(e) => setSearch(e.target.value)} />
      {names.isError && <p className="text-danger" style={{ fontSize: 13 }}>{t('pages.block.error', { defaultValue: 'Les modèles ne sont pas disponibles.' })}</p>}
      <div style={{ maxHeight: 280, overflowY: 'auto' }}>
        {filterBlocks(blocks, search).map((b) => chip({ kind: 'block', name: b.name }, b.title, b.description))}
      </div>
    </aside>
  );
}

export default ContentPanel;
