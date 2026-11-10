/**
 * Keeps contact details (email, postal address) out of reach of scrapers while people still see
 * and use them normally. Two measures, used together:
 *
 *  - `scatter` — for text that is shown. The string is cut into small pieces with junk in between;
 *    the junk is hidden by CSS (`.decoy`), so it is neither displayed, read aloud nor copied, but a
 *    bot reading the markup or its text content gets garbage. Works without JavaScript.
 *  - `encode` / `decode` — for values that have to exist as one string (a `mailto:` target, the
 *    clipboard). The page only carries the encoded form; Layout.astro decodes it once a person
 *    actually interacts with the page.
 *
 * Neither is cryptography: the aim is that the details never appear as plain text in what a bot
 * downloads. Don't put them into meta tags or JSON-LD either.
 */

const KEY = [0x3d, 0x71, 0x1a, 0x58, 0x2e, 0x67, 0x0b];

export function encode(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    out += (value.charCodeAt(i) ^ KEY[i % KEY.length]).toString(16).padStart(4, "0");
  }
  return out;
}

export function decode(hex: string): string {
  let out = "";
  for (let i = 0; i * 4 < hex.length; i++) {
    out += String.fromCharCode(parseInt(hex.slice(i * 4, i * 4 + 4), 16) ^ KEY[i % KEY.length]);
  }
  return out;
}

export interface Piece {
  text: string;
  decoy: boolean;
}

export function scatter(value: string): Piece[] {
  // Small deterministic generator, so builds are reproducible.
  let seed = [...value].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7);
  const next = (n: number) => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return Math.floor((seed / 2 ** 32) * n);
  };
  const junk = () => Array.from({ length: 2 + next(2) }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[next(36)]).join("");

  const pieces: Piece[] = [];
  for (let i = 0; i < value.length; ) {
    // "@" always stands alone, so no address-shaped string survives on either side of it.
    const end = value[i] === "@" ? i + 1 : Math.min(i + 2 + next(3), value.length);
    const at = value.indexOf("@", i + 1);
    const stop = at > i && at < end ? at : end;
    pieces.push({ text: value.slice(i, stop), decoy: false });
    if (stop < value.length) pieces.push({ text: junk(), decoy: true });
    i = stop;
  }
  return pieces;
}
