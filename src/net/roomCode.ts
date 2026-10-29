// No I or O so codes can't be misread as 1 or 0.
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export function newRoomCode(): string {
  let code = '';
  for (let i = 0; i < 4; i++) code += LETTERS[Math.floor(Math.random() * LETTERS.length)];
  return code;
}

export function cleanRoomCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 4);
}
