import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const base = "https://ubcgrades.com/api/v3/";
export const courseCode = (row) =>
  `${row.subject} ${String(row.course).trim()}${String(row.detail ?? "").trim()}`;
export function gradedCount(row) {
  // v3 reported excludes withdrawals/audits. Do not sum privacy-suppressed bins.
  return Number.isInteger(row.reported) && row.reported > 0 ? row.reported : null;
}
const validGrade = (row) =>
  typeof row.average === "number" &&
  Number.isFinite(row.average) &&
  row.average >= 0 &&
  row.average <= 100 &&
  gradedCount(row) !== null;
export function uniqueSections(rows) {
  const bySection = new Map();
  for (const row of rows.filter((r) => r.section !== "OVERALL")) {
    const key = `${row.year}${row.session}/${courseCode(row)}/${row.section}`;
    const old = bySection.get(key);
    if (old && (old.average !== row.average || old.reported !== row.reported))
      throw new Error(`Conflicting duplicate section: ${key}`);
    if (old)
      old.educators = [
        ...new Set(`${old.educators ?? ""};${row.educators ?? ""}`.split(";").filter(Boolean)),
      ].join(";");
    else bySection.set(key, { ...row });
  }
  return [...bySection.values()];
}
export function weightedAverage(rows) {
  const valid = rows.filter(validGrade);
  const count = valid.reduce((n, row) => n + gradedCount(row), 0);
  return {
    average: count
      ? Math.round(
          (valid.reduce((n, row) => n + row.average * gradedCount(row), 0) / count) * 100,
        ) / 100
      : null,
    count,
  };
}
export function aggregateCourse(rows) {
  const bySession = Map.groupBy(rows, (r) => `${r.year}${r.session}`);
  const selected = [];
  for (const sessionRows of bySession.values()) {
    const totals = sessionRows.filter((r) => r.section === "OVERALL" && validGrade(r));
    if (totals.length > 1) throw new Error("Multiple OVERALL records for one exact course/session");
    selected.push(...(totals.length ? totals : uniqueSections(sessionRows)));
  }
  return weightedAverage(selected);
}
export function choosePeriod(sessions, today = new Date()) {
  // Academic years run September through August: Y W followed by Y+1 S.
  const starts = sessions
    .filter((s) => /^\d{4}W$/.test(s))
    .map((s) => Number(s.slice(0, 4)))
    .filter((y) => sessions.includes(`${y + 1}S`) && new Date(`${y + 1}-09-01T00:00:00Z`) <= today)
    .sort((a, b) => b - a);
  const latest = starts[0];
  if (!latest || ![latest - 2, latest - 1, latest].every((y) => starts.includes(y)))
    throw new Error("No three consecutive completed academic years with both sessions available");
  const years = [latest - 2, latest - 1, latest];
  return {
    sessions: years.flatMap((y) => [`${y}W`, `${y + 1}S`]),
    label: `${years[0]}–${latest + 1} academic years (September–August)`,
  };
}
async function get(path) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(base + path, { signal: AbortSignal.timeout(45000) });
      if (response.status === 404) return [];
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${path}`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error(`Expected array: ${path}`);
      return data;
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
}
async function main() {
  const text = await readFile(new URL("src/data/courses.ts", root), "utf8");
  const ast = ts.createSourceFile("courses.ts", text, ts.ScriptTarget.Latest, true);
  let initializer;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "catalog")
      initializer = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  if (!initializer) throw new Error("Catalog literal not found");
  const catalog = runInNewContext(`(${initializer})`, {}, { timeout: 1000 });
  const eligible = catalog.filter((c) => !c.referenceOnly);
  const period = choosePeriod(await get("yearsessions/UBCV"));
  const subjects = [...new Set(eligible.map((c) => c.code.split(" ")[0]))].sort((a, b) =>
    a === "CPSC" ? -1 : b === "CPSC" ? 1 : a.localeCompare(b),
  );
  const updatedAt = new Date().toISOString();
  const output = {},
    errors = [],
    warnings = [];
  for (const subject of subjects) {
    console.log(`Fetching ${subject}: ${period.sessions.join(", ")}`);
    const rows = [];
    // Two requests at a time; fetch all subject sections once, then exact-match suffixes.
    for (let i = 0; i < period.sessions.length; i += 2) {
      const batch = await Promise.all(
        period.sessions.slice(i, i + 2).map(async (session) => {
          try {
            const data = await get(`grades/UBCV/${session}/${subject}`);
            for (const r of data) {
              if (
                r.campus !== "UBCV" ||
                r.subject !== subject ||
                `${r.year}${r.session}` !== session ||
                typeof r.course !== "string" ||
                typeof r.section !== "string"
              )
                throw new Error(`Invalid row identity: ${subject}/${session}`);
              if (
                r.average !== null &&
                (typeof r.average !== "number" || r.average < 0 || r.average > 100)
              )
                throw new Error(`Invalid grade: ${subject}/${session}`);
              if (r.reported !== null && (!Number.isInteger(r.reported) || r.reported < 0))
                throw new Error(`Invalid reported count: ${subject}/${session}`);
            }
            return data;
          } catch (error) {
            errors.push(String(error));
            return [];
          }
        }),
      );
      rows.push(...batch.flat());
    }
    for (const course of eligible.filter((c) => c.code.startsWith(`${subject} `))) {
      const own = rows.filter((r) => courseCode(r) === course.code);
      const aggregate = aggregateCourse(own);
      const sections = uniqueSections(own);
      const people = new Map();
      for (const section of sections) {
        // v3 >=2022S educator records exclude TAs. No title/rank is inferred.
        for (const name of new Set(
          (section.educators ?? "")
            .split(";")
            .map((s) => s.trim())
            .filter((s) => s && !/^(unknown|tba|staff|n\/a)$/i.test(s)),
        )) {
          if (!people.has(name)) people.set(name, []);
          people.get(name).push(section);
        }
      }
      const professors = [...people]
        .map(([name, taught]) => {
          const sessions = [...new Set(taught.map((s) => `${s.year}${s.session}`))].sort(
            (a, b) => Number(a.slice(0, 4)) - Number(b.slice(0, 4)) || (a.endsWith("W") ? 1 : -1),
          );
          return {
            name,
            rating: null,
            difficulty: null,
            numberOfRatings: null,
            rateMyProfessorUrl: `https://www.ratemyprofessors.com/search/professors?q=${encodeURIComponent(name)}`,
            lastTaught: sessions.at(-1),
            averageGrade: weightedAverage(taught).average,
            teachingSessions: sessions,
          };
        })
        .sort((a, b) => b.lastTaught.localeCompare(a.lastTaught) || a.name.localeCompare(b.name));
      const number = course.code.split(" ")[1];
      output[course.code] = {
        averageGrade: aggregate.average,
        averageGradeSource: `https://ubcgrades.com/api/v3/course-statistics/UBCV/${subject}/${number}`,
        averageGradePeriod: period.label,
        gradeSampleSize: aggregate.count || null,
        professors,
        statisticsUpdatedAt: updatedAt,
        statisticsSources: period.sessions.map(
          (session) => `${base}grades/UBCV/${session}/${subject}/${number}`,
        ),
        availableSessions: [...new Set(own.map((r) => `${r.year}${r.session}`))].sort(),
      };
      if (own.some((r) => r.average !== null && !validGrade(r)))
        warnings.push(`${course.code}: some records lack a usable graded count/average`);
    }
  }
  if (errors.length)
    throw new Error(
      `Fetch/validation failed; existing snapshot was not replaced:\n${errors.join("\n")}`,
    );
  const report = {
    updatedAt,
    period,
    catalogCount: catalog.length,
    requested: eligible.length,
    enriched: Object.values(output).filter((c) => c.averageGrade !== null || c.professors.length)
      .length,
    withAverages: Object.values(output).filter((c) => c.averageGrade !== null).length,
    withInstructors: Object.values(output).filter((c) => c.professors.length).length,
    missingAverages: Object.keys(output).filter((c) => output[c].averageGrade === null),
    missingInstructors: Object.keys(output).filter((c) => !output[c].professors.length),
    skippedReferenceOnly: catalog.filter((c) => c.referenceOnly).map((c) => c.code),
    warnings,
  };
  await mkdir(new URL("src/data/", root), { recursive: true });
  await writeFile(
    new URL("src/data/course-statistics.json", root),
    JSON.stringify(output, null, 2) + "\n",
  );
  await writeFile(
    new URL("src/data/course-statistics-report.json", root),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
}
if (process.argv[1] === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
