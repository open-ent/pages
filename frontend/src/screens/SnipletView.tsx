import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { sanitizeHtml } from '../sanitize';
import { kindOf, loadArticles, loadForum, loadWiki, SnipletSource } from '../sniplets';

/** Affichage en lecture seule d'un contenu interactif : articles d'un blog, cours/wiki, forum ou message libre. */
export function SnipletView({ sniplet }: { sniplet: SnipletSource }) {
  const { t } = useTranslation(['pages', 'common']);
  const kind = kindOf(sniplet);
  const id = sniplet.source?._id;
  const query = useQuery({
    queryKey: ['pages', 'sniplet', kind, id],
    queryFn: async () => {
      if (kind === 'articles') return { kind, data: await loadArticles(id!) } as const;
      if (kind === 'wiki') return { kind, data: await loadWiki(id!) } as const;
      return { kind: 'forum', data: await loadForum(id!) } as const;
    },
    enabled: !!id && (kind === 'articles' || kind === 'wiki' || kind === 'forum'),
    retry: false,
  });

  if (kind === 'message') return <div data-sniplet="message" dangerouslySetInnerHTML={{ __html: sanitizeHtml(String(sniplet.source?.content ?? '')) }} />;
  if (!kind) {
    return <p className="text-muted mb-0" data-sniplet="unknown">{t('pages.page.sniplet', { defaultValue: "Contenu interactif : à consulter depuis l'ancienne interface." })}</p>;
  }
  if (query.isLoading) return <p className="text-muted mb-0" data-sniplet={kind}>{t('pages.loading', { defaultValue: 'Chargement…' })}</p>;
  if (query.isError || !query.data) {
    return <p className="text-muted mb-0" data-sniplet={kind} data-sniplet-error>{t('pages.sniplet.unavailable', { defaultValue: "Ce contenu n'est pas disponible (ressource supprimée ou accès refusé)." })}</p>;
  }
  const result = query.data;
  return (
    <div data-sniplet={kind}>
      {result.kind === 'articles' && (result.data.length === 0
        ? <p className="text-muted mb-0">{t('pages.sniplet.articles.empty', { defaultValue: 'Aucun article publié.' })}</p>
        : result.data.map((a) => (
          <article key={a.id} className="mb-12" data-sniplet-item>
            <h3 style={{ fontSize: 18 }}>{a.title}</h3>
            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(a.content) }} />
          </article>
        )))}
      {result.kind === 'wiki' && (
        <>
          {result.data.index && (
            <article data-sniplet-item>
              <h3 style={{ fontSize: 18 }}>{result.data.index.title}</h3>
              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(result.data.index.content) }} />
            </article>
          )}
          {result.data.others.length > 0 && <ul className="mb-0">{result.data.others.map((title) => <li key={title}>{title}</li>)}</ul>}
        </>
      )}
      {result.kind === 'forum' && (result.data.subjects.length === 0
        ? <p className="text-muted mb-0">{t('pages.sniplet.forum.empty', { defaultValue: 'Aucun sujet.' })}</p>
        : <ul className="mb-0">{result.data.subjects.map((title) => <li key={title} data-sniplet-item>{title}</li>)}</ul>)}
    </div>
  );
}

export default SnipletView;
