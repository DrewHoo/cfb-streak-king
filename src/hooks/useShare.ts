import { useState } from 'react';

/** The native share sheet where there is one, else copy "text url" and flash "copied"; `copy` puts any text on the clipboard with no toast (the caller shows its own). */
export function useShare() {
  const [copied, setCopied] = useState(false);
  const share = (text: string, url: string) => {
    try {
      if (navigator.share) { navigator.share({ title: 'Streak King', text, url }).catch(() => {}); return; }
      navigator.clipboard.writeText(`${text} ${url}`).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      });
    } catch {}
  };
  const copy = (text: string) => {
    try { navigator.clipboard.writeText(text).catch(() => {}); } catch {}
  };
  return { copied, share, copy };
}
