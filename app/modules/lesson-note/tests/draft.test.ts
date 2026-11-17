import { describe, it, expect } from "vitest";
import { describeNoteDraft } from "../index";

const saved = {
  body: "Result types beat throw",
  updatedAt: "2026-11-17T10:00:00Z",
};

describe("describeNoteDraft", () => {
  it("counts characters against the limit", () => {
    const draft = describeNoteDraft({
      body: "abc",
      saved: null,
      maxLength: 2000,
    });
    expect(draft.counter).toBe("3 / 2,000");
  });

  it("shows a blank status and no Save for an untouched empty note", () => {
    const draft = describeNoteDraft({ body: "", saved: null, maxLength: 2000 });
    expect(draft.canSave).toBe(false);
    expect(draft.status).toEqual({ kind: "blank" });
  });

  it("does not offer Save for whitespace only", () => {
    const draft = describeNoteDraft({
      body: "   ",
      saved: null,
      maxLength: 2000,
    });
    expect(draft.canSave).toBe(false);
    expect(draft.status).toEqual({ kind: "blank" });
  });

  it("flags new text as unsaved and saveable", () => {
    const draft = describeNoteDraft({
      body: "hi",
      saved: null,
      maxLength: 2000,
    });
    expect(draft.canSave).toBe(true);
    expect(draft.status).toEqual({ kind: "unsaved" });
  });

  it("shows when a note matching the box was last saved", () => {
    const draft = describeNoteDraft({
      body: saved.body,
      saved,
      maxLength: 2000,
    });
    expect(draft.canSave).toBe(false);
    expect(draft.status).toEqual({ kind: "saved", updatedAt: saved.updatedAt });
  });

  it("flags an edit to a saved note as unsaved", () => {
    const draft = describeNoteDraft({
      body: `${saved.body}!`,
      saved,
      maxLength: 2000,
    });
    expect(draft.canSave).toBe(true);
    expect(draft.status).toEqual({ kind: "unsaved" });
  });

  it("allows exactly the limit but not one more", () => {
    expect(
      describeNoteDraft({ body: "a".repeat(5), saved: null, maxLength: 5 })
        .canSave
    ).toBe(true);
    const over = describeNoteDraft({
      body: "a".repeat(6),
      saved: null,
      maxLength: 5,
    });
    expect(over.canSave).toBe(false);
    expect(over.status).toEqual({ kind: "too-long" });
  });

  it("puts a server error ahead of everything else", () => {
    const draft = describeNoteDraft({
      body: "a".repeat(6),
      saved,
      maxLength: 5,
      error: "Nope",
    });
    expect(draft.status).toEqual({ kind: "error", message: "Nope" });
  });

  it("treats a cleared saved note as blank, not saveable", () => {
    const draft = describeNoteDraft({ body: "", saved, maxLength: 2000 });
    expect(draft.canSave).toBe(false);
    expect(draft.status).toEqual({ kind: "blank" });
  });
});
