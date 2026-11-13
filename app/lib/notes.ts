import { z } from "zod";

export const MAX_NOTE_LENGTH = 2000;

// A Note body is plain text: trimmed, and refused (not truncated) past the cap.
// An empty body is allowed: saving one clears (deletes) the Note.
// Shared by the Lesson page's form schema and the notes service.
export const noteBodySchema = z
  .string()
  .trim()
  .max(
    MAX_NOTE_LENGTH,
    `A note can be at most ${MAX_NOTE_LENGTH.toLocaleString("en")} characters.`
  );
