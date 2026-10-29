import { TRIVIA_CATEGORIES, type Question } from './bank';

/**
 * Which questions this host has already had, per category. Lives on the host screen only.
 * Starts empty, then gets filled from the host's account by connectTriviaMemory.
 */
const used = new Map<string, Set<string>>();
let save: ((category: string, ids: string[]) => void) | null = null;

/** Hook the deck up to the signed-in host's saved memory (replacing whatever was there). */
export function connectTriviaMemory(saved: Record<string, string[]>, onSave: (category: string, ids: string[]) => void) {
  used.clear();
  for (const [cat, ids] of Object.entries(saved)) used.set(cat, new Set(ids));
  save = onSave;
}

/** Forget everything (for tests). */
export function resetTriviaMemory() {
  used.clear();
  save = null;
}

function usedSet(category: string) {
  let set = used.get(category);
  if (!set) used.set(category, (set = new Set()));
  return set;
}

/**
 * Picks a random question this host hasn't had yet. Once every question in the
 * category has been used, the memory for that category starts over.
 */
export function drawQuestion(category: string, rng: () => number, avoid?: string): Question {
  const cat = TRIVIA_CATEGORIES.find((c) => c.id === category);
  if (!cat) throw new Error(`No questions for trivia category "${category}"`);
  return drawFrom(category, cat.questions, rng, avoid);
}

/**
 * The same, for any list of questions with ids (other games use this to share the host's
 * question memory). `deck` is the name the used questions are remembered under.
 */
export function drawFrom<Q extends { id: string }>(deck: string, questions: Q[], rng: () => number, avoid?: string): Q {
  if (!questions.length) throw new Error(`No questions for "${deck}"`);
  const set = usedSet(deck);
  let fresh = questions.filter((q) => !set.has(q.id));
  if (!fresh.length) {
    set.clear();
    fresh = questions.filter((q) => q.id !== avoid);
    if (!fresh.length) fresh = questions;
  }
  const q = fresh[Math.floor(rng() * fresh.length)];
  set.add(q.id);
  // Only keep ids that are still in the file, so edits to the file don't leave junk behind.
  const ids = questions.filter((x) => set.has(x.id)).map((x) => x.id);
  save?.(deck, ids);
  return q;
}

/** How many questions are left before the category starts over. */
export function questionsLeft(category: string, questions?: { id: string }[]): number {
  const list = questions ?? TRIVIA_CATEGORIES.find((c) => c.id === category)?.questions;
  if (!list) return 0;
  const set = usedSet(category);
  return list.filter((q) => !set.has(q.id)).length;
}
