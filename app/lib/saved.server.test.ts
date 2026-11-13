import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { UserRole } from "~/db/schema";
import {
  deleteNote,
  getNote,
  isBookmarked,
  listBookmarks,
  listNotes,
  saveNote,
  toggleBookmark,
} from "./saved.server";
import { approveRefundRequest, raiseRefundRequest } from "./refunds.server";
import { fakeNotifications } from "./notifications.fake.server";

type TestDb = ReturnType<typeof createTestDb>;

const NOW = new Date(2026, 9, 6, 12, 0, 0);
const LATER = new Date(2026, 9, 7, 9, 30, 0);

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let lessonIds: number[];

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);

  const module = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();

  lessonIds = [1, 2].map(
    (position) =>
      db
        .insert(schema.lessons)
        .values({ moduleId: module.id, title: `Lesson ${position}`, position })
        .returning()
        .get().id
  );
});

function addStudent(name: string) {
  return db
    .insert(schema.users)
    .values({ name, email: `${name.toLowerCase()}@example.com`, role: UserRole.Student })
    .returning()
    .get();
}

describe("bookmarking a Lesson", () => {
  it("bookmarks on the first toggle and removes it on the second", () => {
    expect(toggleBookmark(db, base.user.id, lessonIds[0], NOW)).toBe(true);
    expect(isBookmarked(db, base.user.id, lessonIds[0])).toBe(true);

    expect(toggleBookmark(db, base.user.id, lessonIds[0], LATER)).toBe(false);
    expect(isBookmarked(db, base.user.id, lessonIds[0])).toBe(false);
  });

  it("never leaves two Bookmarks on the same Lesson", () => {
    toggleBookmark(db, base.user.id, lessonIds[0], NOW);
    expect(() =>
      db
        .insert(schema.bookmarks)
        .values({ userId: base.user.id, lessonId: lessonIds[0] })
        .run()
    ).toThrow();

    expect(listBookmarks(db, base.user.id)).toHaveLength(1);
  });
});

describe("saving a Note", () => {
  it("creates the Note, trimmed, on a Lesson with none", () => {
    const result = saveNote(db, base.user.id, lessonIds[0], "  # not a heading *  ", NOW);

    expect(result.ok).toBe(true);
    expect(getNote(db, base.user.id, lessonIds[0])).toMatchObject({
      body: "# not a heading *",
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
  });

  it("replaces the body and moves the last edited time on when saved again", () => {
    saveNote(db, base.user.id, lessonIds[0], "First thoughts", NOW);
    saveNote(db, base.user.id, lessonIds[0], "Second thoughts", LATER);

    expect(getNote(db, base.user.id, lessonIds[0])).toMatchObject({
      body: "Second thoughts",
      createdAt: NOW.toISOString(),
      updatedAt: LATER.toISOString(),
    });
    expect(listNotes(db, base.user.id)).toHaveLength(1);
  });

  it("accepts exactly 2,000 characters and refuses 2,001", () => {
    expect(saveNote(db, base.user.id, lessonIds[0], "a".repeat(2000), NOW).ok).toBe(true);

    const tooLong = saveNote(db, base.user.id, lessonIds[0], "b".repeat(2001), LATER);
    expect(tooLong).toEqual({ ok: false, error: "A note can be at most 2,000 characters." });
    expect(getNote(db, base.user.id, lessonIds[0])?.body).toBe("a".repeat(2000));
  });
});

describe("clearing or deleting a Note", () => {
  it("deletes the Note when it is saved empty", () => {
    saveNote(db, base.user.id, lessonIds[0], "Something", NOW);

    expect(saveNote(db, base.user.id, lessonIds[0], "   \n  ", LATER)).toEqual({ ok: true, note: null });
    expect(getNote(db, base.user.id, lessonIds[0])).toBeUndefined();
    expect(listNotes(db, base.user.id)).toEqual([]);
  });

  it("deletes the Note on request, leaving other Students' Notes alone", () => {
    const other = addStudent("Olive");
    saveNote(db, base.user.id, lessonIds[0], "Mine", NOW);
    saveNote(db, other.id, lessonIds[0], "Theirs", NOW);

    deleteNote(db, base.user.id, lessonIds[0]);

    expect(getNote(db, base.user.id, lessonIds[0])).toBeUndefined();
    expect(getNote(db, other.id, lessonIds[0])?.body).toBe("Theirs");
  });

  it("lets the Student write a fresh Note after deleting one", () => {
    saveNote(db, base.user.id, lessonIds[0], "Old", NOW);
    deleteNote(db, base.user.id, lessonIds[0]);
    saveNote(db, base.user.id, lessonIds[0], "New", LATER);

    expect(getNote(db, base.user.id, lessonIds[0])).toMatchObject({
      body: "New",
      createdAt: LATER.toISOString(),
    });
  });
});

describe("the Saved lists", () => {
  it("hold only the Student's own rows, newest first, with their Lesson and Course", () => {
    const other = addStudent("Olive");
    toggleBookmark(db, base.user.id, lessonIds[0], NOW);
    toggleBookmark(db, base.user.id, lessonIds[1], LATER);
    toggleBookmark(db, other.id, lessonIds[0], NOW);
    saveNote(db, base.user.id, lessonIds[1], "Older", NOW);
    saveNote(db, base.user.id, lessonIds[0], "Newer", LATER);
    saveNote(db, other.id, lessonIds[0], "Not yours", LATER);

    expect(listBookmarks(db, base.user.id)).toMatchObject([
      { lessonId: lessonIds[1], lessonTitle: "Lesson 2", courseTitle: "Test Course", courseSlug: "test-course" },
      { lessonId: lessonIds[0], lessonTitle: "Lesson 1", courseTitle: "Test Course", courseSlug: "test-course" },
    ]);
    expect(listNotes(db, base.user.id).map((note) => note.body)).toEqual(["Newer", "Older"]);
  });
});

describe("an approved Refund", () => {
  it("leaves the Student's Bookmarks and Notes in place", async () => {
    const notifications = fakeNotifications();
    const admin = db
      .insert(schema.users)
      .values({ name: "Pat Admin", email: "pat@example.com", role: UserRole.Admin })
      .returning()
      .get();
    const purchase = db
      .insert(schema.purchases)
      .values({ userId: base.user.id, courseId: base.course.id, amountPaid: 7900, createdAt: NOW.toISOString() })
      .returning()
      .get();
    db.insert(schema.enrollments).values({ userId: base.user.id, courseId: base.course.id }).run();

    toggleBookmark(db, base.user.id, lessonIds[0], NOW);
    saveNote(db, base.user.id, lessonIds[0], "Keep me", NOW);

    const raised = await raiseRefundRequest(db, purchase.id, base.user.id, "Not for me.", NOW, notifications);
    if (!raised.ok) throw new Error(raised.error);
    const approved = await approveRefundRequest(db, raised.refundRequestId, admin.id, null, NOW, notifications);
    expect(approved.ok).toBe(true);

    expect(isBookmarked(db, base.user.id, lessonIds[0])).toBe(true);
    expect(getNote(db, base.user.id, lessonIds[0])?.body).toBe("Keep me");
  });
});
