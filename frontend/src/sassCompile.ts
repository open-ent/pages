/**
 * Style d'une page : écrit en SASS (comme l'éditeur historique), compilé dans le navigateur par `sass.js` (script et
 * worker servis par le module : `/pages/public/sass.js/dist`). Le style n'agit que sur la grille de la page.
 */
interface SassResult { status: number; text?: string; formatted?: string; message?: string }
interface SassInstance { compile: (source: string, cb: (result: SassResult) => void) => void }
interface SassStatic { new (): SassInstance; setWorkerUrl: (url: string) => void }

const BASE = '/pages/public/sass.js/dist';

let loading: Promise<SassInstance> | null = null;

/** Charge `sass.js` une seule fois (balise script) et crée le compilateur. Un échec de chargement est retenté au prochain appel. */
export function loadSass(): Promise<SassInstance> {
  if (loading) return loading;
  loading = new Promise<SassInstance>((resolve, reject) => {
    const ready = () => {
      const Sass = (window as unknown as { Sass?: SassStatic }).Sass;
      if (!Sass) return reject(new Error('sass.js indisponible'));
      Sass.setWorkerUrl(`${BASE}/sass.worker.js`);
      resolve(new Sass());
    };
    if ((window as unknown as { Sass?: unknown }).Sass) return ready();
    const script = document.createElement('script');
    script.src = `${BASE}/sass.js`;
    script.onload = ready;
    script.onerror = () => reject(new Error('sass.js : chargement impossible'));
    document.head.appendChild(script);
  }).catch((error) => {
    loading = null;
    throw error;
  });
  return loading;
}

/** Oublie le compilateur chargé (tests). */
export function resetSass(): void {
  loading = null;
}

/** Sélecteur de portée : la grille de la page, et l'aperçu de l'éditeur de style. */
export const STYLE_SCOPE = '.pages-grid, .page-style-preview';

/** Source SASS enveloppée dans la portée : un style vide donne une feuille vide. */
export const scopedSource = (sass: string): string => `${STYLE_SCOPE}{${sass}}`;

/** Compile un style SASS en CSS limité à la grille de la page ; lève avec le message du compilateur en cas d'erreur de syntaxe. */
export async function compilePageStyle(sass: string | undefined): Promise<string> {
  if (!sass || !sass.trim()) return '';
  const compiler = await loadSass();
  return new Promise<string>((resolve, reject) => {
    compiler.compile(scopedSource(sass), (result) => {
      if (result.status === 0) resolve(result.text ?? '');
      else reject(new Error(result.formatted ?? result.message ?? 'Erreur SASS'));
    });
  });
}
