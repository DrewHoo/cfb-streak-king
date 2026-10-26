// The share worker reports a link preview and nothing else: no search engine,
// AI crawler or other bot counts as a share (2026-10-26).
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const worker = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

test('sends Mixpanel nothing for a crawler, only for a link preview', () => {
  expect(worker).toMatch(/if \(!PREVIEWS\.has\(agent\)\) return;/);
  const previews = worker.match(/const PREVIEWS = new Set\(\[([^\]]*)\]\)/)![1];
  for (const bot of ['google', 'bing', 'apple', 'other-bot', 'browser']) expect(previews).not.toContain(`'${bot}'`);
  for (const preview of ['imessage', 'google-messages', 'slack', 'discord']) expect(previews).toContain(`'${preview}'`);
  // Google Messages sends iMessage's tokens too, so it has to match first
  expect(worker.indexOf("'google-messages']")).toBeLessThan(worker.indexOf("'imessage']"));
});
