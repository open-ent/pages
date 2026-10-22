import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { listChoices, SNIPLET_KINDS, SnipletKind, SnipletSource, toSource } from '../sniplets';

/** Choix d'un contenu interactif pour une cellule : type (blog, wiki, forum) puis ressource de l'utilisateur. */
export function SnipletPicker({ onPick, onCancel }: { onPick: (source: SnipletSource) => void; onCancel: () => void }) {
  const { t } = useTranslation(['pages', 'common']);
  const [kind, setKind] = useState<Exclude<SnipletKind, 'message' | 'navigation'>>('articles');
  const [resourceId, setResourceId] = useState('');
  const query = useQuery({ queryKey: ['pages', 'sniplet-choices', kind], queryFn: () => listChoices(kind), retry: false });
  const choices = query.data ?? [];

  return (
    <div className="d-flex flex-column gap-8" data-sniplet-picker>
      <label className="form-label mb-0">
        {t('pages.sniplet.kind', { defaultValue: 'Type de contenu' })}
        <select className="form-select form-select-sm" value={kind} onChange={(e) => { setKind(e.target.value as typeof kind); setResourceId(''); }} data-sniplet-kind>
          {SNIPLET_KINDS.map((k) => <option key={k.kind} value={k.kind}>{t(k.labelKey, { defaultValue: k.defaultLabel })}</option>)}
        </select>
      </label>
      <label className="form-label mb-0">
        {t('pages.sniplet.resource', { defaultValue: 'Ressource' })}
        <select className="form-select form-select-sm" value={resourceId} onChange={(e) => setResourceId(e.target.value)} data-sniplet-resource disabled={query.isLoading}>
          <option value="">{query.isError ? t('pages.sniplet.error', { defaultValue: 'Liste indisponible' }) : '—'}</option>
          {choices.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </label>
      {!query.isLoading && !query.isError && choices.length === 0 && <p className="text-muted mb-0" style={{ fontSize: 13 }}>{t('pages.sniplet.none', { defaultValue: "Aucune ressource de ce type : créez-en une dans l'application correspondante." })}</p>}
      <div className="d-flex gap-8">
        <button type="button" className="btn btn-primary btn-sm" disabled={!resourceId} onClick={() => onPick(toSource(kind, resourceId))} data-sniplet-confirm>{t('pages.sniplet.choose', { defaultValue: 'Choisir' })}</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>{t('pages.cancel', { defaultValue: 'Annuler' })}</button>
      </div>
    </div>
  );
}

export default SnipletPicker;
