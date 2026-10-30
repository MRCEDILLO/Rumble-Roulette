import { parseCsv } from '../trivia/csv';
import { questionId } from '../trivia/bank';
import file from './characters.csv?raw';

export interface Celebrity {
  /** Made from the name, so used characters are remembered across visits. */
  id: string;
  name: string;
  /** A real person, or someone from a film, book, show, game or story. */
  real: boolean;
  /** A few words on who they are, so the audience can answer questions about them. */
  knownFor: string;
}

/** Reads a character file: `name,type,known_for` columns, type is `real` or `fictional`. Repeats are skipped. */
export function parseCharacters(csv: string): Celebrity[] {
  const [header, ...rows] = parseCsv(csv);
  if (!header) return [];
  const cols = header.map((h) => h.trim().toLowerCase());
  const [ni, ti, ki] = [cols.indexOf('name'), cols.indexOf('type'), cols.indexOf('known_for')];
  if (ni < 0) throw new Error('Character file needs a "name" column');
  const seen = new Set<string>();
  const out: Celebrity[] = [];
  for (const r of rows) {
    const name = (r[ni] ?? '').trim();
    if (!name) continue;
    const id = questionId(name);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name, real: (r[ti] ?? '').trim().toLowerCase() === 'real', knownFor: (r[ki] ?? '').trim() });
  }
  return out;
}

export const CELEBRITIES = parseCharacters(file);
