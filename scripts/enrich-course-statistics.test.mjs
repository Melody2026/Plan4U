import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  aggregateCourse,
  choosePeriod,
  courseCode,
  gradedCount,
  uniqueSections,
  weightedAverage,
} from "./enrich-course-statistics.mjs";

const section = (overrides = {}) => ({
  campus: "UBCV",
  subject: "CPSC",
  course: "210",
  detail: "",
  year: "2024",
  session: "W",
  section: "101",
  average: 80,
  reported: 100,
  educators: "Instructor A",
  ...overrides,
});
test("student weighting and OVERALL records never double-count sections", () => {
  const data = [
    section(),
    section({ section: "102", average: 60, reported: 300 }),
    section({ section: "OVERALL", average: 65, reported: 400 }),
    section({ year: "2025", session: "S", average: 90, reported: 100 }),
  ];
  assert.deepEqual(aggregateCourse(data), { average: 70, count: 500 });
  assert.deepEqual(aggregateCourse(data.filter((r) => r.section !== "OVERALL")), {
    average: 70,
    count: 500,
  });
});
test("privacy-suppressed bins are not substituted for reported counts", () => {
  assert.equal(gradedCount(section({ grades: { "90-100%": null } })), 100);
  assert.deepEqual(weightedAverage([section({ reported: null }), section({ average: null })]), {
    average: null,
    count: 0,
  });
});
test("suffix identity and duplicate educator rows are preserved without double counting", () => {
  assert.equal(courseCode(section({ course: "436", detail: "N" })), "CPSC 436N");
  const rows = uniqueSections([section(), section({ educators: "Instructor B" })]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].educators, "Instructor A;Instructor B");
  assert.throws(
    () => uniqueSections([section(), section({ reported: 300 })]),
    /Conflicting duplicate/,
  );
});
test("period needs three fully available, completed academic years", () => {
  const sessions = ["2022W", "2023S", "2023W", "2024S", "2024W", "2025S", "2025W"];
  assert.deepEqual(choosePeriod(sessions, new Date("2026-11-17")).sessions, sessions.slice(0, 6));
  assert.throws(() => choosePeriod(sessions, new Date("2024-01-01")), /No three/);
});
test("saved snapshot contains valid grades and historical instructor records", async () => {
  const data = JSON.parse(
    await readFile(new URL("../src/data/course-statistics.json", import.meta.url)),
  );
  const report = JSON.parse(
    await readFile(new URL("../src/data/course-statistics-report.json", import.meta.url)),
  );
  assert.equal(Object.keys(data).length, report.requested);
  assert.equal(
    Object.values(data).filter((c) => c.averageGrade !== null).length,
    report.withAverages,
  );
  for (const [code, c] of Object.entries(data)) {
    assert.ok(c.averageGrade === null || (c.averageGrade >= 0 && c.averageGrade <= 100), code);
    assert.ok(
      c.averageGrade === null
        ? c.gradeSampleSize === null
        : Number.isInteger(c.gradeSampleSize) && c.gradeSampleSize > 0,
      code,
    );
    assert.ok(
      c.statisticsSources.every((s) => s.startsWith("https://ubcgrades.com/api/v3/grades/UBCV/")),
      code,
    );
    for (const p of c.professors) {
      assert.ok(typeof p.name === "string" && p.name.trim());
      assert.ok(p.averageGrade === null || (p.averageGrade >= 0 && p.averageGrade <= 100));
      assert.ok(p.teachingSessions.every((s) => report.period.sessions.includes(s)));
      assert.ok(p.teachingSessions.includes(p.lastTaught));
    }
  }
  assert.equal(data["CPSC 210"].averageGrade !== null, true);
  for (const code of report.skippedReferenceOnly) assert.equal(data[code], undefined);
});
