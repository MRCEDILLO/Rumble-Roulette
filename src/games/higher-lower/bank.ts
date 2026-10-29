import { parseCsv } from '../trivia/csv';
import { questionId } from '../trivia/bank';
import file from './questions.csv?raw';

export interface NumberQuestion {
  /** Made from the question text, so used questions are remembered across visits. */
  id: string;
  question: string;
  answer: number;
  /** Shown after the number ("m", "calories"). Empty for years and plain counts. */
  unit: string;
  source: string;
}

/**
 * Reads a number question file: `question,answer,unit,source` columns (unit and source can be
 * blank). Answers must be plain numbers like 8849, -89.2 or 42.195. Rows with a missing or
 * non-numeric answer, and repeated questions, are skipped.
 */
export function parseNumberQuestions(csv: string): NumberQuestion[] {
  const [header, ...rows] = parseCsv(csv);
  if (!header) return [];
  const cols = header.map((h) => h.trim().toLowerCase());
  const col = (name: string) => cols.indexOf(name);
  const [qi, ai, ui, si] = [col('question'), col('answer'), col('unit'), col('source')];
  if (qi < 0 || ai < 0) throw new Error('Question file needs "question" and "answer" columns');
  const seen = new Set<string>();
  const out: NumberQuestion[] = [];
  for (const r of rows) {
    const question = (r[qi] ?? '').trim();
    const answer = parseGuess(r[ai] ?? '');
    if (!question || answer === null) continue;
    const id = questionId(question);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, question, answer, unit: (r[ui] ?? '').trim(), source: (r[si] ?? '').trim() });
  }
  return out;
}

/** Turns typed text ("1,024", " -89.2 ") into a number, or null if it isn't one. */
export function parseGuess(text: string): number | null {
  const clean = String(text).replace(/[\s,]/g, '').replace(/^−/, '-');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(clean)) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

/** 8849 → "8,849". Years and other unit-less numbers stay ungrouped (1969, not 1,969). */
export function formatNumber(n: number, unit = ''): string {
  return n.toLocaleString('en-AU', { maximumFractionDigits: 3, useGrouping: unit !== '' });
}

export const NUMBER_QUESTIONS = parseNumberQuestions(file);

const byId = new Map(NUMBER_QUESTIONS.map((q) => [q.id, q]));
export const findNumberQuestion = (id: string) => byId.get(id);
