import { describe } from "./lib/draft";

export type { NoteDraft, NoteDraftStatus } from "./lib/draft";

/**
 * What the note editor shows for the text in the box right now: the
 * character counter, whether Save is worth pressing, and the status line.
 */
export function describeNoteDraft(input: Parameters<typeof describe>[0]) {
  return describe(input);
}
