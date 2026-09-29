// The analytics embed is third-party and blockable, hence optional-chained.

declare global {
  interface Window { dhAnalytics?: { track: (name: string, props?: Record<string, unknown>) => void } }
}

export const track = (name: string, props?: Record<string, unknown>) => {
  try { window.dhAnalytics?.track(name, props); } catch {}
};
