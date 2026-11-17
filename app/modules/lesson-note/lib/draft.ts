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

export function describe({
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
  const tooLong = body.length > maxLength;
  const empty = body.trim().length === 0;
  const unsaved = body !== saved?.body;

  return {
    counter: `${body.length.toLocaleString("en")} / ${maxLength.toLocaleString("en")}`,
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
