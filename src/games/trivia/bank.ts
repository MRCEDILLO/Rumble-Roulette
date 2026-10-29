import { parseCsv } from './csv';
import science from './questions/science.csv?raw';
import math from './questions/math.csv?raw';

export interface Question {
  /** Stable id made from the question text, so used questions are remembered across visits. */
  id: string;
  question: string;
  answer: string;
}

export interface TriviaCategory {
  /** Used in the game id (trivia-<id>) and to remember which questions a host has had. */
  id: string;
  name: string;
  icon: string;
  color: string;
  questions: Question[];
}

/** FNV-1a hash of the question text, as a short base-36 string. */
export function questionId(text: string): string {
  let h = 0x811c9dc5;
  const norm = text.trim().toLowerCase().replace(/\s+/g, ' ');
  for (let i = 0; i < norm.length; i++) {
    h ^= norm.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * Reads a question file. The first row is the header and must have `question` and `answer`
 * columns (any other columns are ignored). Blank rows and repeated questions are skipped.
 */
export function parseQuestions(csv: string): Question[] {
  const [header, ...rows] = parseCsv(csv);
  if (!header) return [];
  const cols = header.map((h) => h.trim().toLowerCase());
  const qi = cols.indexOf('question');
  const ai = cols.indexOf('answer');
  if (qi < 0 || ai < 0) throw new Error('Question file needs "question" and "answer" columns');
  const seen = new Set<string>();
  const out: Question[] = [];
  for (const r of rows) {
    const question = (r[qi] ?? '').trim();
    const answer = (r[ai] ?? '').trim();
    if (!question || !answer) continue;
    const id = questionId(question);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, question, answer });
  }
  return out;
}

/**
 * Every trivia category. Each one becomes its own game on the wheel.
 * To add a category: drop a CSV in ./questions and add a line here.
 */
export const TRIVIA_CATEGORIES: TriviaCategory[] = [
  { id: 'science', name: 'Science', icon: '🔬', color: '#5fd3a0', questions: parseQuestions(science) },
  { id: 'math', name: 'Math', icon: '➗', color: '#ffb84f', questions: parseQuestions(math) },
];

const byId = new Map(TRIVIA_CATEGORIES.map((c) => [c.id, new Map(c.questions.map((q) => [q.id, q]))]));

export function findQuestion(category: string, id: string): Question | undefined {
  return byId.get(category)?.get(id);
}
