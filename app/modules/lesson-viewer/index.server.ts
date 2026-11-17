/**
 * Everything the lesson page reads and writes: the course outline, progress,
 * the discussion thread and quiz scoring. The route asks this module and does
 * not query the database itself.
 */
export {
  createCommentSchema,
  deleteCommentSchema,
  editCommentSchema,
  INTENT_CAPABILITY,
  lessonRef,
  saveNoteSchema,
} from "./lib/intents";
export {
  flattenCourseLessons,
  getCourseWithDetails,
  getLessonById,
  getModuleById,
  getUserById,
} from "./lib/course";
export {
  calculateWatchProgress,
  getLastWatchPosition,
  getLessonProgress,
  getLessonProgressForCourse,
  markLessonComplete,
  markLessonInProgress,
} from "./lib/progress";
export { getCommentById, getLessonThread, renderThread } from "./lib/comments";
export {
  computeResult,
  getBestAttempt,
  getQuizById,
  getQuizByLessonId,
  getQuizWithQuestions,
} from "./lib/quiz";
