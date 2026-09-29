// Starred definitions live in localStorage until accounts exist
// (specs/accounts.spec.md). The key predates the "starred" name; keep it so
// existing stars survive.

export interface StarredDef {
  /** encodeChips() of the definition. */
  c: string;
  dir: 'W' | 'L' | 'U' | 'C' | 'N';
  name: string;
}

const KEY = 'sk-favs';

export const readStarred = (): StarredDef[] => {
  try {
    const f = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return Array.isArray(f) ? f : [];
  } catch { return []; }
};
export const writeStarred = (f: StarredDef[]) => {
  try { localStorage.setItem(KEY, JSON.stringify(f)); } catch {}
};
