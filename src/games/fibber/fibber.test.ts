import { beforeEach, describe, expect, it } from 'vitest';
import { resetTriviaMemory } from '../trivia/deck';
import type { GameContext } from '../types';
import {
  BLANK,
  FACTS,
  REVEAL_MS,
  RESULT_MS,
  VOTE_MS,
  WRITE_MS,
  answerKey,
  cleanLie,
  fibberLogic as logic,
  isTruth,
  parseFacts,
  revealStep,
  unmaskOrder,
  type FibberState,
} from './logic';

beforeEach(() => resetTriviaMemory());

const room = (audience: number): GameContext => ({
  ref: { id: 'h', name: 'Hana' },
  audience: Array.from({ length: audience }, (_, i) => ({ id: `p${i}`, name: `P${i}` })),
});

const rng = () => 0.3;

function bothLie(s: FibberState, a = 'pixie', b = 'gnome', now = 0) {
  s = logic.onInput(s, 'a', { action: 'lie', text: a }, now, rng);
  return logic.onInput(s, 'b', { action: 'lie', text: b }, now, rng);
}

const optionOf = (s: FibberState, owner: 'a' | 'b' | 'truth') => s.options.findIndex((o) => o.owner === owner);

function vote(s: FibberState, who: string, owner: 'a' | 'b' | 'truth', now = 0) {
  const host = who === 'h';
  return logic.onInput(s, host ? 'ref' : 'audience', { action: 'vote', pick: optionOf(s, owner) }, now, rng, host ? undefined : who);
}

/** A game at the voting stage with the fact pinned to a known one. */
function voting(audience = 2) {
  const s = logic.init(0, rng, room(audience));
  return bothLie({ ...s, fact: { id: 'x', text: `The national animal of Scotland is the ${BLANK}.`, answer: 'unicorn', alts: [] } });
}

describe('Fibber facts', () => {
  it('has a big list of facts, each with one blank and an answer', () => {
    expect(FACTS.length).toBeGreaterThanOrEqual(250);
    expect(new Set(FACTS.map((f) => f.id)).size).toBe(FACTS.length);
    for (const f of FACTS) {
      expect(f.text.split(BLANK)).toHaveLength(2);
      expect(f.answer.length).toBeGreaterThan(0);
      expect(f.answer.length).toBeLessThanOrEqual(30);
    }
  });

  it('reads answers and other spellings, and skips notes, broken lines and repeats', () => {
    const facts = parseFacts('# note\nA ___ fact | one | 1\nno blank here | x\nA ___ fact | two\nTwo ___ ___ | x');
    expect(facts).toEqual([{ id: expect.any(String), text: 'A ___ fact', answer: 'one', alts: ['1'] }]);
  });
});

describe('Fibber answers', () => {
  it('tidies lies', () => {
    expect(cleanLie('  a   pixie!! ')).toBe('a pixie');
    expect(cleanLie('   ')).toBeNull();
    expect(cleanLie('x'.repeat(50))).toHaveLength(30);
  });

  it('counts the truth however it is typed', () => {
    const fact = { id: 'x', text: 'An octopus has ___ hearts.', answer: 'three', alts: ['3'] };
    for (const t of ['Three', 'THREE!', '3', ' three ']) expect(isTruth(fact, t)).toBe(true);
    expect(isTruth(fact, 'four')).toBe(false);
    expect(answerKey('The Unicorns')).toBe(answerKey('unicorn'));
    expect(answerKey('Crème brûlée')).toBe(answerKey('creme brulee'));
  });
});

describe('Fibber', () => {
  it('everyone who is not duelling votes, the Host first', () => {
    const s = logic.init(0, rng, room(2));
    expect(s.voters.map((p) => [p.id, p.host])).toEqual([
      ['h', true],
      ['p0', false],
      ['p1', false],
    ]);
    expect(s.status).toBe('writing');
  });

  it('turns away the real answer and a copy of the other lie', () => {
    let s = logic.init(0, rng, room(1));
    s = { ...s, fact: { id: 'x', text: `An octopus has ${BLANK} hearts.`, answer: 'three', alts: ['3'] } };
    const t = logic.onInput(s, 'a', { action: 'lie', text: '3' }, 0, rng);
    expect(t.lies.a).toBeUndefined();
    expect(t.rejected.a).toBe('truth');
    s = logic.onInput(t, 'a', { action: 'lie', text: 'Two' }, 0, rng);
    expect(s.lies.a).toBe('Two');
    expect(s.rejected.a).toBeUndefined();
    const u = logic.onInput(s, 'b', { action: 'lie', text: 'two' }, 0, rng);
    expect(u.rejected.b).toBe('taken');
    expect(u.status).toBe('writing');
    // A lie can't be changed once it's locked in, and only duelists write.
    expect(logic.onInput(s, 'a', { action: 'lie', text: 'nine' }, 0, rng)).toBe(s);
    expect(logic.onInput(s, 'ref', { action: 'lie', text: 'nine' }, 0, rng)).toBe(s);
  });

  it('keeps lies secret while writing, then shows the truth and both lies shuffled with no owners', () => {
    let s = logic.init(0, rng, room(2));
    s = logic.onInput(s, 'a', { action: 'lie', text: 'pixie' }, 0, rng);
    expect(logic.project(s).lies).toEqual({});
    expect(logic.project(s).written).toEqual(['a']);
    s = logic.onInput(s, 'b', { action: 'lie', text: 'gnome' }, 0, rng);
    expect(s.status).toBe('voting');
    const v = logic.project(s);
    expect(v.options.map((o) => o.text).sort()).toEqual(['gnome', 'pixie', s.fact.answer].sort());
    expect(v.options.every((o) => o.owner === null)).toBe(true);
    expect(v.answer).toBeNull();
  });

  it('keeps votes hidden until everyone has voted', () => {
    let s = voting();
    s = vote(s, 'p0', 'a');
    expect(logic.project(s).votes).toBeNull();
    expect(logic.project(s).voted).toEqual(['p0']);
    // No changing your vote, and duelists can't vote.
    expect(vote(s, 'p0', 'truth')).toBe(s);
    expect(logic.onInput(s, 'a', { action: 'vote', pick: 0 }, 0, rng)).toBe(s);
    expect(logic.onInput(s, 'audience', { action: 'vote', pick: 0 }, 0, rng, 'stranger')).toBe(s);
    expect(logic.onInput(s, 'audience', { action: 'vote', pick: 7 }, 0, rng, 'p1')).toBe(s);
    s = vote(vote(s, 'p1', 'b'), 'h', 'a', 1000);
    expect(s.status).toBe('reveal');
    expect(s.fooled).toEqual({ a: 2, b: 1 });
    expect(logic.project(s).votes).not.toBeNull();
    expect(logic.project(s).answer).toBe('unicorn');
  });

  it('whoever fooled more people wins after the reveal', () => {
    let s = vote(vote(vote(voting(), 'h', 'b'), 'p0', 'b'), 'p1', 'truth', 1000);
    s = logic.tick!(s, 1000 + REVEAL_MS - 1, rng);
    expect(s.status).toBe('reveal');
    s = logic.tick!(s, 1000 + REVEAL_MS, rng);
    expect(s.status).toBe('result');
    expect(logic.result(s)).toBeNull();
    s = logic.tick!(s, 1000 + REVEAL_MS + RESULT_MS, rng);
    expect(logic.result(s)).toBe('b');
  });

  it('a draw or nobody fooled plays a new fact', () => {
    for (const picks of [
      ['a', 'b', 'truth'],
      ['truth', 'truth', 'truth'],
    ] as const) {
      let s = voting();
      s = vote(vote(vote(s, 'h', picks[0]), 'p0', picks[1]), 'p1', picks[2], 0);
      s = logic.tick!(s, REVEAL_MS, rng);
      expect(s.status).toBe('replay');
      const before = s.fact.id;
      s = logic.tick!(s, REVEAL_MS + RESULT_MS, rng);
      expect(s.status).toBe('writing');
      expect(s.number).toBe(2);
      expect(s.lies).toEqual({});
      expect(s.votes).toEqual({});
      expect(s.fact.id).not.toBe(before);
      expect(s.writeUntil).toBe(REVEAL_MS + RESULT_MS + WRITE_MS);
    }
  });

  it('the Host can go on without slow voters, and voting time running out counts what is in', () => {
    let s = voting();
    expect(logic.onInput(s, 'ref', { action: 'skip' }, 0, rng)).toBe(s);
    s = vote(s, 'p0', 'a');
    expect(logic.onInput(s, 'audience', { action: 'skip' }, 0, rng, 'p0')).toBe(s);
    expect(logic.onInput(s, 'ref', { action: 'skip' }, 0, rng).status).toBe('reveal');
    const late = logic.tick!(s, VOTE_MS, rng);
    expect(late.status).toBe('reveal');
    expect(late.fooled).toEqual({ a: 1, b: 0 });
  });

  it('no lie in time loses, and no lies at all is a new fact', () => {
    let s = logic.init(0, rng, room(1));
    s = logic.onInput(s, 'a', { action: 'lie', text: 'pixie' }, 0, rng);
    expect(logic.onInput(s, 'b', { action: 'lie', text: 'gnome' }, WRITE_MS, rng).lies.b).toBeUndefined();
    let t = logic.tick!(s, WRITE_MS, rng);
    expect(t.status).toBe('result');
    expect(t.noLie).toEqual(['b']);
    expect(logic.result(logic.tick!(t, WRITE_MS + RESULT_MS, rng))).toBe('a');
    t = logic.tick!(logic.init(0, rng, room(1)), WRITE_MS, rng);
    expect(t.status).toBe('replay');
  });

  it('the Host can swap the fact only before any lie is in', () => {
    const s = logic.init(0, rng, room(1));
    const t = logic.onInput(s, 'ref', { action: 'newFact' }, 5000, rng);
    expect(t.fact.id).not.toBe(s.fact.id);
    expect(t.number).toBe(1);
    expect(t.writeUntil).toBe(5000 + WRITE_MS);
    expect(logic.onInput(s, 'audience', { action: 'newFact' }, 0, rng, 'p0')).toBe(s);
    const lied = logic.onInput(s, 'a', { action: 'lie', text: 'pixie' }, 0, rng);
    expect(logic.onInput(lied, 'ref', { action: 'newFact' }, 0, rng)).toBe(lied);
  });

  it('with only the Host watching, the Host is the one voter', () => {
    let s = voting(0);
    expect(s.voters).toHaveLength(1);
    s = vote(s, 'h', 'a');
    expect(s.status).toBe('reveal');
  });

  it('reveals the votes, then each lie, then the truth', () => {
    expect([0, 2_499, 2_500, 5_000, 7_500, 99_000].map((t) => revealStep(0, t))).toEqual([0, 0, 1, 2, 3, 3]);
    expect(unmaskOrder([{ owner: 'a' }, { owner: 'truth' }, { owner: 'b' }])).toEqual([0, 2, 1]);
  });
});
