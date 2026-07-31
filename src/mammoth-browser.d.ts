// mammoth ships types only for its default entry. The pre-built browser bundle has
// the same public API — resume-parse.ts imports it (for a Buffer polyfill) and casts
// it to the typed default entry's shape.
declare module "mammoth/mammoth.browser";
