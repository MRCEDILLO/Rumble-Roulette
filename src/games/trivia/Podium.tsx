import { Character } from '../../characters/Character';
import type { DuelPeople } from '../types';

/** A duelist behind a podium, with a buzzer that lights up when they buzz. Used by every buzz-in game. */
export function Contestant({
  people,
  side,
  lit,
  won,
  done,
}: {
  people: DuelPeople;
  side: 'a' | 'b';
  lit: boolean;
  won: boolean;
  done: boolean;
}) {
  const p = people[side];
  return (
    <div className={`trivia-contestant${lit ? ' lit' : ''}${won ? ' won' : ''}`}>
      <Character color={p.color} accessory={p.accessory} size={130} flip={side === 'b'} pose={won ? 'win' : done ? 'lose' : 'idle'} />
      {/* The podium sits in front of the character, with a buzzer that lights up when they buzz. */}
      <div className="podium">
        <div className="podium-buzzer" />
        <div className="podium-top" />
        <div className="podium-front">
          <span className="podium-name">{p.name}</span>
        </div>
      </div>
    </div>
  );
}
