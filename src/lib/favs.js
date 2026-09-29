// Saved streaks live in localStorage until accounts exist (specs/accounts.spec.md).

const KEY = 'sk-favs';

export const readFavs = () => {
  try {
    const f = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(f) ? f : [];
  } catch { return []; }
};
export const writeFavs = (f) => {
  try { localStorage.setItem(KEY, JSON.stringify(f)); } catch {}
};

// the analytics embed is third-party and blockable, hence optional-chained
export const track = (name, props) => {
  try { window.dhAnalytics?.track(name, props); } catch {}
};
