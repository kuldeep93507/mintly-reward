// A screen can claim the Android back button (e.g. the game asks before quitting).
let override: (() => void) | null = null;
export function setBackOverride(fn: (() => void) | null) { override = fn; }
export function getBackOverride() { return override; }
