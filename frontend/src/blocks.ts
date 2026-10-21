/**
 * Blocs modèles : mises en page de texte prêtes à l'emploi (titre, texte, citation, image…), les mêmes que l'éditeur
 * historique (`/pages/public/template/blocks`). L'insertion crée une cellule texte contenant le HTML du modèle, dont les
 * éléments `<i18n>` et les images de thème sont résolus (le contenu enregistré est autonome).
 */
import { sanitizeHtml } from './sanitize';

export interface Block {
  name: string;
  title: string;
  description: string;
  keywords: string;
}

const BASE = '/pages/public/template/blocks';

/** Noms des blocs, dans l'ordre de l'éditeur historique. */
export async function loadBlockNames(): Promise<string[]> {
  const res = await fetch(`${BASE}/index.json`, { credentials: 'include' });
  if (!res.ok) throw new Error(`index des blocs : ${res.status}`);
  return (await res.json()) as string[];
}

/** HTML d'un bloc, prêt à être placé dans une cellule texte. Une absence ou une erreur lève. */
export async function loadBlockHtml(name: string): Promise<string> {
  const res = await fetch(`${BASE}/${encodeURIComponent(name)}.html`, { credentials: 'include' });
  if (!res.ok) throw new Error(`bloc ${name} : ${res.status}`);
  return resolveBlockHtml(await res.text());
}

/** Résout les `<i18n>` et `skin-src` d'un modèle, et retire ce que la liste blanche refuse. */
export function resolveBlockHtml(html: string): string {
  return sanitizeHtml(html.replace(/^\uFEFF/, '').trim());
}

const norm = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Blocs dont le titre, la description ou les mots-clés contiennent la recherche (sans accents ni casse) ; tous si vide. */
export function filterBlocks(blocks: Block[], query: string): Block[] {
  const q = norm(query.trim());
  if (!q) return blocks;
  return blocks.filter((b) => norm(`${b.title} ${b.description} ${b.keywords}`).includes(q));
}
