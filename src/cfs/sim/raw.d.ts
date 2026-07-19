/**
 * Vite's `?raw` suffix returns a module's file contents as a string.
 *
 * Used by docs.test.ts to read README.md without pulling in @types/node — the
 * test needs the document's text, not a filesystem.
 */
declare module "*.md?raw" {
  const content: string;
  export default content;
}
