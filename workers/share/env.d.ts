// wrangler's Data rule (wrangler.jsonc) hands a .ttf import over as an ArrayBuffer.
declare module '*.ttf' {
  const data: ArrayBuffer;
  export default data;
}
