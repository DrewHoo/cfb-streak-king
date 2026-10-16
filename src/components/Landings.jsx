// The named definition boards (landing.ts), listed under the grid: real
// links to each page's address, so a crawler reaches every one from the
// board, and a tap opens the definition in place.

import { LANDINGS } from '../lib/landing.ts';

const BASE = import.meta.env.BASE_URL;

export function Landings({ current, hrefOf, onOpen }) {
  const groups = [['Active streaks', LANDINGS.filter((l) => l.scope === 'active')], ['All-time streaks', LANDINGS.filter((l) => l.scope === 'all')]];
  return (
    <nav className="landings" aria-label="Streak boards">
      <h2>Streak boards</h2>
      <div className="landings-cols">
        {groups.map(([name, list]) => (
          <div key={name}>
            <span className="landings-h">{name}</span>
            <ul>
              {list.map((l) => (
                <li key={l.slug}>
                  <a href={hrefOf(l)} aria-current={current?.slug === l.slug ? 'page' : undefined} onClick={(e) => { e.preventDefault(); onOpen(l); }}>
                    {l.h1.replace(/ in college football( history)?$/, '')}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="landings-more"><a href={`${BASE}blog/`}>Weekly posts</a>: the streaks at stake in the coming week's games, and the ones its results broke. <a href={`${BASE}data/`}>The data</a>: every file the site reads, free to use with credit.</p>
    </nav>
  );
}
