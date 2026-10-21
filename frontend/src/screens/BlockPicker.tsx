import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Block, filterBlocks, loadBlockHtml, loadBlockNames } from '../blocks';

/** Choix d'un bloc modèle pour une cellule : recherche par titre ou mot-clé, puis insertion de son contenu. */
export function BlockPicker({ onPick, onCancel }: { onPick: (html: string) => void; onCancel: () => void }) {
  const { t } = useTranslation(['pages', 'common']);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(false);
  const query = useQuery({ queryKey: ['pages', 'block-names'], queryFn: loadBlockNames, retry: false, staleTime: Infinity });
  const blocks: Block[] = (query.data ?? []).map((name) => ({
    name,
    title: t(`blocks.${name}.title`, { defaultValue: name }),
    description: t(`blocks.${name}.description`, { defaultValue: '' }),
    keywords: t(`blocks.${name}.keywords`, { defaultValue: '' }),
  }));
  const shown = filterBlocks(blocks, search);

  const pick = async (name: string) => {
    try { setError(false); onPick(await loadBlockHtml(name)); } catch { setError(true); }
  };

  return (
    <div className="d-flex flex-column gap-8" data-block-picker>
      <input type="search" className="form-control form-control-sm" aria-label={t('blocks.search-block-style', { defaultValue: 'Rechercher un modèle' })} placeholder={t('blocks.search-block-style', { defaultValue: 'Rechercher un modèle' })} value={search} onChange={(e) => setSearch(e.target.value)} />
      {query.isError && <p className="text-danger mb-0" role="alert">{t('pages.block.error', { defaultValue: 'Les modèles ne sont pas disponibles.' })}</p>}
      {error && <p className="text-danger mb-0" role="alert">{t('pages.block.insert.error', { defaultValue: "Ce modèle n'a pas pu être inséré." })}</p>}
      <ul className="list-unstyled mb-0" style={{ maxHeight: 220, overflowY: 'auto' }}>
        {shown.map((b) => (
          <li key={b.name} className="py-4 border-bottom">
            <button type="button" className="btn btn-link p-0 text-start" onClick={() => pick(b.name)} data-block={b.name}>
              <strong>{b.title}</strong>
              {b.description && <span className="d-block text-muted" style={{ fontSize: 13 }}>{b.description}</span>}
            </button>
          </li>
        ))}
        {!query.isLoading && shown.length === 0 && <li className="text-muted">{t('pages.block.none', { defaultValue: 'Aucun modèle ne correspond.' })}</li>}
      </ul>
      <button type="button" className="btn btn-secondary btn-sm align-self-start" onClick={onCancel}>{t('pages.cancel', { defaultValue: 'Annuler' })}</button>
    </div>
  );
}

export default BlockPicker;
