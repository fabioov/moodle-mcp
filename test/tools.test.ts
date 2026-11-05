import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connect, fixture } from "./helpers.js";

// Freeze "now" so date-dependent tools are deterministic.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-05T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const f = fixture;

describe("tool registry", () => {
  it("exposes all tools", async () => {
    const { client } = await connect({});
    const names = (await client.listTools()).tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "get_assignment_status", "get_course_contents", "get_grades", "get_notifications",
      "get_site_info", "get_upcoming_deadlines", "list_assignments", "list_courses", "list_forum_discussions",
    ]);
  });
});

describe("get_site_info", () => {
  it("returns only safe, relevant fields", async () => {
    const { call } = await connect({});
    const r = await call("get_site_info");
    expect(r.data).toEqual({ sitename: "Example University", release: "4.5.1 (Build: 20250101)", userid: 42, fullname: "Ada Student", username: "ada" });
  });
});

describe("list_courses", () => {
  const h = { core_enrol_get_users_courses: f("core_enrol_get_users_courses") };
  it("hides ended courses by default and uses the current user id", async () => {
    const { call, calls } = await connect(h);
    const r = await call("list_courses");
    expect(r.data.map((c: any) => c.id)).toEqual([101, 102]);
    expect(r.data[0].enddate).toBeNull();
    expect(calls.find((c) => c.fn === "core_enrol_get_users_courses")!.params).toEqual({ userid: 42 });
  });
  it("includes ended courses with includePast", async () => {
    const { call } = await connect(h);
    expect((await call("list_courses", { includePast: true })).data).toHaveLength(3);
  });
});

describe("get_course_contents", () => {
  it("exposes id and instance for each module and tolerates sections without modules", async () => {
    const { call, calls } = await connect({ core_course_get_contents: f("core_course_get_contents") });
    const r = await call("get_course_contents", { courseId: 101 });
    expect(r.data[0].modules[0]).toEqual({
      id: 501, instance: 11, name: "Announcements", type: "forum", url: "https://moodle.test/mod/forum/view.php?id=501",
    });
    expect(r.data[2]).toEqual({ section: "Empty section", modules: [] });
    expect(calls.at(-1)!.params).toEqual({ courseid: 101 });
  });
});

describe("list_assignments", () => {
  const h = { mod_assign_get_assignments: f("mod_assign_get_assignments") };
  it("sorts most recent due date first by default", async () => {
    const { call } = await connect(h);
    const r = await call("list_assignments");
    expect(r.data.map((a: any) => a.id)).toEqual([4, 2, 1, 3]);
  });
  it("upcomingOnly keeps future ones, soonest first", async () => {
    const { call } = await connect(h);
    const r = await call("list_assignments", { upcomingOnly: true });
    expect(r.data.map((a: any) => a.id)).toEqual([2, 4]);
    expect(r.data[1]).toMatchObject({ course: "Computer Graphics 2026", courseId: 102, due: "2026-12-01T00:00:00.000Z", cutoff: "2026-12-02T00:00:00.000Z" });
  });
  it("applies limit and passes the course filter", async () => {
    const { call, calls } = await connect(h);
    expect((await call("list_assignments", { limit: 1 })).data).toHaveLength(1);
    await call("list_assignments", { courseId: 101 });
    expect(calls.at(-1)!.params).toEqual({ courseids: [101] });
  });
});

describe("get_assignment_status", () => {
  it("reports a submitted, not yet graded assignment", async () => {
    const { call } = await connect({ mod_assign_get_submission_status: f("status_submitted") });
    expect((await call("get_assignment_status", { assignmentId: 2 })).data).toEqual({
      submissionStatus: "submitted", gradingStatus: "notgraded", lastModified: "2026-11-04T10:00:00.000Z", graded: null, feedbackComments: [],
    });
  });
  it("reports grade and feedback comments", async () => {
    const { call } = await connect({ mod_assign_get_submission_status: f("status_graded") });
    const r = await call("get_assignment_status", { assignmentId: 1 });
    expect(r.data).toMatchObject({ gradingStatus: "graded", graded: "85.00000", feedbackComments: ["Good work"] });
  });
  it("handles a not-yet-submitted assignment", async () => {
    const { call } = await connect({ mod_assign_get_submission_status: f("status_none") });
    expect((await call("get_assignment_status", { assignmentId: 3 })).data.submissionStatus).toBe("new");
  });
});

describe("get_upcoming_deadlines", () => {
  const status = (p: any) => (p.assignid === 2 ? f("status_submitted") : f("status_none"));
  const h = () => ({
    core_calendar_get_action_events_by_timesort: f("core_calendar_get_action_events_by_timesort"),
    mod_assign_get_assignments: f("mod_assign_get_assignments"),
    mod_assign_get_submission_status: status,
  });
  it("merges calendar events and hidden assignments with status, soonest first", async () => {
    const { call } = await connect(h());
    const r = await call("get_upcoming_deadlines", { days: 30 });
    expect(r.data.map((d: any) => [d.name, d.status ?? null])).toEqual([
      ["Task soon", "submitted"],
      ["Quiz 1 closes", null],
      ["Task later", "pending"],
    ]);
  });
  it("onlyPending drops submitted assignments", async () => {
    const { call } = await connect(h());
    const r = await call("get_upcoming_deadlines", { days: 30, onlyPending: true });
    expect(r.data.map((d: any) => d.name)).toEqual(["Quiz 1 closes", "Task later"]);
  });
  it("does not fail when a status lookup fails", async () => {
    const { call } = await connect({ ...h(), mod_assign_get_submission_status: () => f("error_accessexception") });
    const r = await call("get_upcoming_deadlines", { days: 30 });
    expect(r.isError).toBe(false);
    expect(r.data.find((d: any) => d.name === "Task soon").status).toBeUndefined();
  });
});

describe("get_grades", () => {
  it("labels the course total and decodes HTML entities", async () => {
    const { call, calls } = await connect({ gradereport_user_get_grade_items: f("gradereport_user_get_grade_items") });
    const r = await call("get_grades", { courseId: 101 });
    expect(r.data).toEqual([
      { item: "Task 1", grade: "85,00", range: "0–100", percentage: "85,00 %" },
      { item: "Total do curso", grade: "85,00", range: "0–100", percentage: "85,00 %" },
    ]);
    expect(calls.at(-1)!.params).toEqual({ courseid: 101, userid: 42 });
  });
  it("returns an empty list when there are no grades", async () => {
    const { call } = await connect({ gradereport_user_get_grade_items: { usergrades: [] } });
    expect((await call("get_grades", { courseId: 1 })).data).toEqual([]);
  });
});

describe("list_forum_discussions", () => {
  it("strips HTML, decodes entities and truncates long messages", async () => {
    const { call, calls } = await connect({ mod_forum_get_forum_discussions: f("mod_forum_get_forum_discussions") });
    const r = await call("list_forum_discussions", { forumId: 11 });
    expect(r.data[0]).toEqual({
      id: 900, name: "Exam dates", author: "Prof. Turing", modified: "2026-11-01T09:00:00.000Z",
      message: "The exam is on Nov 20 & covers units 1–3.",
    });
    expect(r.data[1].message).toHaveLength(500);
    expect(calls.at(-1)!.params).toEqual({ forumid: 11, perpage: 20 });
  });
  it("returns [] for an empty forum", async () => {
    const { call } = await connect({ mod_forum_get_forum_discussions: { discussions: [] } });
    expect((await call("list_forum_discussions", { forumId: 1 })).data).toEqual([]);
  });
});

describe("get_notifications", () => {
  it("maps notifications for the current user", async () => {
    const { call, calls } = await connect({ message_popup_get_popup_notifications: f("message_popup_get_popup_notifications") });
    const r = await call("get_notifications");
    expect(r.data).toEqual([{ subject: "Overdue: Task old", read: true, created: "2026-10-02T00:00:00.000Z", url: "https://moodle.test/mod/assign/view.php?id=1" }]);
    expect(calls.at(-1)!.params).toEqual({ useridto: 42 });
  });
});

describe("error handling", () => {
  it("turns Moodle exceptions into MCP errors with the Moodle message", async () => {
    const { call } = await connect({ core_enrol_get_users_courses: f("error_accessexception") });
    const r = await call("list_courses");
    expect(r.isError).toBe(true);
    expect(r.text).toContain("Moodle: Access control exception");
  });
  it("validates input with zod", async () => {
    const { client } = await connect({});
    const r: any = await client.callTool({ name: "get_grades", arguments: { courseId: "abc" } });
    expect(r.isError).toBe(true);
  });
});
