import { Editor } from '@open-ent/react/editor';
import { MediaLibrary, MediaLibraryRef, MediaLibraryResult, useEdificeClient } from '@open-ent/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { api, Page } from '../api';
import {
  addCell, addRow, EditRow, moveCell, moveRow, normalizeEditRows, remainingColumns, removeCell, removeRow, rowsFromContent,
  setCellMedia, setCellTitle, setCellWidth, stripUids,
} from '../gridEdit';
import { sanitizeHtml } from '../sanitize';
import { kindOf, SnipletSource } from '../sniplets';
import { canUpdateSite, isGridPage, isPagePublished } from '../utils';
import { SnipletPicker } from './SnipletPicker';
import { SnipletView } from './SnipletView';

type Target = { r: number; c: number; kind: 'image' | 'audio' | 'video' };

/** Identifiant d'un document de l'espace documentaire choisi dans la médiathèque (un ou plusieurs résultats). */
function workspaceId(result: MediaLibraryResult): string | undefined {
  const first = Array.isArray(result) ? result[0] : result;
  return first && typeof first === 'object' && typeof first._id === 'string' ? first._id : undefined;
}

/** Source d'une cellule « vidéo » : lecteur du document, ou intégration (adresse / code HTML) renvoyée par la médiathèque. */
function videoSource(result: MediaLibraryResult): string | undefined {
  const id = workspaceId(result);
  if (id) return `<video controls src="/workspace/document/${id}"></video>`;
  if (typeof result === 'string' && result.trim()) return result.trim().startsWith('<') ? result.trim() : `<iframe src="${result.trim()}" allowfullscreen></iframe>`;
  return undefined;
}

const AUTOSAVE_DELAY_MS = 900;

/**
 * Cellule texte : l'éditeur riche garde lui-même son contenu. Il est monté avec le texte de départ et n'est jamais
 * réalimenté pendant la frappe (renvoyer le HTML à chaque touche lui faisait perdre les espaces de fin de ligne) ;
 * la clé stable de la cellule évite de le démonter quand on ajoute, déplace ou supprime d'autres lignes.
 */
function TextCell({ uid, initial, placeholder, onChange }: { uid: string; initial: string; placeholder: string; onChange: (html: string) => void }) {
  const initialRef = useRef(initial);
  const callback = useRef(onChange);
  callback.current = onChange;
  return (
    <Editor
      id={`cell-${uid}`}
      content={initialRef.current}
      mode="edit"
      focus={false}
      placeholder={placeholder}
      onContentChange={({ editor }) => callback.current(editor.getHTML())}
    />
  );
}

/** Éditeur de mise en page d'une page : lignes et cellules de 12 colonnes, contenu texte / image / vidéo / son. */
export function PageEditor() {
  const { siteId = '', pageLink = '' } = useParams();
  const { t } = useTranslation(['pages', 'common']);
  const { appCode, user } = useEdificeClient();
  const qc = useQueryClient();
  const siteKey = ['pages', 'site', siteId];
  const query = useQuery({ queryKey: siteKey, queryFn: () => api.getWebsite(siteId), enabled: !!siteId });
  const site = query.data;
  const me = user as { userId?: string; groupsIds?: string[] } | undefined;
  const editable = !!site && canUpdateSite(site, me?.userId, me?.groupsIds ?? []);
  const pageIdx = site?.pages?.findIndex((p) => p.titleLink === pageLink) ?? -1;
  const page: Page | undefined = pageIdx >= 0 ? site!.pages![pageIdx] : undefined;

  // Grille en cours d'édition : initialisée une fois depuis la page (grille existante, ou contenu HTML d'une page simple)
  const [rows, setRows] = useState<EditRow[] | null>(null);
  const [state, setState] = useState<'saved' | 'saving' | 'error'>('saved');
  const dirty = useRef(false);
  useEffect(() => {
    if (page && rows === null) setRows(isGridPage(page) ? normalizeEditRows(page.rows) : rowsFromContent(page.content));
  }, [page, rows]);

  const latestSite = useRef(site);
  latestSite.current = site;
  const saveMut = useMutation({
    mutationFn: async (next: EditRow[]) => {
      const current = latestSite.current!;
      const pages = (current.pages ?? []).map((p) => (p.titleLink === pageLink ? { ...p, rows: stripUids(next) } : p));
      await api.updateWebsite(siteId, { title: current.title, description: current.description, pages });
    },
    onMutate: () => setState('saving'),
    onSuccess: async () => { setState('saved'); await qc.invalidateQueries({ queryKey: siteKey }); },
    onError: () => setState('error'),
  });
  const change = (next: EditRow[]) => { dirty.current = true; setRows(next); };
  /** Texte saisi dans une cellule, retrouvée par son identifiant (sa position peut avoir changé entre-temps). */
  const setText = (uid: string, html: string) => {
    dirty.current = true;
    setRows((prev) => (prev ?? []).map((row) => ({ ...row, cells: row.cells.map((cell) => (cell._uid === uid && cell.media?.type === 'text' ? { ...cell, media: { type: 'text', source: html } } : cell)) })));
  };
  const mutate = saveMut.mutate;
  useEffect(() => {
    if (!dirty.current || rows === null) return;
    const timer = setTimeout(() => { dirty.current = false; mutate(rows); }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [rows, mutate]);

  const publishMut = useMutation({
    mutationFn: async () => {
      const pages = (site!.pages ?? []).map((p) => (p.titleLink === pageLink ? { ...p, published: !isPagePublished(p) } : p));
      await api.updateWebsite(siteId, { title: site!.title, description: site!.description, pages });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: siteKey }),
  });

  // Médiathèque partagée : une seule instance, la cellule visée est mémorisée dans `target`
  const library = useRef<MediaLibraryRef>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const pick = (r: number, c: number, kind: Target['kind']) => { setTarget({ r, c, kind }); library.current?.show(kind); };
  const onLibrarySuccess = (result: MediaLibraryResult) => {
    if (target && rows) {
      const id = workspaceId(result);
      const media =
        target.kind === 'video' ? { type: 'video', source: videoSource(result) }
        : id ? { type: target.kind === 'audio' ? 'sound' : 'image', source: `/workspace/document/${id}` }
        : undefined;
      if (media?.source) change(setCellMedia(rows, target.r, target.c, media));
    }
    library.current?.hide();
    setTarget(null);
  };
  const onLibraryCancel = () => { library.current?.hide(); setTarget(null); };

  // Cellule en cours de choix d'un contenu interactif
  const [pickingUid, setPickingUid] = useState<string | null>(null);

  const widthOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);

  if (query.isLoading) return <p>{t('pages.loading', { defaultValue: 'Chargement…' })}</p>;
  if (query.isError || !site || !page) return <div className="alert alert-warning" role="alert" data-pages-error>{t('pages.error', { defaultValue: 'Une erreur est survenue.' })}</div>;
  if (!editable) return <div className="alert alert-warning" role="alert" data-editor-forbidden>{t('pages.editor.forbidden', { defaultValue: "Vous n'avez pas le droit de modifier ce site." })}</div>;
  // Grille pas encore initialisée depuis la page : on n'affiche rien d'éditable (un clic précoce écraserait la grille)
  if (rows === null) return <p>{t('pages.loading', { defaultValue: 'Chargement…' })}</p>;
  const grid = rows;

  return (
    <div data-page-editor>
      <p><Link to={`/site/${siteId}`}>← {t('pages.editor.back', { defaultValue: 'Retour aux pages du site' })}</Link></p>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-8 mb-16">
        <h1 className="mb-0">{page.title}</h1>
        <div className="d-flex align-items-center gap-8">
          <span role="status" className="text-muted" style={{ fontSize: 13 }} data-save-state={state}>
            {state === 'saving' && t('pages.editor.saving', { defaultValue: 'Enregistrement…' })}
            {state === 'saved' && t('pages.editor.saved', { defaultValue: 'Enregistré' })}
            {state === 'error' && t('pages.editor.error', { defaultValue: "L'enregistrement a échoué" })}
          </span>
          <button type="button" className="btn btn-secondary" onClick={() => publishMut.mutate()} disabled={publishMut.isPending} data-publish-toggle>
            {isPagePublished(page) ? t('pages.page.unpublish', { defaultValue: 'Dépublier' }) : t('pages.page.publish', { defaultValue: 'Publier' })}
          </button>
          <Link className="btn btn-secondary" to={`/site/${siteId}/view/${pageLink}`}>{t('pages.editor.preview', { defaultValue: 'Aperçu' })}</Link>
        </div>
      </div>

      {grid.length === 0 && <p className="text-muted" data-editor-empty>{t('pages.editor.empty', { defaultValue: 'Cette page est vide. Ajoutez une ligne pour commencer.' })}</p>}

      {grid.map((row, r) => (
        <div key={row._uid ?? r} className="card p-12 mb-12" data-editor-row>
          <div className="d-flex gap-8 mb-8 flex-wrap">
            <button type="button" className="btn btn-link p-0" aria-label={`${t('pages.editor.row.up', { defaultValue: 'Monter la ligne' })} ${r + 1}`} disabled={r === 0} onClick={() => change(moveRow(grid, r, -1))}>↑</button>
            <button type="button" className="btn btn-link p-0" aria-label={`${t('pages.editor.row.down', { defaultValue: 'Descendre la ligne' })} ${r + 1}`} disabled={r === grid.length - 1} onClick={() => change(moveRow(grid, r, 1))}>↓</button>
            <button type="button" className="btn btn-link p-0" disabled={remainingColumns(row) < 1} onClick={() => change(addCell(grid, r))} data-add-cell>{t('pages.editor.cell.add', { defaultValue: 'Ajouter une cellule' })}</button>
            <button type="button" className="btn btn-link p-0 text-danger" onClick={() => { if (window.confirm(t('pages.editor.row.confirm', { defaultValue: 'Supprimer cette ligne et son contenu ?' }))) change(removeRow(grid, r)); }}>{t('pages.editor.row.delete', { defaultValue: 'Supprimer la ligne' })}</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 12 }}>
            {row.cells.map((cell, c) => {
              const type = cell.media?.type;
              const source = typeof cell.media?.source === 'string' ? cell.media.source : '';
              const max = cell.width + remainingColumns(row);
              return (
                <div key={cell._uid ?? c} className="border rounded p-8" style={{ gridColumn: `span ${cell.width}` }} data-editor-cell data-cell-type={type ?? 'empty'}>
                  <div className="d-flex gap-8 align-items-center mb-8 flex-wrap">
                    <button type="button" className="btn btn-link p-0" aria-label={t('pages.editor.cell.left', { defaultValue: 'Déplacer la cellule à gauche' })} disabled={c === 0} onClick={() => change(moveCell(grid, r, c, -1))}>←</button>
                    <button type="button" className="btn btn-link p-0" aria-label={t('pages.editor.cell.right', { defaultValue: 'Déplacer la cellule à droite' })} disabled={c === row.cells.length - 1} onClick={() => change(moveCell(grid, r, c, 1))}>→</button>
                    <label className="d-flex align-items-center gap-4 mb-0" style={{ fontSize: 13 }}>
                      {t('pages.editor.cell.width', { defaultValue: 'Largeur' })}
                      <select className="form-select form-select-sm" style={{ width: 70 }} value={cell.width} onChange={(e) => change(setCellWidth(grid, r, c, Number(e.target.value)))} data-cell-width>
                        {widthOptions.filter((w) => w <= max).map((w) => <option key={w} value={w}>{w}</option>)}
                      </select>
                    </label>
                    <button type="button" className="btn btn-link p-0 text-danger ms-auto" onClick={() => { if (window.confirm(t('pages.editor.cell.confirm', { defaultValue: 'Supprimer cette cellule et son contenu ?' }))) change(removeCell(grid, r, c)); }}>{t('pages.editor.cell.delete', { defaultValue: 'Supprimer' })}</button>
                  </div>

                  {(!type || type === 'empty') && (
                    <div className="d-flex gap-8 flex-wrap" data-cell-choose>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => change(setCellMedia(grid, r, c, { type: 'text', source: '' }))}>{t('pages.editor.type.text', { defaultValue: 'Texte' })}</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => pick(r, c, 'image')}>{t('pages.editor.type.image', { defaultValue: 'Image' })}</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => pick(r, c, 'video')}>{t('pages.editor.type.video', { defaultValue: 'Vidéo' })}</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => pick(r, c, 'audio')}>{t('pages.editor.type.sound', { defaultValue: 'Son' })}</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPickingUid(cell._uid ?? null)} data-choose-sniplet>{t('pages.editor.type.sniplet', { defaultValue: "Contenu d'une application" })}</button>
                    </div>
                  )}
                  {(!type || type === 'empty') && pickingUid !== null && pickingUid === cell._uid && (
                    <div className="mt-8">
                      <SnipletPicker
                        onPick={(src: SnipletSource) => { change(setCellMedia(grid, r, c, { type: 'sniplet', source: src })); setPickingUid(null); }}
                        onCancel={() => setPickingUid(null)}
                      />
                    </div>
                  )}
                  {type === 'text' && (
                    <TextCell
                      uid={cell._uid ?? `${r}-${c}`}
                      initial={source}
                      placeholder={t('pages.editor.text.placeholder', { defaultValue: 'Saisissez votre texte…' })}
                      onChange={(html) => setText(cell._uid ?? '', html)}
                    />
                  )}
                  {type === 'image' && (
                    <div>
                      {source && <img src={`${source}?thumbnail=600x0`} alt={cell.title ?? ''} style={{ maxWidth: '100%' }} />}
                      <button type="button" className="btn btn-link p-0 d-block" onClick={() => pick(r, c, 'image')}>{t('pages.editor.change', { defaultValue: 'Choisir un autre média' })}</button>
                    </div>
                  )}
                  {type === 'sound' && (
                    <div>
                      {source && <audio controls src={source} />}
                      <button type="button" className="btn btn-link p-0 d-block" onClick={() => pick(r, c, 'audio')}>{t('pages.editor.change', { defaultValue: 'Choisir un autre média' })}</button>
                    </div>
                  )}
                  {type === 'video' && (
                    <div>
                      <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(source, true) }} />
                      <button type="button" className="btn btn-link p-0 d-block" onClick={() => pick(r, c, 'video')}>{t('pages.editor.change', { defaultValue: 'Choisir un autre média' })}</button>
                    </div>
                  )}
                  {type === 'sniplet' && kindOf(cell.media?.source as SnipletSource | undefined) && (
                    <div data-cell-sniplet>
                      <SnipletView sniplet={cell.media!.source as SnipletSource} />
                      <button type="button" className="btn btn-link p-0 d-block" onClick={() => change(setCellMedia(grid, r, c, { type: 'empty' }))}>{t('pages.editor.sniplet.reset', { defaultValue: 'Changer de contenu' })}</button>
                    </div>
                  )}
                  {type && !['empty', 'text', 'image', 'sound', 'video'].includes(type) && !(type === 'sniplet' && kindOf(cell.media?.source as SnipletSource | undefined)) && (
                    <p className="text-muted mb-0" data-cell-readonly>{t('pages.editor.readonly', { defaultValue: "Contenu interactif : non modifiable ici, il est conservé tel quel." })}</p>
                  )}
                  {type && type !== 'empty' && (
                    <input type="text" className="form-control form-control-sm mt-8" aria-label={t('pages.editor.cell.title', { defaultValue: 'Titre de la cellule' })} placeholder={t('pages.editor.cell.title', { defaultValue: 'Titre de la cellule' })} value={cell.title ?? ''} onChange={(e) => change(setCellTitle(grid, r, c, e.target.value))} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <button type="button" className="btn btn-primary" onClick={() => change(addRow(grid))} data-add-row>{t('pages.editor.row.add', { defaultValue: 'Ajouter une ligne' })}</button>

      <MediaLibrary ref={library} appCode={appCode} visibility={site.visibility === 'PUBLIC' ? 'public' : 'protected'} onSuccess={onLibrarySuccess} onCancel={onLibraryCancel} />
    </div>
  );
}

export default PageEditor;
