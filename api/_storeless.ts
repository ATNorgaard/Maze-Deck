/* TEMPORARY. A stand-in for _store.ts with no env reads, to tell an import
   failure apart from a configuration one. */
export function topicFor(code: string): string {
  return `session:${code}`;
}
