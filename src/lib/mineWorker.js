// A thread of the mine: runs mineCore over the subtrees it is given and
// posts the result back. Plain JavaScript so Node's worker_threads can load
// it as is; the same file serves as a Web Worker on the dev server (Vite
// bundles it as a module worker).
import { mineCore } from './mineCore.js';

const isNode = typeof process !== 'undefined' && !!process.versions?.node && typeof self === 'undefined';

// The thread gets the data once, then pieces of the walk one at a time: a
// message { prefix, descend } answers with that piece's candidates, until
// null ends it. Pieces differ in size by orders of magnitude, so dealing
// them on demand keeps every core busy.
if (isNode) {
  // the specifier is built so Vite, bundling this file as a Web Worker, leaves it alone
  import(/* @vite-ignore */ 'node:' + 'worker_threads').then(({ parentPort, workerData }) => {
    parentPort.on('message', (piece) => {
      if (piece == null) { parentPort.close(); return; }
      parentPort.postMessage(mineCore({ ...workerData, ...piece }));
    });
  });
} else {
  let data = null;
  self.onmessage = (e) => {
    if (e.data && e.data.teams) { data = e.data; return; }
    self.postMessage(mineCore({ ...data, ...e.data }));
  };
}
