// Nickname filter. Nicknames are shown to other players, so obvious abuse (English and
// Hindi/Hinglish slurs) is refused. Kept deliberately short and strict-substring based:
// it is a first line of defence; players can still be reported and renamed by the owner.

const BLOCKED = [
  // English
  'fuck', 'fuk', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'asshole', 'bastard', 'slut', 'whore',
  'nigger', 'nigga', 'faggot', 'rape', 'porn', 'sex', 'nude', 'penis', 'vagina', 'boob',
  // Hindi / Hinglish
  'chutiya', 'chutia', 'chotiya', 'chut', 'madarchod', 'mc', 'bhenchod', 'behenchod', 'bc', 'bhosdi', 'bhosda',
  'gandu', 'gand', 'lund', 'lauda', 'loda', 'randi', 'harami', 'kamina', 'kutta', 'kutti', 'jhant',
  'chod', 'bsdk', 'mkc',
];

/** Short blocked words only count as a whole word (avoids "mc" in "mcqueen", "bc" in "abc"). */
const WHOLE_WORD_ONLY = new Set(['mc', 'bc', 'gand', 'chod', 'sex', 'dick', 'loda', 'mkc', 'fuk', 'rape', 'chut', 'randi', 'lauda', 'lund']);

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };

function normalize(s: string): string {
  return s.toLowerCase().replace(/[013457@$!]/g, (c) => LEET[c] ?? c);
}

/** True when a nickname contains abusive words. */
export function isOffensiveName(name: string): boolean {
  const n = normalize(name);
  const squashed = n.replace(/[^a-z]/g, '');
  const words = n.split(/[^a-z]+/).filter(Boolean);
  for (const w of BLOCKED) {
    if (WHOLE_WORD_ONLY.has(w)) {
      if (words.includes(w)) return true;
    } else if (squashed.includes(w)) {
      return true;
    }
  }
  return false;
}
