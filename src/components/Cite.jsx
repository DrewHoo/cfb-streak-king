// The credit line, for whoever is writing about a streak: "cite" copies one
// line with the claim and the permalink ("… (per Streak King, https://…)"),
// "embed" copies an image card that links to it (the share worker draws the
// card). Writers credit a source in one line; this is the line. The caller
// builds the text when a button is pressed, since the address and the card
// depend on where the reader is.

import { useState } from 'react';

export function Cite({ onCopy, label = 'cite' }) {
  const [done, setDone] = useState(null);
  const copy = (embed) => {
    onCopy(embed);
    setDone(embed ? 'embed' : 'cite');
    setTimeout(() => setDone(null), 1600);
  };
  return (
    <span className="cite">
      <button className="cite-b" onClick={() => copy(false)} title="copy a one-line credit with the link" aria-label="Copy a citation">{done === 'cite' ? 'copied' : label}</button>
      <button className="cite-b" onClick={() => copy(true)} title="copy an image card that links here" aria-label="Copy an embed card">{done === 'embed' ? 'copied' : 'embed'}</button>
    </span>
  );
}
