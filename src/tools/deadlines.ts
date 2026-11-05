export interface Deadline {
  name: string;
  course?: string;
  due: number; // unix seconds
  url?: string;
  type: string;
  assignmentId?: number;
}

const SUFFIX = / está marcado\(a\) para esta data$/;

/**
 * Merge calendar action events with assignments due in the window.
 * The calendar hides already-submitted assignments, so assignments are added
 * from mod_assign_get_assignments and de-duplicated by (name, due).
 */
export function mergeDeadlines(events: any[], assignCourses: any[], from: number, to: number): Deadline[] {
  const out = new Map<string, Deadline>();
  const key = (name: string, due: number) => `${name}|${due}`;

  for (const e of events) {
    const name = String(e.name).replace(SUFFIX, "");
    out.set(key(name, e.timesort), {
      name, course: e.course?.fullname, due: e.timesort, url: e.url, type: e.modulename ?? "event",
    });
  }
  for (const c of assignCourses) {
    for (const a of c.assignments ?? []) {
      if (!a.duedate || a.duedate < from || a.duedate > to) continue;
      const k = key(a.name, a.duedate);
      const prev = out.get(k);
      out.set(k, { ...(prev ?? { name: a.name, course: c.fullname, due: a.duedate, type: "assign" }), assignmentId: a.id });
    }
  }
  return [...out.values()].sort((a, b) => a.due - b.due);
}
