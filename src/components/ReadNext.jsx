// What to read next: the first five of the back-bar embed's draw, as
// sentences, each a link. Until the embed draws (and when it never does) the
// list the prerender baked into the page; with neither, no block.
import { useEffect, useRef, useState } from 'react';
import { bakedLinks, drawnLinks, tapLink, blockShown, isPun } from '../lib/readNext.ts';

export function ReadNext() {
  // the baked list first, so the hydrate matches the prerender
  const [links, setLinks] = useState(bakedLinks);
  const ref = useRef(null);
  useEffect(() => {
    const take = () => setLinks(drawnLinks() ?? bakedLinks());
    take();
    window.addEventListener('dh:readnext', take);
    return () => window.removeEventListener('dh:readnext', take);
  }, []);
  // a sighting once the block is on screen, again when the draw changes
  useEffect(() => {
    if (!links.length || !ref.current || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((seen) => {
      if (!seen.some((e) => e.isIntersecting)) return;
      io.disconnect();
      blockShown(links);
    });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [links]);
  if (!links.length) return null;
  return (
    <>
      <h2>What to read next</h2>
      <div className="notes readnext" ref={ref}>
        {links.map((l, i) => (
          <p key={l.id}>
            <a href={l.href} referrerPolicy={isPun(l.href) ? 'no-referrer-when-downgrade' : undefined} onClick={() => tapLink(l, i + 1)}>{l.text}</a>
          </p>
        ))}
      </div>
    </>
  );
}
