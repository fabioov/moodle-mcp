import { describe, it, expect } from "vitest";
import { mergeDeadlines } from "../src/tools/deadlines.js";

const from = 1000, to = 2000;
const ev = (name: string, t: number) => ({ name: `${name} está marcado(a) para esta data`, timesort: t, modulename: "assign", course: { fullname: "C1" }, url: "u" });
const course = (...assignments: any[]) => ({ id: 1, fullname: "C1", assignments });

describe("mergeDeadlines", () => {
  it("adds assignments the calendar hides (already submitted)", () => {
    const r = mergeDeadlines([ev("A", 1500)], [course({ id: 7, name: "B", duedate: 1200 })], from, to);
    expect(r.map((d) => d.name)).toEqual(["B", "A"]);
    expect(r[0].assignmentId).toBe(7);
  });
  it("de-duplicates by name and due, keeping calendar url and adding assignmentId", () => {
    const r = mergeDeadlines([ev("A", 1500)], [course({ id: 7, name: "A", duedate: 1500 })], from, to);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ name: "A", url: "u", assignmentId: 7 });
  });
  it("ignores assignments outside the window or without due date", () => {
    const r = mergeDeadlines([], [course({ id: 1, name: "x", duedate: 500 }, { id: 2, name: "y", duedate: 3000 }, { id: 3, name: "z", duedate: 0 })], from, to);
    expect(r).toEqual([]);
  });
});
