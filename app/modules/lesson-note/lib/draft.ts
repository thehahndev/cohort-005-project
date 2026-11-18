export type NoteDraftStatus =
  | { kind: "error"; message: string }
  | { kind: "too-long" }
  | { kind: "unsaved" }
  | { kind: "saved"; updatedAt: string }
  | { kind: "blank" };

export type NoteDraft = {
  counter: string;
  canSave: boolean;
  status: NoteDraftStatus;
};

/**
 * What the note editor shows for the text in the box right now: the
 * character counter, whether Save is worth pressing, and the status line.
 * The server trims a note before checking and storing it, so the draft is
 * judged on its trimmed text too.
 */
export function describeNoteDraft({
  body,
  saved,
  maxLength,
  error,
}: {
  body: string;
  saved: { body: string; updatedAt: string } | null;
  maxLength: number;
  error?: string;
}): NoteDraft {
  const trimmed = body.trim();
  const tooLong = trimmed.length > maxLength;
  const empty = trimmed.length === 0;
  const unsaved = trimmed !== saved?.body;

  return {
    counter: `${trimmed.length.toLocaleString("en")} / ${maxLength.toLocaleString("en")}`,
    canSave: unsaved && !empty && !tooLong,
    status: statusOf({ error, tooLong, unsaved, empty, saved }),
  };
}

function statusOf({
  error,
  tooLong,
  unsaved,
  empty,
  saved,
}: {
  error?: string;
  tooLong: boolean;
  unsaved: boolean;
  empty: boolean;
  saved: { updatedAt: string } | null;
}): NoteDraftStatus {
  if (error) return { kind: "error", message: error };
  if (tooLong) return { kind: "too-long" };
  // A cleared draft is not saveable, so calling it "unsaved" would nag.
  if (unsaved && !empty) return { kind: "unsaved" };
  if (saved && !unsaved) return { kind: "saved", updatedAt: saved.updatedAt };
  return { kind: "blank" };
}
