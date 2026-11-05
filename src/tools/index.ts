import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MoodleClient } from "../moodle/client.js";
import { MoodleError } from "../moodle/client.js";
import { mergeDeadlines } from "./deadlines.js";

const iso = (ts?: number) => (ts ? new Date(ts * 1000).toISOString() : null);
const decode = (s: string) =>
  s.replace(/&ndash;/g, "–").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'");
const stripHtml = (s?: string) => (s ? decode(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim() : s);
const text = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });
const fail = (e: unknown) => ({
  isError: true,
  content: [{ type: "text" as const, text: e instanceof MoodleError ? `Moodle: ${e.message}` : String(e) }],
});
const safe = (fn: () => Promise<unknown>) => fn().then(text, fail);

export function registerTools(server: McpServer, moodle: MoodleClient): void {
  let userId: number | undefined;
  const getUserId = async () =>
    (userId ??= (await moodle.call<{ userid: number }>("core_webservice_get_site_info")).userid);

  server.registerTool(
    "get_site_info",
    { description: "Validate the token and return the Moodle site and current user info." },
    () => safe(async () => {
      const i = await moodle.call<any>("core_webservice_get_site_info");
      return { sitename: i.sitename, release: i.release, userid: i.userid, fullname: i.fullname, username: i.username };
    }),
  );

  server.registerTool(
    "list_courses",
    {
      description: "List the user's courses. By default only current ones (not ended); set includePast to see all.",
      inputSchema: { includePast: z.boolean().optional() },
    },
    ({ includePast }) => safe(async () => {
      const c = (await moodle.call<any[]>("core_enrol_get_users_courses", { userid: await getUserId() }))
        .filter((x) => includePast || !x.enddate || x.enddate > Date.now() / 1000);
      return c.map((x) => ({ id: x.id, shortname: x.shortname, fullname: x.fullname, progress: x.progress, enddate: iso(x.enddate) }));
    }),
  );

  server.registerTool(
    "get_course_contents",
    { description: "List sections and activities of a course. `instance` is the id other tools need (e.g. forumId for list_forum_discussions).", inputSchema: { courseId: z.number().int() } },
    ({ courseId }) => safe(async () => {
      const s = await moodle.call<any[]>("core_course_get_contents", { courseid: courseId });
      return s.map((x) => ({
        section: x.name,
        modules: (x.modules ?? []).map((m: any) => ({ id: m.id, instance: m.instance, name: m.name, type: m.modname, url: m.url })),
      }));
    }),
  );

  server.registerTool(
    "list_assignments",
    {
      description: "List assignments with due dates. Upcoming ones are sorted soonest first; otherwise most recent first. Filter by course; `limit` defaults to 25.",
      inputSchema: { courseId: z.number().int().optional(), upcomingOnly: z.boolean().optional(), limit: z.number().int().min(1).max(200).default(25) },
    },
    ({ courseId, upcomingOnly, limit }) => safe(async () => {
      const r = await moodle.call<any>("mod_assign_get_assignments", { courseids: courseId ? [courseId] : [] });
      const now = Date.now() / 1000;
      return r.courses.flatMap((c: any) =>
        c.assignments
          .filter((a: any) => !upcomingOnly || (a.duedate && a.duedate > now))
          .map((a: any) => ({
            id: a.id, course: c.fullname, courseId: c.id, name: a.name,
            due: iso(a.duedate), cutoff: iso(a.cutoffdate),
          })),
      ).sort((a: any, b: any) => upcomingOnly
          ? (a.due ?? "9").localeCompare(b.due ?? "9")
          : (b.due ?? "").localeCompare(a.due ?? ""))
        .slice(0, limit);
    }),
  );

  server.registerTool(
    "get_assignment_status",
    { description: "Submission and grading status of an assignment for the current user.", inputSchema: { assignmentId: z.number().int() } },
    ({ assignmentId }) => safe(async () => {
      const r = await moodle.call<any>("mod_assign_get_submission_status", { assignid: assignmentId });
      const s = r.lastattempt?.submission;
      return {
        submissionStatus: s?.status ?? "none",
        gradingStatus: r.lastattempt?.gradingstatus,
        lastModified: iso(s?.timemodified),
        graded: r.feedback?.grade?.grade ?? null,
        feedbackComments: r.feedback?.plugins?.flatMap((p: any) => p.editorfields?.map((f: any) => f.text) ?? []) ?? [],
      };
    }),
  );

  server.registerTool(
    "get_upcoming_deadlines",
    {
      description:
        "Deadlines in the next N days: calendar events plus assignments, each assignment marked as submitted or pending. Sorted soonest first.",
      inputSchema: { days: z.number().int().min(1).max(365).default(14), onlyPending: z.boolean().optional() },
    },
    ({ days, onlyPending }) => safe(async () => {
      const from = Math.floor(Date.now() / 1000);
      const to = from + days * 86400;
      const [ev, as] = await Promise.all([
        moodle.call<any>("core_calendar_get_action_events_by_timesort", { timesortfrom: from, timesortto: to, limitnum: 50 }),
        moodle.call<any>("mod_assign_get_assignments", { courseids: [] }),
      ]);
      const items = mergeDeadlines(ev.events ?? [], as.courses ?? [], from, to);
      const result = await Promise.all(items.map(async (d) => {
        let status: string | undefined;
        if (d.assignmentId) {
          try {
            const r = await moodle.call<any>("mod_assign_get_submission_status", { assignid: d.assignmentId });
            status = r.lastattempt?.submission?.status === "submitted" ? "submitted" : "pending";
          } catch { status = undefined; }
        }
        return { name: d.name, course: d.course, due: iso(d.due), type: d.type, status, url: d.url };
      }));
      return onlyPending ? result.filter((d) => d.status !== "submitted") : result;
    }),
  );

  server.registerTool(
    "get_grades",
    { description: "Grade items for a course.", inputSchema: { courseId: z.number().int() } },
    ({ courseId }) => safe(async () => {
      const r = await moodle.call<any>("gradereport_user_get_grade_items", { courseid: courseId, userid: await getUserId() });
      return r.usergrades?.[0]?.gradeitems?.map((g: any) => ({
        item: g.itemname ?? "Total do curso", grade: g.gradeformatted, range: decode(g.rangeformatted ?? ""), percentage: g.percentageformatted,
      })) ?? [];
    }),
  );

  server.registerTool(
    "list_forum_discussions",
    { description: "Recent discussions of a forum. forumId is the `instance` of a forum module from get_course_contents (not its `id`).", inputSchema: { forumId: z.number().int() } },
    ({ forumId }) => safe(async () => {
      const r = await moodle.call<any>("mod_forum_get_forum_discussions", { forumid: forumId, perpage: 20 });
      return r.discussions.map((d: any) => ({ id: d.discussion, name: d.name, author: d.userfullname, modified: iso(d.timemodified), message: stripHtml(d.message)?.slice(0, 500) }));
    }),
  );

  server.registerTool(
    "get_notifications",
    { description: "Unread/recent Moodle notifications for the user." },
    () => safe(async () => {
      const r = await moodle.call<any>("message_popup_get_popup_notifications", { useridto: await getUserId() });
      return r.notifications.map((n: any) => ({ subject: n.subject, read: n.read, created: iso(n.timecreated), url: n.contexturl }));
    }),
  );
}
