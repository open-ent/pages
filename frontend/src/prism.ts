/**
 * Coloration syntaxique du champ de style : le Prism de la plateforme (`/infra/public/js/prism`), le même que l'éditeur historique.
 * Il est chargé à la première demande ; s'il est indisponible, le texte est simplement affiché sans couleur.
 */
interface PrismApi {
  highlight(text: string, grammar: unknown, language: string): string;
  languages: Record<string, unknown>;
}

let loading: Promise<PrismApi | null> | null = null;

/** Texte rendu sûr dans du HTML. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function loadPrism(): Promise<PrismApi | null> {
  const existing = (window as unknown as { Prism?: PrismApi }).Prism;
  if (existing) return Promise.resolve(existing);
  if (!loading) {
    loading = (async () => {
      try {
        if (!document.querySelector('link.prism')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.className = 'prism';
          link.href = '/infra/public/js/prism/prism.css';
          document.head.appendChild(link);
        }
        const res = await fetch('/infra/public/js/prism/prism.js', { credentials: 'include' });
        if (!res.ok) return null;
        // Le script de la plateforme se pose lui-même sur `window.Prism` (même technique que l'éditeur historique).
        new Function(await res.text())();
        return (window as unknown as { Prism?: PrismApi }).Prism ?? null;
      } catch {
        return null;
      }
    })();
  }
  return loading;
}

/** HTML coloré d'un texte de style (CSS/SASS) ; sans Prism, le texte échappé tel quel. Un retour à la ligne final est conservé. */
export function highlightStyle(prism: PrismApi | null, text: string): string {
  const html = prism && prism.languages.css ? prism.highlight(text, prism.languages.css, 'css') : escapeHtml(text);
  return text.endsWith('\n') ? `${html} ` : html;
}
