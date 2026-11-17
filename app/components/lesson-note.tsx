import { useState } from "react";
import { useFetcher } from "react-router";
import { Lock, NotebookPen } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { cn, formatRelativeTime } from "~/lib/utils";
import { MAX_NOTE_LENGTH } from "~/lib/notes";
import {
  describeNoteDraft,
  type NoteDraft,
  type NoteDraftStatus,
} from "~/modules/lesson-note";

/** Shares its shape with `CommentThread` so the two cards read as one set. */
export function LessonNote({
  note,
}: {
  note: { body: string; updatedAt: string } | null;
}) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const [body, setBody] = useState(note?.body ?? "");
  const isSaving = fetcher.state !== "idle";
  const draft = describeNoteDraft({
    body,
    saved: note,
    maxLength: MAX_NOTE_LENGTH,
    error: isSaving ? undefined : fetcher.data?.error,
  });

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <NoteHeader />

        <fetcher.Form method="post" className="space-y-2">
          <input type="hidden" name="intent" value="save-note" />
          <Textarea
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            placeholder="Jot down what you want to remember from this lesson..."
            aria-label="Your notes"
            className="min-h-24 resize-y"
          />

          <NoteFooter draft={draft} isSaving={isSaving} />
        </fetcher.Form>
      </CardContent>
    </Card>
  );
}

function NoteFooter({
  draft,
  isSaving,
}: {
  draft: NoteDraft;
  isSaving: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <Button type="submit" size="sm" disabled={isSaving || !draft.canSave}>
        {isSaving ? "Saving..." : "Save note"}
      </Button>
      <NoteStatus status={draft.status} />
      <span
        className={cn(
          "ml-auto text-xs",
          draft.status.kind === "too-long"
            ? "text-destructive"
            : "text-muted-foreground"
        )}
      >
        {draft.counter}
      </span>
    </div>
  );
}

function NoteHeader() {
  return (
    <div className="mb-4 flex items-center gap-2">
      <NotebookPen className="size-5 text-primary" />
      <h2 className="text-xl font-semibold">Your notes</h2>
      <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
        <Lock className="size-3" />
        Only you can see these
      </span>
    </div>
  );
}

function NoteStatus({ status }: { status: NoteDraftStatus }) {
  switch (status.kind) {
    case "error":
      return <span className="text-sm text-destructive">{status.message}</span>;
    case "too-long":
      return (
        <span className="text-xs text-destructive">
          Too long to save. Trim it down first.
        </span>
      );
    case "unsaved":
      return (
        <span className="text-xs text-muted-foreground">Unsaved changes</span>
      );
    case "saved":
      return (
        <span
          suppressHydrationWarning
          className="text-xs text-muted-foreground"
        >
          Saved · last edited {formatRelativeTime(status.updatedAt)}
        </span>
      );
    case "blank":
      return null;
  }
}
