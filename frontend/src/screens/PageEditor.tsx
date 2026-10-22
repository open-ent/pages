import { Editor } from '@open-ent/react/editor';
import { MediaLibrary, MediaLibraryRef, MediaLibraryResult, useEdificeClient } from '@open-ent/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { api, Page } from '../api';
import {
  addCell, addRow, DropTarget, EditRow, moveCell, moveCellTo, moveRow, resizedWidth, normalizeEditRows, remainingColumns, removeCell, removeRow, rowsFromContent,
  setCellMedia, setCellTitle, setCellWidth, stripUids,
} from '../gridEdit';
import { sanitizeHtml } from '../sanitize';
import { kindOf, SnipletSource } from '../sniplets';
import { canUpdateSite, HEAVY_PAGE_WEIGHT, isGridPage, isPagePublished, pageWeight } from '../utils';
import { BlockPicker } from './BlockPicker';
import { SnipletPicker } from './SnipletPicker';
import { PageStyle } from './PageStyle';
import { SiteContext } from './SiteContext';
import { StylePanel } from './StylePanel';
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
  // Style SASS de la page (édité dans le panneau « Style »)
  const [sass, setSass] = useState<string | null>(null);
  const [showStyle, setShowStyle] = useState(false);
  const [state, setState] = useState<'saved' | 'saving' | 'error'>('saved');
  const dirty = useRef(false);
  useEffect(() => {
    if (page && rows === null) {
      setRows(isGridPage(page) ? normalizeEditRows(page.rows) : rowsFromContent(page.content));
      setSass(page.sass ?? '');
    }
  }, [page, rows]);

  const latestSite = useRef(site);
  latestSite.current = site;
  const saveMut = useMutation({
    mutationFn: async (next: { rows: EditRow[]; sass: string }) => {
      const current = latestSite.current!;
      const pages = (current.pages ?? []).map((p) => (p.titleLink === pageLink ? { ...p, rows: stripUids(next.rows), sass: next.sass } : p));
      await api.updateWebsite(siteId, { title: current.title, description: current.description, pages });
    },
    onMutate: () => setState('saving'),
    onSuccess: async () => { setState('saved'); await qc.invalidateQueries({ queryKey: siteKey }); },
    onError: () => setState('error'),
  });
  const change = (next: EditRow[]) => { dirty.current = true; setRows(next); };
  const changeSass = (next: string) => { dirty.current = true; setSass(next); };
  /** Texte saisi dans une cellule, retrouvée par son identifiant (sa position peut avoir changé entre-temps). */
  const setText = (uid: string, html: string) => {
    dirty.current = true;
    setRows((prev) => (prev ?? []).map((row) => ({ ...row, cells: row.cells.map((cell) => (cell._uid === uid && cell.media?.type === 'text' ? { ...cell, media: { type: 'text', source: html } } : cell)) })));
  };
  const mutate = saveMut.mutate;
  useEffect(() => {
    if (!dirty.current || rows === null) return;
    const timer = setTimeout(() => { dirty.current = false; mutate({ rows, sass: sass ?? '' }); }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [rows, sass, mutate]);

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

  // Glisser-déposer d'une cellule : cellule glissée et zone survolée (avant/après une cellule, ou nouvelle ligne)
  const [dragUid, setDragUid] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const gridRef = useRef<EditRow[]>([]);
  const hoverKey = (target: DropTarget) => ('cellUid' in target ? `c:${target.cellUid}:${target.side}` : `r:${target.rowUid}:${target.side}`);
  const dropOn = (target: DropTarget) => {
    if (dragUid && rows) change(moveCellTo(rows, dragUid, target));
    setDragUid(null);
    setHover(null);
  };
  /** Redimensionnement à la souris : la poignée du bord droit convertit le glissement en colonnes de la ligne. */
  const startResize = (e: React.PointerEvent<HTMLElement>, r: number, c: number) => {
    const rowEl = e.currentTarget.closest('[data-row-grid]') as HTMLElement | null;
    if (!rowEl) return;
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startWidth = gridRef.current[r]?.cells[c]?.width ?? 1;
    const rowPx = rowEl.getBoundingClientRect().width;
    const move = (ev: PointerEvent) => {
      const next = setCellWidth(gridRef.current, r, c, resizedWidth(startWidth, ev.clientX - startX, rowPx));
      if (next !== gridRef.current) { gridRef.current = next; change(next); }
    };
    const up = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up); };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  };

  // Cellule en cours de choix d'un contenu interactif
  const [pickingUid, setPickingUid] = useState<string | null>(null);
  // Cellule en cours de choix d'un bloc modèle
  const [blockUid, setBlockUid] = useState<string | null>(null);

  const widthOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);

  if (query.isLoading) return <p>{t('pages.loading', { defaultValue: 'Chargement…' })}</p>;
  if (query.isError || !site || !page) return <div className="alert alert-warning" role="alert" data-pages-error>{t('pages.error', { defaultValue: 'Une erreur est survenue.' })}</div>;
  if (!editable) return <div className="alert alert-warning" role="alert" data-editor-forbidden>{t('pages.editor.forbidden', { defaultValue: "Vous n'avez pas le droit de modifier ce site." })}</div>;
  // Grille pas encore initialisée depuis la page : on n'affiche rien d'éditable (un clic précoce écraserait la grille)
  if (rows === null) return <p>{t('pages.loading', { defaultValue: 'Chargement…' })}</p>;
  const grid = rows;
  gridRef.current = grid;

  return (
    <SiteContext.Provider value={{ siteId }}>
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
          <button type="button" className="btn btn-secondary" aria-expanded={showStyle} onClick={() => setShowStyle(!showStyle)} data-toggle-style>{t('pages.editor.style', { defaultValue: 'Style' })}</button>
          <Link className="btn btn-secondary" to={`/site/${siteId}/view/${pageLink}`}>{t('pages.editor.preview', { defaultValue: 'Aperçu' })}</Link>
        </div>
      </div>

      {pageWeight(grid) > HEAVY_PAGE_WEIGHT && (
        <div className="alert alert-warning" role="alert" data-page-heavy>{t('page.warning.heavy', { defaultValue: "Cette page utilise beaucoup de contenu. Elle risque d'être longue à télécharger si le réseau est lent." })}</div>
      )}
      {showStyle && <StylePanel value={sass ?? ''} onChange={changeSass} />}
      <PageStyle sass={sass ?? ''} />

      {grid.length === 0 && <p className="text-muted" data-editor-empty>{t('pages.editor.empty', { defaultValue: 'Cette page est vide. Ajoutez une ligne pour commencer.' })}</p>}

      {grid.map((row, r) => (
        <div key={row._uid ?? r}>
        {(
          <div
            className="mb-4"
            style={{ height: 10, background: hover === hoverKey({ rowUid: row._uid ?? '', side: 'before', newRow: true }) ? '#4bafd5' : dragUid ? '#e9ecef' : 'transparent', borderRadius: 4 }}
            onDragOver={(e) => { e.preventDefault(); setHover(hoverKey({ rowUid: row._uid ?? '', side: 'before', newRow: true })); }}
            onDrop={(e) => { e.preventDefault(); dropOn({ rowUid: row._uid ?? '', side: 'before', newRow: true }); }}
            data-row-drop
          />
        )}
        <div className="card p-12 mb-12" data-editor-row>
          <div className="d-flex gap-8 mb-8 flex-wrap">
            <button type="button" className="btn btn-link p-0" aria-label={`${t('pages.editor.row.up', { defaultValue: 'Monter la ligne' })} ${r + 1}`} disabled={r === 0} onClick={() => change(moveRow(grid, r, -1))}>↑</button>
            <button type="button" className="btn btn-link p-0" aria-label={`${t('pages.editor.row.down', { defaultValue: 'Descendre la ligne' })} ${r + 1}`} disabled={r === grid.length - 1} onClick={() => change(moveRow(grid, r, 1))}>↓</button>
            <button type="button" className="btn btn-link p-0" disabled={remainingColumns(row) < 1} onClick={() => change(addCell(grid, r))} data-add-cell>{t('pages.editor.cell.add', { defaultValue: 'Ajouter une cellule' })}</button>
            <button type="button" className="btn btn-link p-0 text-danger" onClick={() => { if (window.confirm(t('pages.editor.row.confirm', { defaultValue: 'Supprimer cette ligne et son contenu ?' }))) change(removeRow(grid, r)); }}>{t('pages.editor.row.delete', { defaultValue: 'Supprimer la ligne' })}</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 12 }} data-row-grid>
            {row.cells.map((cell, c) => {
              const type = cell.media?.type;
              const source = typeof cell.media?.source === 'string' ? cell.media.source : '';
              const max = cell.width + remainingColumns(row);
              return (
                <div
                  key={cell._uid ?? c}
                  className="border rounded p-8 position-relative"
                  style={{ gridColumn: `span ${cell.width}`, ...(hover?.startsWith(`c:${cell._uid}:`) ? { boxShadow: `${hover.endsWith(':before') ? '-' : ''}4px 0 0 #4bafd5` } : {}) }}
                  data-editor-cell
                  data-cell-type={type ?? 'empty'}
                  onDragOver={(e) => {
                    if (!dragUid || dragUid === cell._uid) return;
                    e.preventDefault();
                    const box = e.currentTarget.getBoundingClientRect();
                    setHover(hoverKey({ cellUid: cell._uid ?? '', side: e.clientX < box.left + box.width / 2 ? 'before' : 'after' }));
                  }}
                  onDragLeave={() => setHover(null)}
                  onDrop={(e) => {
                    if (!dragUid) return;
                    e.preventDefault();
                    const box = e.currentTarget.getBoundingClientRect();
                    dropOn({ cellUid: cell._uid ?? '', side: e.clientX < box.left + box.width / 2 ? 'before' : 'after' });
                  }}
                >
                  <div className="d-flex gap-8 align-items-center mb-8 flex-wrap">
                    <span
                      role="button"
                      tabIndex={0}
                      draggable
                      aria-label={t('pages.editor.cell.drag', { defaultValue: 'Glisser la cellule pour la déplacer' })}
                      title={t('pages.editor.cell.drag', { defaultValue: 'Glisser la cellule pour la déplacer' })}
                      style={{ cursor: 'grab', userSelect: 'none' }}
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', cell._uid ?? ''); e.dataTransfer.effectAllowed = 'move'; const uid = cell._uid ?? null; setTimeout(() => setDragUid(uid), 0); }}
                      onDragEnd={() => { setDragUid(null); setHover(null); }}
                      data-drag-handle
                    >⠿</span>
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
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setBlockUid(cell._uid ?? null); setPickingUid(null); }} data-choose-block>{t('pages.editor.type.block', { defaultValue: 'Modèle' })}</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setPickingUid(cell._uid ?? null); setBlockUid(null); }} data-choose-sniplet>{t('pages.editor.type.sniplet', { defaultValue: "Contenu d'une application" })}</button>
                    </div>
                  )}
                  {(!type || type === 'empty') && blockUid !== null && blockUid === cell._uid && (
                    <div className="mt-8">
                      <BlockPicker
                        onPick={(html) => { change(setCellMedia(grid, r, c, { type: 'text', source: html })); setBlockUid(null); }}
                        onCancel={() => setBlockUid(null)}
                      />
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
                  <span
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={t('pages.editor.cell.resize', { defaultValue: 'Redimensionner la cellule' })}
                    title={t('pages.editor.cell.resize', { defaultValue: 'Redimensionner la cellule' })}
                    style={{ position: 'absolute', top: 0, right: -3, bottom: 0, width: 8, cursor: 'col-resize', touchAction: 'none' }}
                    onPointerDown={(e) => startResize(e, r, c)}
                    data-cell-resize
                  />
                  {type && type !== 'empty' && (
                    <input type="text" className="form-control form-control-sm mt-8" aria-label={t('pages.editor.cell.title', { defaultValue: 'Titre de la cellule' })} placeholder={t('pages.editor.cell.title', { defaultValue: 'Titre de la cellule' })} value={cell.title ?? ''} onChange={(e) => change(setCellTitle(grid, r, c, e.target.value))} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        </div>
      ))}
      {grid.length > 0 && (
        <div
          className="mb-8"
          style={{ height: 10, background: hover === hoverKey({ rowUid: grid[grid.length - 1]._uid ?? '', side: 'after', newRow: true }) ? '#4bafd5' : dragUid ? '#e9ecef' : 'transparent', borderRadius: 4 }}
          onDragOver={(e) => { e.preventDefault(); setHover(hoverKey({ rowUid: grid[grid.length - 1]._uid ?? '', side: 'after', newRow: true })); }}
          onDrop={(e) => { e.preventDefault(); dropOn({ rowUid: grid[grid.length - 1]._uid ?? '', side: 'after', newRow: true }); }}
          data-row-drop
        />
      )}

      <button type="button" className="btn btn-primary" onClick={() => change(addRow(grid))} data-add-row>{t('pages.editor.row.add', { defaultValue: 'Ajouter une ligne' })}</button>

      <MediaLibrary ref={library} appCode={appCode} visibility={site.visibility === 'PUBLIC' ? 'public' : 'protected'} onSuccess={onLibrarySuccess} onCancel={onLibraryCancel} />
    </div>
    </SiteContext.Provider>
  );
}

export default PageEditor;