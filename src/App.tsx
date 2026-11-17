import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { COURSE_LIST, COURSES, type Course } from "./data/courses";

const REQUIRED_COURSES = new Set([
  "CPSC 210",
  "CPSC 213",
  "CPSC 221",
  "CPSC 310",
  "CPSC 313",
  "CPSC 320",
]);

const RequiredStar = () => (
  <span
    title="Required for graduation"
    aria-label="Required for graduation"
    style={{ color: "#e9bd50", fontSize: "0.7em", lineHeight: 1, flexShrink: 0 }}
  >
    ★
  </span>
);

const CourseCode = ({ code }: { code: string }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>
    {code}
    {REQUIRED_COURSES.has(code) && <RequiredStar />}
  </span>
);

const gradeLabel = (value: number | null | undefined) =>
  value == null ? "Not available" : `${value.toFixed(1)}%`;
const ratingLabel = (value: number | null | undefined) =>
  value == null ? "Not available" : `${value.toFixed(1)} / 5`;

function HistoricalStatistics({ course }: { course: Course }) {
  const professors = course.professors ?? [];
  return (
    <section
      className="historical-statistics"
      aria-label={`Historical statistics for ${course.code}`}
    >
      <div className="historical-heading">
        Historical average <strong>{gradeLabel(course.averageGrade)}</strong>
      </div>
      <p>
        {course.averageGradePeriod ?? "Period: Not available"}
        {course.gradeSampleSize != null &&
          ` · ${course.gradeSampleSize.toLocaleString()} graded registrations`}
      </p>
      <p>
        Historical instructors:{" "}
        {professors.length
          ? professors
              .slice(0, 2)
              .map((p) => p.name)
              .join(", ") + (professors.length > 2 ? ` +${professors.length - 2} more` : "")
          : "Not available"}
      </p>
      <details>
        <summary>Instructors &amp; sources</summary>
        <p>Available sessions: {course.availableSessions?.join(", ") || "Not available"}</p>
        <p>
          Past teaching records, excluding teaching assistants; future instructors may differ. Names
          do not imply academic rank. Instructor averages describe their sections, including
          co-taught sections, within the same period.
        </p>
        {professors.map((professor) => (
          <div className="historical-professor" key={professor.name}>
            <strong>{professor.name}</strong>
            <p>Last taught in this period: {professor.lastTaught ?? "Not available"}</p>
            <p>Sessions: {professor.teachingSessions?.join(", ") || "Not available"}</p>
            <p>Section average: {gradeLabel(professor.averageGrade)}</p>
            <p>
              Rating: {ratingLabel(professor.rating)} · Difficulty:{" "}
              {ratingLabel(professor.difficulty)} · Reviews:{" "}
              {professor.numberOfRatings ?? "Not available"}
            </p>
            <a href={professor.rateMyProfessorUrl} target="_blank" rel="noreferrer">
              Find on Rate My Professors ↗
            </a>
          </div>
        ))}
        {!professors.length && <p>Instructor information and ratings: Not available</p>}
        <p>
          Numerical ratings are not imported without an authorized source. Search links are not
          verified profiles.
        </p>
        {course.averageGradeSource && (
          <a href={course.averageGradeSource} target="_blank" rel="noreferrer">
            UBCGrades course profile (all-time statistics) ↗
          </a>
        )}
        <div className="historical-sources">
          {course.statisticsSources?.map((source) => (
            <a key={source} href={source} target="_blank" rel="noreferrer">
              {source.split("/").at(-3)} session data ↗
            </a>
          ))}
        </div>
        <p>
          Average weighted by reported graded registrations, counting each session once. Missing
          sections may limit coverage; no values are inferred.
        </p>
        <p>Updated: {course.statisticsUpdatedAt?.slice(0, 10) ?? "Not available"}</p>
      </details>
    </section>
  );
}

const Icon = ({
  name,
  size = 18,
}: {
  name: "search" | "plus" | "minus" | "x" | "back" | "reset" | "check" | "chevron" | "star";
  size?: number;
}) => {
  const paths = {
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    minus: <path d="M5 12h14" />,
    x: (
      <>
        <path d="m6 6 12 12M18 6 6 18" />
      </>
    ),
    back: (
      <>
        <path d="m15 18-6-6 6-6" />
      </>
    ),
    reset: (
      <>
        <path d="M20 7v5h-5" />
        <path d="M19 12a7 7 0 1 0-2 5" />
      </>
    ),
    check: <path d="m6 12 4 4 8-9" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    star: <path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
};

const getPrerequisites = (course: Course) =>
  [...new Set([...course.prerequisitePaths.flat(), ...course.corequisiteGroups.flat()])].filter(
    (code) => Boolean(COURSES[code]),
  );

const getDependents = (code: string) =>
  COURSE_LIST.filter((course) => getPrerequisites(course).includes(code)).map(
    (course) => course.code,
  );

// Keep eligibility separate from graph geometry and from planned courses.
const highSchoolPattern =
  /(?:principles of mathematics|pre[- ]calculus|high school(?: calculus| biology)?|AP Calculus(?: AB| BC)?|(?:CALC|ENGL|CHEM|PHYS|BIOL|MATH)\s+(?:11|12)\b)/i;

const evaluatePrerequisites = (course: Course, taken: ReadonlySet<string>) => {
  const hasHighSchool = highSchoolPattern.test(course.prerequisiteText);
  const text = course.prerequisiteText
    .replace(/This course is not eligible[\s\S]*/i, "")
    .replace(
      /(?:Principles of Mathematics|Pre[- ]calculus|CALC|ENGL|CHEM|PHYS|BIOL|MATH)\s+(?:11|12)\b|AP Calculus(?: AB| BC)?|High School Biology/gi,
      " HIGHSCHOOL ",
    )
    .replace(/High school calculus is strongly recommended\.?/gi, "")
    .replace(/\b([A-Z]{2,5})_V\s+(\d{3})/g, "$1 $2")
    // Okanagan courses remain distinct from Vancouver equivalents.
    .replace(/\b([A-Z]{2,5})_O\s+(\d{3})/g, "$1_O $2");
  const universityGradeRule =
    /(?:score of|minimum grade|advanced credit|as a co-?requisite|credit exclusion|standing|permission|credits (?:of|from|beyond))/i.test(
      text.replace(/[^.]*HIGHSCHOOL[^.]*(?:\.|$)/g, (part) =>
        /[A-Z]{2,5}(?:_O)?\s+\d{3}/.test(part) ? part : "",
      ),
    );
  const review =
    (course.manualRequirement && !(hasHighSchool && !/[A-Z]{2,5}(?:_O)?\s+\d{3}/.test(text))) ||
    universityGradeRule;
  const evaluateText = (value: string): boolean => {
    // Labelled alternative branches take precedence over conjunctions within each branch.
    const alternatives = value.split(/\bor\s+\(?[a-d]\)/i);
    if (alternatives.length > 1) return alternatives.some(evaluateText);
    const conjunctions = value
      .split(/\band\b|;/i)
      .filter((part) => /HIGHSCHOOL|[A-Z]{2,5}(?:_O)?\s+\d{3}/.test(part));
    if (conjunctions.length > 1) return conjunctions.every(evaluateText);
    const codes = value.match(/[A-Z]{2,5}(?:_O)?\s+\d{3}/g) || [];
    const options = [
      ...codes.map((code) => taken.has(code)),
      ...(value.includes("HIGHSCHOOL") ? [true] : []),
    ];
    if (!options.length) return !value.trim() || !course.prerequisiteText;
    return /one of|either|\bor\b/i.test(value) ? options.some(Boolean) : options.every(Boolean);
  };
  const met = course.prerequisitePaths.length
    ? course.prerequisitePaths.some((path) =>
        path.every((code) => taken.has(code) || highSchoolPattern.test(code)),
      )
    : !course.prerequisiteText || evaluateText(text);
  return { met: met && !review, review, hasHighSchool };
};

const WORLD = { width: 4800, height: 3600 };
const DEFAULT_ZOOM = 0.9;
const INITIAL_COMPLETED = ["CPSC 110", "MATH 100", "ENGL 110"];
const INITIAL_PLANNED = ["CPSC 210", "MATH 101"];
const INITIAL_NEXT_STEPS = new Set(
  COURSE_LIST.filter(
    (course) =>
      !INITIAL_COMPLETED.includes(course.code) &&
      !INITIAL_PLANNED.includes(course.code) &&
      evaluatePrerequisites(course, new Set(INITIAL_COMPLETED)).met,
  ).map((course) => course.code),
);
const NETWORK_EDGES = COURSE_LIST.flatMap((course) =>
  getPrerequisites(course)
    .filter((code) => code !== course.code)
    .map((code) => ({ from: code, to: course.code })),
);

// Use initial eligibility once to place next steps; subsequent status changes never move stars.
const COURSE_POSITIONS = (() => {
  const hash = (code: string) => {
    let value = 2166136261;
    for (const char of code) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
    return (value >>> 0) / 4294967296;
  };
  const codes = COURSE_LIST.map((course) => course.code).sort();
  const initiallyTaken = new Set(INITIAL_COMPLETED);
  const nextSteps = INITIAL_NEXT_STEPS;
  const initialNeighbors = new Set([
    ...getPrerequisites(COURSES["CPSC 110"]),
    ...getDependents("CPSC 110"),
  ]);
  const nodes = Object.fromEntries(
    codes.map((code) => [
      code,
      {
        x: 650 + COURSES[code].level * 5 + hash(code) * 700,
        y: 450 + hash(code + "branch") * 2600,
      },
    ]),
  );
  for (let step = 0; step < 650; step++) {
    const force = Object.fromEntries(codes.map((code) => [code, { x: 0, y: 0 }]));
    for (let i = 0; i < codes.length; i++)
      for (let j = i + 1; j < codes.length; j++) {
        const a = codes[i],
          b = codes[j];
        const dx = nodes[b].x - nodes[a].x || 0.01,
          dy = nodes[b].y - nodes[a].y || 0.01;
        const length = Math.hypot(dx, dy);
        const push = Math.max(0, 180 - length) * 0.45 + 1800 / (length * length);
        force[a].x -= (dx / length) * push;
        force[a].y -= (dy / length) * push;
        force[b].x += (dx / length) * push;
        force[b].y += (dy / length) * push;
      }
    for (const { from, to } of NETWORK_EDGES) {
      const dx = nodes[to].x - nodes[from].x,
        dy = nodes[to].y - nodes[from].y;
      const length = Math.hypot(dx, dy) || 1;
      const pull = (length - 190 - hash(from + to) * 70) * 0.035;
      force[from].x += (dx / length) * pull;
      force[from].y += (dy / length) * pull;
      force[to].x -= (dx / length) * pull;
      force[to].y -= (dy / length) * pull;
    }
    const anchor = nodes["CPSC 110"];
    for (const code of codes) {
      if (code === "CPSC 110") continue;
      const dx = nodes[code].x - anchor.x,
        dy = nodes[code].y - anchor.y;
      const length = Math.hypot(dx, dy) || 1;
      const preferred = 260 + hash(code + "next-step") * 320;
      // Soft attraction preserves irregular branches instead of imposing a ring.
      const pull = nextSteps.has(code)
        ? Math.max(0, length - preferred) * 0.025
        : !initialNeighbors.has(code) && !initiallyTaken.has(code)
          ? Math.min(0, length - 650) * 0.015
          : 0;
      force[code].x -= (dx / length) * pull;
      force[code].y -= (dy / length) * pull;
    }
    for (const code of codes) {
      nodes[code].x += Math.max(-12, Math.min(12, force[code].x));
      nodes[code].y += Math.max(-12, Math.min(12, force[code].y));
    }
  }
  // A final separation pass protects the largest node and label footprints.
  for (let pass = 0; pass < 200; pass++) {
    let overlaps = false;
    for (let i = 0; i < codes.length; i++)
      for (let j = i + 1; j < codes.length; j++) {
        const a = nodes[codes[i]],
          b = nodes[codes[j]];
        const dx = b.x - a.x || 0.01,
          dy = b.y - a.y || 0.01;
        const length = Math.hypot(dx, dy);
        if (length >= 155) continue;
        overlaps = true;
        const shift = (156 - length) / 2;
        a.x -= (dx / length) * shift;
        a.y -= (dy / length) * shift;
        b.x += (dx / length) * shift;
        b.y += (dy / length) * shift;
      }
    if (!overlaps) break;
  }
  return nodes;
})();

type MapPoint = { x: number; y: number };
type MapArea = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};
const fitNeighborhood = (
  code: string,
  previous: Record<string, MapPoint>,
  area: MapArea,
  requestedZoom: number,
) => {
  const direct = [...new Set([...getPrerequisites(COURSES[code]), ...getDependents(code)])].filter(
    (item) => item !== code,
  );
  const anchor = previous[code];
  const initial = COURSE_POSITIONS["CPSC 110"];
  let fitZoom = Math.min(requestedZoom, DEFAULT_ZOOM);
  let placed: Record<string, MapPoint> = {};
  // Prefer the larger view, reducing it in small steps only when direct nodes
  // cannot fit with their existing label clearance inside the unobstructed area.
  for (let attempt = 0; attempt < 80; attempt++) {
    const halfWidth = (area.right - area.left) / fitZoom / 2;
    const halfHeight = (area.bottom - area.top) / fitZoom / 2;
    const fits = (point: MapPoint, radius: number) =>
      Math.abs(point.x - anchor.x) + radius <= halfWidth &&
      Math.abs(point.y - anchor.y) + radius <= halfHeight;
    placed = { [code]: anchor };
    const clear = (point: MapPoint, radius: number) =>
      Object.entries(placed).every(
        ([other, position]) =>
          Math.hypot(position.x - point.x, position.y - point.y) >=
          radius + (other === code ? 72 : 57) + 16,
      );
    const candidates: MapPoint[] = [];
    for (let row = -Math.ceil(halfHeight / 145); row <= Math.ceil(halfHeight / 145); row++) {
      for (let col = -Math.ceil(halfWidth / 150); col <= Math.ceil(halfWidth / 150); col++) {
        const seed = Math.sin(row * 73 + col * 39);
        const point = {
          x: anchor.x + col * 150 + (Math.abs(row) % 2) * 70 + seed * 7,
          y: anchor.y + row * 145 + Math.cos(col * 41 + row) * 8,
        };
        if (fits(point, 57)) candidates.push(point);
      }
    }
    // Retain every currently valid direct star before relocating obstructed ones.
    for (const neighbor of direct) {
      if (fits(previous[neighbor], 57) && clear(previous[neighbor], 57))
        placed[neighbor] = previous[neighbor];
    }
    for (const neighbor of direct) {
      if (placed[neighbor]) continue;
      const old = previous[neighbor];
      const originalAngle = Math.atan2(old.y - anchor.y, old.x - anchor.x);
      const score = (point: MapPoint) => {
        const angle = Math.atan2(point.y - anchor.y, point.x - anchor.x);
        const difference = Math.atan2(
          Math.sin(angle - originalAngle),
          Math.cos(angle - originalAngle),
        );
        return Math.hypot(point.x - old.x, point.y - old.y) + Math.abs(difference) * 160;
      };
      const available = candidates
        .filter((point) => clear(point, 57))
        .sort((a, b) => score(a) - score(b));
      if (available[0]) placed[neighbor] = available[0];
    }
    if (fits(anchor, 72) && direct.every((neighbor) => placed[neighbor])) break;
    fitZoom *= 0.95;
  }
  return {
    positions: { ...previous, ...placed },
    zoom: fitZoom,
    pan: {
      x: initial.x - anchor.x + ((area.left + area.right) / 2 - area.width / 2) / fitZoom,
      y: initial.y - anchor.y + ((area.top + area.bottom) / 2 - area.height / 2) / fitZoom,
    },
  };
};

const TOPIC_PATTERNS: [string, RegExp][] = [
  ["AI & machine learning", /machine learning|artificial intelligence|neural|deep learning/i],
  ["Security", /security|cryptograph|privacy/i],
  ["Graphics", /graphics|rendering|animation|visual computing/i],
  ["Data & databases", /database|data analysis|data science|data mining/i],
  ["Software engineering", /software|testing|debugging/i],
  ["Algorithms", /algorithm|complexity|data structures/i],
  ["Systems & networks", /operating system|network|distributed|computer architecture/i],
  ["Human-computer interaction", /human.computer|user interface|interaction design/i],
  ["Mathematics", /calculus|algebra|mathematical|probability|statistics/i],
];
const topicsFor = (course: Course) =>
  TOPIC_PATTERNS.filter(([, pattern]) => pattern.test(`${course.title} ${course.description}`)).map(
    ([label]) => label,
  );
const searchText = (course: Course) =>
  `${course.code} ${course.title} ${course.description} ${topicsFor(course).join(" ")}`.toLowerCase();
const interestTerms = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
const requirementLabels = (course: Course) => [
  "Overall credits",
  course.category === "Major" ? "Major credits" : `${course.category} credits`,
  ...(course.level >= 300 ? ["Upper-level credits"] : []),
  ...(REQUIRED_COURSES.has(course.code) ? ["Core requirement"] : []),
];
const SEARCH_FILTERS = [
  "All Courses",
  "CPSC 100-level",
  "CPSC 200-level",
  "CPSC 300-level",
  "CPSC 400-level",
  "Core Requirements",
  "Major Requirements",
  "Science Requirements",
  "Electives",
  "Upper-level",
];

function SearchCompare({
  planned,
  completed,
  addPlan,
  removePlan,
  eligibility,
  status,
}: {
  planned: string[];
  completed: string[];
  addPlan: (code: string) => void;
  removePlan: (code: string) => void;
  eligibility: Record<string, ReturnType<typeof evaluatePrerequisites>>;
  status: (code: string) => string;
}) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<string[]>([]);
  const [sort, setSort] = useState("relevance");
  const [choices, setChoices] = useState<[string, string]>(["", ""]);
  const [comparison, setComparison] = useState<[string, string] | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const terms = interestTerms(search);
  const matchesFilter = (course: Course, filter: string) => {
    if (filter.startsWith("CPSC "))
      return course.code.startsWith("CPSC ") && course.level === Number(filter.slice(5, 8));
    if (filter === "Core Requirements") return REQUIRED_COURSES.has(course.code);
    if (filter === "Major Requirements") return course.category === "Major";
    if (filter === "Science Requirements") return course.category === "Science";
    if (filter === "Electives") return course.category === "Elective";
    return course.level >= 300;
  };
  const results = COURSE_LIST.filter(
    (course) =>
      terms.every((term) => searchText(course).includes(term)) &&
      (!filters.length || filters.some((filter) => matchesFilter(course, filter))),
  ).sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title);
    if (sort === "credits") return a.credits - b.credits || a.code.localeCompare(b.code);
    if (sort === "relevance" && search.trim()) {
      const score = (c: Course) =>
        terms.reduce(
          (n, term) =>
            n +
            (c.code.toLowerCase().includes(term)
              ? 4
              : c.title.toLowerCase().includes(term)
                ? 2
                : 1),
          0,
        );
      return score(b) - score(a) || a.code.localeCompare(b.code);
    }
    return a.code.localeCompare(b.code, undefined, { numeric: true });
  });
  useEffect(() => {
    if (comparison) dialog.current?.showModal();
    else dialog.current?.close();
  }, [comparison]);
  const resolveChoice = (value: string) =>
    COURSE_LIST.find((c) => c.code.toLowerCase() === value.trim().toLowerCase());
  const chosen = choices.map(resolveChoice);
  const eligibilityText = (code: string) => {
    const c = COURSES[code];
    const rule = eligibility[code];
    return completed.includes(code)
      ? "Completed"
      : c.referenceOnly
        ? "Reference only — no current Vancouver listing"
        : rule.review
          ? "Review additional requirements"
          : rule.met
            ? "Prerequisites satisfied"
            : "Prerequisites incomplete";
  };
  const planButton = (code: string) => (
    <button
      className={`sc-plan ${status(code)}`}
      disabled={completed.includes(code) || planned.includes(code) || COURSES[code].referenceOnly}
      onClick={() => addPlan(code)}
    >
      {completed.includes(code)
        ? "Completed"
        : planned.includes(code)
          ? "Planned"
          : COURSES[code].referenceOnly
            ? "Reference only"
            : "+ Add to Plan"}
    </button>
  );
  return (
    <div className="search-compare">
      <section className="sc-panel sc-search" aria-label="Search courses">
        <div>
          <span className="eyebrow">Course catalog</span>
          <h1>Search Courses</h1>
          <p>Find courses by keyword, interest, or degree requirement.</p>
        </div>
        <label className="sc-search-input">
          <Icon name="search" />
          <input
            aria-label="Search all courses"
            placeholder="Search codes, topics or interests — machine learning, security, graphics…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="sc-filters" aria-label="Degree requirement filters">
          {SEARCH_FILTERS.map((filter) => (
            <button
              key={filter}
              aria-pressed={filter === "All Courses" ? !filters.length : filters.includes(filter)}
              onClick={() =>
                setFilters((old) =>
                  filter === "All Courses"
                    ? []
                    : old.includes(filter)
                      ? old.filter((f) => f !== filter)
                      : [...old, filter],
                )
              }
            >
              {filter}
            </button>
          ))}
        </div>
        <div className="sc-results-bar">
          <span role="status">{results.length} courses found</span>
          <label>
            Sort by{" "}
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="relevance">Relevance</option>
              <option value="code">Course code</option>
              <option value="title">Title</option>
              <option value="credits">Credits</option>
            </select>
          </label>
        </div>
        <div className="sc-results">
          {results.map((course) => (
            <article className="sc-course" key={course.code}>
              <div className="sc-course-heading">
                <h2>
                  <CourseCode code={course.code} /> <span>{course.title}</span>
                </h2>
                {planButton(course.code)}
              </div>
              <p className="sc-description">{course.description}</p>
              <HistoricalStatistics course={course} />
              <div className="sc-tags">
                <span>{course.creditsLabel} credits</span>
                <span>{course.level}-level</span>
                {topicsFor(course).map((topic) => (
                  <span key={topic}>{topic}</span>
                ))}
              </div>
              <div className={`sc-status ${status(course.code)}`}>
                {eligibilityText(course.code)}
                {eligibility[course.code].hasHighSchool &&
                  " · High school prerequisites assumed satisfied"}
                {course.corequisiteText && " · Check listed corequisites"}
              </div>
            </article>
          ))}
          {!results.length && (
            <div className="sc-empty">
              No courses match these keywords and filters. Try a broader search or All Courses.
            </div>
          )}
        </div>
      </section>
      <div className="sc-right">
        <section className="sc-panel sc-planned">
          <div>
            <span className="eyebrow">My workspace</span>
            <h2>
              Planned Courses <span className="sc-count">{planned.length}</span>
            </h2>
            <p>Your shared plan, across both views.</p>
          </div>
          <div className="sc-planned-list">
            {planned.map((code) => (
              <div className="sc-planned-course" key={code}>
                <i className="status-dot planned" />
                <div>
                  <strong>
                    <CourseCode code={code} />
                  </strong>
                  <p>{COURSES[code].title}</p>
                </div>
                <button
                  className="sc-remove"
                  aria-label={`Remove ${code} from plan`}
                  onClick={() => removePlan(code)}
                >
                  <Icon name="x" size={15} />
                </button>
              </div>
            ))}
            {!planned.length && (
              <p className="sc-empty">Your plan is empty. Add a course from the catalog.</p>
            )}
          </div>
          <p className="sc-footnote">
            {planned.reduce((total, code) => total + COURSES[code].credits, 0)} planned credits ·
            Degree progress updates automatically
          </p>
        </section>
        <section className="sc-panel sc-compare">
          <span className="eyebrow">Explore your options</span>
          <h2>Compare Courses</h2>
          <p>See course details side by side.</p>
          {choices.map((value, index) => (
            <label className="sc-choice" key={index}>
              Course {index + 1}
              <input
                list={`compare-options-${index}`}
                value={value}
                placeholder="Search course code or title"
                onChange={(e) =>
                  setChoices((old) =>
                    index === 0 ? [e.target.value, old[1]] : [old[0], e.target.value],
                  )
                }
              />
              <datalist id={`compare-options-${index}`}>
                {COURSE_LIST.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.title}
                  </option>
                ))}
              </datalist>
            </label>
          ))}
          <button
            className="sc-compare-button"
            disabled={!chosen[0] || !chosen[1] || chosen[0].code === chosen[1].code}
            onClick={() =>
              chosen[0] && chosen[1] && setComparison([chosen[0].code, chosen[1].code])
            }
          >
            Compare
          </button>
          <p className="sc-footnote">
            Select two different courses. Search interests carry into the comparison.
          </p>
        </section>
      </div>
      <dialog
        ref={dialog}
        className="sc-dialog"
        onClose={() => setComparison(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            const r = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < r.left ||
              event.clientX > r.right ||
              event.clientY < r.top ||
              event.clientY > r.bottom
            )
              setComparison(null);
          }
        }}
      >
        {comparison && (
          <>
            <div className="sc-dialog-heading">
              <div>
                <span className="eyebrow">Side by side</span>
                <h1>Course comparison</h1>
              </div>
              <button aria-label="Close comparison" onClick={() => setComparison(null)}>
                <Icon name="x" />
              </button>
            </div>
            <div className="sc-comparison-grid">
              {comparison.map((code) => {
                const course = COURSES[code];
                const matched = terms.filter((term) => searchText(course).includes(term));
                return (
                  <article key={code}>
                    <h2>
                      <CourseCode code={code} />
                    </h2>
                    <h3>{course.title}</h3>
                    <div className={`sc-status ${status(code)}`}>{eligibilityText(code)}</div>
                    <dl>
                      <dt>Description</dt>
                      <dd>{course.description}</dd>
                      <dt>Main topics</dt>
                      <dd>
                        {topicsFor(course).join(" · ") ||
                          "No topic tags identified in catalog text"}
                      </dd>
                      <dt>Credits</dt>
                      <dd>{course.creditsLabel}</dd>
                      <dt>Prerequisites</dt>
                      <dd>{course.prerequisiteText || "None listed"}</dd>
                      <dt>Corequisites</dt>
                      <dd>{course.corequisiteText || "None listed"}</dd>
                      <dt>Degree requirements</dt>
                      <dd>
                        {requirementLabels(course).join(" · ")}
                        <p className="sc-footnote">
                          Credit categories used by your progress report; subject to program rules.
                        </p>
                      </dd>
                      <dt>Historical averages &amp; instructors</dt>
                      <dd>
                        <HistoricalStatistics course={course} />
                      </dd>
                      <dt>Your interests</dt>
                      <dd>
                        <mark>
                          {terms.length
                            ? matched.length
                              ? `Catalog matches: ${matched.join(", ")}`
                              : "No catalog matches for your current search"
                            : "Enter interests in Search Courses to highlight alignment"}
                        </mark>
                      </dd>
                    </dl>
                    {eligibility[code].hasHighSchool && (
                      <p className="sc-footnote">
                        High school prerequisites are assumed satisfied. Verify that you meet them.
                      </p>
                    )}
                    {eligibility[code].review && (
                      <p className="sc-footnote">
                        Check grade, standing, and permission requirements in the Calendar.
                      </p>
                    )}
                    <a href={course.sourceUrl} target="_blank" rel="noreferrer">
                      Academic Calendar source ↗
                    </a>
                    {planButton(code)}
                  </article>
                );
              })}
            </div>
            <div className="sc-summary">
              <h3>How they differ</h3>
              <p>
                {comparison
                  .map(
                    (code) =>
                      `${code} is a ${COURSES[code].level}-level course worth ${COURSES[code].creditsLabel} credits, with ${COURSES[code].prerequisiteText ? "listed prerequisites" : "no listed prerequisites"}`,
                  )
                  .join("; ")}
                . Their catalog topics are{" "}
                {topicsFor(COURSES[comparison[0]]).join(", ") || "not tagged"} and{" "}
                {topicsFor(COURSES[comparison[1]]).join(", ") || "not tagged"}, respectively. Review
                the descriptions and requirements above in light of your interests and completed
                courses.
              </p>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}

function App() {
  const [view, setView] = useState<"constellation" | "search">("constellation");
  const [completed, setCompleted] = useState([...INITIAL_COMPLETED]);
  const [planned, setPlanned] = useState([...INITIAL_PLANNED]);
  const [center, setCenter] = useState("CPSC 110");
  const [history, setHistory] = useState<
    { code: string; pan: MapPoint; zoom: number; positions: Record<string, MapPoint> }[]
  >([]);
  const [selected, setSelected] = useState<string | null>(null);
  const courseDetailsRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!selected) return;
    const dismissOutside = (event: MouseEvent) => {
      if (event.target instanceof Node && !courseDetailsRef.current?.contains(event.target)) {
        setSelected(null);
      }
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    // Capture observes outside clicks without stopping their normal actions.
    // The central node's click handler can then reopen its course card.
    document.addEventListener("click", dismissOutside, true);
    document.addEventListener("keydown", dismissOnEscape, true);
    return () => {
      document.removeEventListener("click", dismissOutside, true);
      document.removeEventListener("keydown", dismissOnEscape, true);
    };
  }, [selected]);
  const [hoveredCourse, setHoveredCourse] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState(COURSE_POSITIONS);
  const [mapArea, setMapArea] = useState<MapArea | null>(null);
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const bounds = stage.getBoundingClientRect();
      let left = 16,
        top = 16,
        bottom = bounds.height - 16;
      stage
        .parentElement!.querySelectorAll(".progress-card, .map-label, .map-controls, .legend")
        .forEach((element) => {
          const rect = element.getBoundingClientRect();
          if (element.classList.contains("progress-card"))
            left = Math.max(left, rect.right - bounds.left + 18);
          else if (element.classList.contains("map-label"))
            top = Math.max(top, rect.bottom - bounds.top + 18);
          else bottom = Math.min(bottom, rect.top - bounds.top - 18);
        });
      const next = {
        left,
        top,
        right: bounds.width - 16,
        bottom,
        width: bounds.width,
        height: bounds.height,
      };
      setMapArea((old) => (JSON.stringify(old) === JSON.stringify(next) ? old : next));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    stage
      .parentElement!.querySelectorAll(".progress-card, .map-label, .map-controls, .legend")
      .forEach((panel) => observer.observe(panel));
    measure();
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (!mapArea) return;
    const fitted = fitNeighborhood(center, positions, mapArea, zoom);
    setPositions(fitted.positions);
    setPan(fitted.pan);
    setZoom(fitted.zoom);
    // Refitting is triggered only by a changed viewport, never popup or status state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapArea]);
  const direct = useMemo(() => {
    const current = COURSES[center];
    return [...new Set([...getPrerequisites(current), ...getDependents(center)])];
  }, [center]);

  const neighbors = (code: string) => [
    ...new Set([...getPrerequisites(COURSES[code]), ...getDependents(code)]),
  ];
  const distances = useMemo(() => {
    const result: Record<string, number> = { [center]: 0 };
    let frontier = [center];
    for (let depth = 1; depth <= 3; depth++) {
      const next: string[] = [];
      for (const code of frontier)
        for (const neighbor of neighbors(code)) {
          if (result[neighbor] !== undefined) continue;
          result[neighbor] = depth;
          next.push(neighbor);
        }
      frontier = next;
    }
    return result;
  }, [center]);
  const primary = [center, ...direct];
  const secondaryCandidates = COURSE_LIST.map((course) => course.code).filter(
    (code) =>
      distances[code] === 2 &&
      primary.every(
        (other) =>
          Math.hypot(
            positions[code].x - positions[other].x,
            positions[code].y - positions[other].y,
          ) > (other === center ? 120 : 105),
      ),
  );
  const secondary: string[] = [];
  for (const code of secondaryCandidates) {
    if (secondary.length === 6) break;
    if (
      secondary.every(
        (other) =>
          Math.hypot(
            positions[code].x - positions[other].x,
            positions[code].y - positions[other].y,
          ) >= 90,
      )
    )
      secondary.push(code);
  }
  const visible = [...primary, ...secondary];
  const visibleSet = new Set(visible);
  const connections = NETWORK_EDGES.filter(
    ({ from, to }) => visibleSet.has(from) && visibleSet.has(to),
  );
  const relationshipFocus = hoveredCourse && visibleSet.has(hoveredCourse) ? hoveredCourse : center;
  const layer = (code: string) => Math.min(2, distances[code] ?? 3);
  const initial = COURSE_POSITIONS["CPSC 110"];

  const focusCourse = (code: string, showDetails = true) => {
    if (code === center) {
      setSelected(showDetails ? code : null);
      return;
    }

    // Navigation dismisses details; only clicking the current center opens them.
    setSelected(null);
    setHistory((items) => [...items, { code: center, pan: { ...pan }, zoom, positions }]);
    setCenter(code);
    if (mapArea) {
      // Fit the new constellation from the preferred scale, independently of
      // the previous course's automatic fit or the user's manual camera changes.
      const fitted = fitNeighborhood(code, positions, mapArea, DEFAULT_ZOOM);
      setPositions(fitted.positions);
      setPan(fitted.pan);
      setZoom(fitted.zoom);
    }
  };

  const searchMatches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return COURSE_LIST.filter(
      (course) =>
        !completed.includes(course.code) &&
        (course.code.toLowerCase().includes(term) || course.title.toLowerCase().includes(term)),
    ).slice(0, 8);
  }, [query, completed]);

  // Search selection updates course status only; map selection uses focusCourse.
  const selectTakenCourse = (code: string) => {
    if (!COURSES[code]) return;
    setCompleted((items) => (items.includes(code) ? items : [...items, code]));
    setPlanned((items) => items.filter((item) => item !== code));
    setQuery("");
    setSearchOpen(false);
  };

  const addCompleted = () => {
    const exact = COURSE_LIST.find(
      (course) => course.code.toLowerCase() === query.trim().toLowerCase(),
    );
    if (exact) selectTakenCourse(exact.code);
  };

  const addPlan = (code: string) => {
    if (!completed.includes(code) && !planned.includes(code))
      setPlanned((items) => [...items, code]);
  };

  const requirements = useMemo(() => {
    const completedCodes = [...new Set(completed)];
    const plannedCodes = [...new Set(planned)].filter((code) => !completedCodes.includes(code));
    const sum = (codes: string[], predicate: (course: Course) => boolean) =>
      codes.reduce(
        (total, code) => total + (predicate(COURSES[code]) ? COURSES[code].credits : 0),
        0,
      );
    return [
      {
        label: "Overall credits",
        short: "Overall",
        target: 120,
        done: sum(completedCodes, () => true),
        plan: sum(plannedCodes, () => true),
      },
      {
        label: "Major",
        short: "Major",
        target: 42,
        done: sum(completedCodes, (c) => c.category === "Major"),
        plan: sum(plannedCodes, (c) => c.category === "Major"),
      },
      {
        label: "Science",
        short: "Science",
        target: 24,
        done: sum(completedCodes, (c) => c.category === "Science"),
        plan: sum(plannedCodes, (c) => c.category === "Science"),
      },
      {
        label: "Elective",
        short: "Elective",
        target: 18,
        done: sum(completedCodes, (c) => c.category === "Elective"),
        plan: sum(plannedCodes, (c) => c.category === "Elective"),
      },
      {
        label: "Upper-level",
        short: "Upper",
        target: 30,
        done: sum(completedCodes, (c) => c.level >= 300),
        plan: sum(plannedCodes, (c) => c.level >= 300),
      },
    ];
  }, [completed, planned]);

  const currentDetails = selected ? COURSES[selected] : null;
  const eligibility = useMemo(() => {
    const taken = new Set(completed);
    return Object.fromEntries(
      COURSE_LIST.map((course) => [course.code, evaluatePrerequisites(course, taken)]),
    );
  }, [completed]);
  const detailEligibility = currentDetails ? eligibility[currentDetails.code] : null;
  const needsManualReview = Boolean(detailEligibility?.review);
  const isEligible = Boolean(detailEligibility?.met);
  const corequisitesMet = currentDetails
    ? currentDetails.corequisiteGroups.length
      ? currentDetails.corequisiteGroups.every((group) =>
          group.some((code) => completed.includes(code) || planned.includes(code)),
        )
      : evaluatePrerequisites(
          {
            ...currentDetails,
            prerequisiteText: currentDetails.corequisiteText,
            prerequisitePaths: [],
            manualRequirement: false,
          },
          new Set([...completed, ...planned]),
        ).met
    : false;
  const status = (code: string) =>
    completed.includes(code)
      ? "completed"
      : planned.includes(code)
        ? "planned"
        : eligibility[code]?.met
          ? "satisfied"
          : "available";
  const statusLabel = (code: string) =>
    status(code) === "satisfied"
      ? "Prerequisites satisfied"
      : status(code) === "available"
        ? "Other"
        : status(code);

  return (
    <main className={`app-shell ${view === "search" ? "search-view" : ""}`}>
      <section className="map-workspace" aria-label="Course prerequisite map">
        <header className="topbar">
          <div className="brand-mark">
            <span className="brand-orbit" />
            <span className="brand-core" />
          </div>
          <div>
            <div className="brand-name">CoursePath</div>
            <div className="brand-subtitle">UBC · BSc Computer Science</div>
          </div>
          <nav className="view-tabs" aria-label="Workspace views">
            <button
              aria-current={view === "constellation" ? "page" : undefined}
              onClick={() => setView("constellation")}
            >
              Constellation
            </button>
            <button
              aria-current={view === "search" ? "page" : undefined}
              onClick={() => {
                setSelected(null);
                setView("search");
              }}
            >
              Search &amp; Compare
            </button>
          </nav>
        </header>

        <div className="progress-card glass-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Degree progress</span>
              <h2>
                {requirements[0].done}{" "}
                {requirements[0].plan > 0 && (
                  <span style={{ color: "#e9bd50", fontSize: 15 }}>+{requirements[0].plan} </span>
                )}
                <small>/ {requirements[0].target} credits</small>
              </h2>
            </div>
            <div
              className="degree-badge"
              style={{
                flexShrink: 0,
                background: `conic-gradient(#518ee9 ${Math.min(100, (requirements[0].done / requirements[0].target) * 100)}%, #1b2738 0)`,
              }}
            >
              {Math.min(100, Math.round((requirements[0].done / requirements[0].target) * 100))}%
            </div>
          </div>
          <div className="requirement-list">
            {requirements.map((req) => (
              <div className="requirement" key={req.label}>
                <div className="requirement-meta">
                  <span>{req.short}</span>
                  <span>
                    <span style={{ color: "#f5f7fb" }}>{req.done}</span>
                    {req.plan > 0 && <span style={{ color: "#e9bd50" }}> +{req.plan}</span>}
                    <span style={{ color: "#59687f" }}> / {req.target}</span>
                  </span>
                </div>
                <div
                  className="segments"
                  aria-label={`${req.label}: ${req.done} completed, ${req.plan} planned of ${req.target}`}
                >
                  <span
                    className="done"
                    style={{ width: `${Math.min(100, (req.done / req.target) * 100)}%` }}
                  />
                  <span
                    className="plan"
                    style={{
                      width: `${Math.max(0, Math.min(100 - (req.done / req.target) * 100, (req.plan / req.target) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="progress-key">
            <span>
              <i className="green" />
              Completed
            </span>
            <span>
              <i className="yellow" />
              Planned
            </span>
            <span>
              <i />
              Remaining
            </span>
          </div>
        </div>

        <div
          ref={stageRef}
          className="graph-stage"
          onWheel={(event) => {
            event.preventDefault();
            setZoom((value) => Math.min(1.45, Math.max(0.35, value - event.deltaY * 0.001)));
          }}
          onPointerDown={(event) => {
            if ((event.target as HTMLElement).closest("button")) return;
            drag.current = { x: event.clientX, y: event.clientY, px: pan.x, py: pan.y };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            setPan({
              x: drag.current.px + (event.clientX - drag.current.x) / zoom,
              y: drag.current.py + (event.clientY - drag.current.y) / zoom,
            });
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          <div
            className="graph-transform"
            style={{
              width: WORLD.width,
              height: WORLD.height,
              left: "50%",
              top: "50%",
              transform: `translate(calc(-50% + ${(WORLD.width / 2 - initial.x + pan.x) * zoom}px), calc(-50% + ${(WORLD.height / 2 - initial.y + pan.y) * zoom}px)) scale(${zoom})`,
              transition: drag.current ? "none" : "transform 0.3s ease-out",
            }}
          >
            <svg className="connection-layer" viewBox={`0 0 ${WORLD.width} ${WORLD.height}`}>
              <defs>
                {[
                  { id: "arrow", color: "#7d8ba9" },
                  { id: "arrow-incoming", color: "#62e4f4" },
                  { id: "arrow-outgoing", color: "#ffa65c" },
                ].map(({ id, color }) => (
                  <marker
                    key={id}
                    id={id}
                    markerWidth="8"
                    markerHeight="8"
                    refX="6"
                    refY="3"
                    orient="auto"
                    markerUnits="strokeWidth"
                  >
                    <path d="M0,0 L0,6 L7,3 z" fill={color} />
                  </marker>
                ))}
              </defs>
              {connections.map(({ from, to }) => {
                const incoming = to === relationshipFocus;
                const outgoing = from === relationshipFocus;
                const highlighted = incoming || outgoing;
                const alpha = layer(from) === 2 || layer(to) === 2 ? 0.22 : 0.46;
                const arrowColor = incoming
                  ? `rgba(98, 228, 244, ${alpha})`
                  : outgoing
                    ? `rgba(255, 166, 92, ${alpha})`
                    : undefined;
                const a = positions[from];
                const b = positions[to];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
                const startR = layer(from) === 0 ? 53 : layer(from) === 1 ? 43 : 32;
                const endR = layer(to) === 0 ? 62 : layer(to) === 1 ? 52 : 40;
                return (
                  <line
                    style={{
                      opacity: from === center || to === center ? 1 : 0.22,
                      stroke: arrowColor,
                      transition: "stroke 0.18s ease",
                    }}
                    key={`${from}-${to}`}
                    x1={a.x + (dx / length) * startR}
                    y1={a.y + (dy / length) * startR}
                    x2={b.x - (dx / length) * endR}
                    y2={b.y - (dy / length) * endR}
                    className={
                      layer(from) === 2 || layer(to) === 2 ? "connection secondary" : "connection"
                    }
                    markerEnd={`url(#${incoming ? "arrow-incoming" : outgoing ? "arrow-outgoing" : "arrow"})`}
                  />
                );
              })}
            </svg>
            {visible.map((code) => {
              const pos = positions[code];
              const nodeStatus = status(code);
              return (
                <button
                  key={code}
                  className={`course-node layer-${layer(code)} ${nodeStatus}`}
                  style={{
                    transition:
                      "left 0.25s ease-out, top 0.25s ease-out, opacity 0.2s, filter 0.2s",
                    left: pos.x,
                    top: pos.y,
                    opacity:
                      code === center || direct.includes(code)
                        ? 1
                        : distances[code] === 2
                          ? 0.38
                          : 0.16,
                    outline: code === center ? "1px solid rgba(215, 229, 255, 0.65)" : undefined,
                    filter: code === center ? "brightness(1.25)" : undefined,
                  }}
                  onMouseEnter={() => setHoveredCourse(code)}
                  onMouseLeave={() => setHoveredCourse(null)}
                  onFocus={() => setHoveredCourse(code)}
                  onBlur={() => setHoveredCourse(null)}
                  onClick={(event) => {
                    event.stopPropagation();
                    focusCourse(code);
                  }}
                  aria-label={`View ${code}, ${COURSES[code].title}, ${statusLabel(code)}`}
                >
                  <span className="node-glow" />
                  <span className="node-core">
                    {layer(code) === 0 && <span className="center-dot" />}
                  </span>
                  <strong>
                    <CourseCode code={code} />
                  </strong>
                  {layer(code) < 2 && <small>{COURSES[code].title}</small>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="map-label">
          <span className="eyebrow">Solar map</span>
          <h1>{center}</h1>
          <p>Drag to pan · Scroll to zoom · Select a star to explore</p>
        </div>

        <div className="map-controls glass-panel">
          <button
            disabled={!history.length}
            onClick={() => {
              const previous = history[history.length - 1];
              if (!previous) return;
              setCenter(previous.code);
              setHistory((items) => items.slice(0, -1));
              setSelected(null);
              setPositions(previous.positions);
              setPan(previous.pan);
              setZoom(previous.zoom);
            }}
          >
            <Icon name="back" /> Back
          </button>
          <span />
          <button aria-label="Zoom out" onClick={() => setZoom((v) => Math.max(0.35, v - 0.15))}>
            <Icon name="minus" />
          </button>
          <b>{Math.round(zoom * 100)}%</b>
          <button aria-label="Zoom in" onClick={() => setZoom((v) => Math.min(1.45, v + 0.15))}>
            <Icon name="plus" />
          </button>
          <span />
          <button
            onClick={() => {
              setCenter("CPSC 110");
              setHistory([]);
              setSelected(null);
              if (mapArea) {
                const fitted = fitNeighborhood("CPSC 110", COURSE_POSITIONS, mapArea, DEFAULT_ZOOM);
                setPositions(fitted.positions);
                setPan(fitted.pan);
                setZoom(fitted.zoom);
              }
            }}
          >
            <Icon name="reset" /> Reset
          </button>
        </div>

        <div
          className="legend glass-panel"
          style={{ flexWrap: "wrap", maxWidth: "calc(100% - 56px)", rowGap: 8 }}
        >
          <span>
            <i className="satisfied" />
            Prerequisites satisfied
          </span>
          <span>
            <i className="completed" />
            Completed
          </span>
          <span>
            <i className="planned" />
            Planned
          </span>
          <span>
            <i className="available" />
            Other courses
          </span>
          <span>
            <RequiredStar /> Required for graduation
          </span>
          <div style={{ flexBasis: "100%", display: "grid", gap: 4, fontSize: 8 }}>
            <span>
              <span style={{ color: "#62e4f4", fontSize: 14 }} aria-hidden="true">
                &#8594;
              </span>{" "}
              Cyan arrow: Prerequisite.
            </span>
            <span>
              <span style={{ color: "#ffa65c", fontSize: 14 }} aria-hidden="true">
                &#8594;
              </span>{" "}
              Orange arrow: Dependent course.
            </span>
          </div>
        </div>

        {currentDetails && (
          <article
            ref={courseDetailsRef}
            className="detail-card glass-panel"
            aria-label="Course information"
            style={{
              position: "absolute",
              right: 18,
              top: 96,
              width: 286,
              padding: 16,
              maxHeight: "calc(100% - 120px)",
              zIndex: 20,
            }}
          >
            <button
              className="close-button"
              onClick={() => setSelected(null)}
              aria-label="Close course details"
            >
              <Icon name="x" />
            </button>
            <div className="detail-topline">
              <span className={`status-chip ${status(currentDetails.code)}`}>
                {statusLabel(currentDetails.code)}
              </span>
              <span>
                {currentDetails.creditsLabel === "1"
                  ? "1 credit"
                  : `${currentDetails.creditsLabel} credits`}
              </span>
            </div>
            <h2>
              <CourseCode code={currentDetails.code} />
            </h2>
            <h3>{currentDetails.title}</h3>
            <p>{currentDetails.description}</p>
            <HistoricalStatistics course={currentDetails} />
            <div className="prereq-row">
              <span>Prerequisites</span>
              <strong>{currentDetails.prerequisiteText || "None"}</strong>
              {currentDetails.corequisiteText && (
                <>
                  <span className="corequisite-label">Corequisites</span>
                  <strong>{currentDetails.corequisiteText}</strong>
                </>
              )}
            </div>
            {detailEligibility?.hasHighSchool && (
              <p style={{ color: "#8390a4", fontSize: 10, lineHeight: 1.5 }}>
                High school prerequisites are assumed satisfied. Please verify that you meet these
                requirements.
              </p>
            )}
            <div className={`eligibility ${isEligible ? "eligible" : ""}`}>
              <span className="eligibility-icon">
                <Icon name={isEligible ? "check" : "x"} size={15} />
              </span>
              <span>
                <strong>
                  {currentDetails.referenceOnly
                    ? "Reference only"
                    : needsManualReview
                      ? "Review additional requirements"
                      : isEligible
                        ? "You’re eligible"
                        : "Prerequisites incomplete"}
                </strong>
                <small>
                  {currentDetails.referenceOnly
                    ? "No current Vancouver course listing"
                    : needsManualReview
                      ? "The Calendar includes standing, grade, or permission rules"
                      : isEligible
                        ? currentDetails.corequisiteText
                          ? corequisitesMet
                            ? "Prerequisites met; corequisites completed or planned."
                            : "Prerequisites met. Listed corequisites still need to be completed or planned."
                          : "A valid prerequisite pathway is complete"
                        : "Complete one of the listed prerequisite pathways"}
                </small>
              </span>
            </div>
            <a
              className="calendar-source"
              href={currentDetails.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              UBC Academic Calendar source
            </a>
            <button
              className="plan-button"
              disabled={
                completed.includes(currentDetails.code) || planned.includes(currentDetails.code)
              }
              onClick={() => addPlan(currentDetails.code)}
            >
              <Icon
                name={
                  planned.includes(currentDetails.code) || completed.includes(currentDetails.code)
                    ? "check"
                    : "plus"
                }
              />
              {completed.includes(currentDetails.code)
                ? "Course completed"
                : planned.includes(currentDetails.code)
                  ? "Added to plan"
                  : "Add to plan"}
            </button>
          </article>
        )}
      </section>

      <aside className="sidebar">
        <div className="sidebar-header">
          <div>
            <span className="eyebrow">My workspace</span>
            <h2>Course plan</h2>
          </div>
          <button aria-label="Collapse sidebar">
            <Icon name="chevron" />
          </button>
        </div>
        <section className="list-section">
          <div className="section-title">
            <div>
              <span className="section-icon green">
                <Icon name="check" size={15} />
              </span>
              <h3>Courses taken</h3>
            </div>
            <span>{completed.length}</span>
          </div>
          <div
            data-course-search
            style={{ position: "relative" }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                setSearchOpen(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setSearchOpen(false);
            }}
          >
            <div className="course-search">
              <Icon name="search" size={17} />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCompleted();
                  }
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    event.currentTarget
                      .closest("[data-course-search]")
                      ?.querySelector<HTMLButtonElement>("[data-suggestion]")
                      ?.focus();
                  }
                }}
                aria-label="Search courses to add to Courses Taken"
                aria-expanded={searchOpen && Boolean(query.trim())}
                aria-controls="taken-course-suggestions"
                autoComplete="off"
                placeholder="Search course code"
              />
              <button onClick={addCompleted}>Add</button>
            </div>
            {searchOpen && query.trim() && (
              <div
                id="taken-course-suggestions"
                aria-label="Matching courses"
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  zIndex: 30,
                  maxHeight: 260,
                  overflowY: "auto",
                  padding: 6,
                  borderRadius: 8,
                  border: "1px solid #253248",
                  background: "#0a101a",
                  boxShadow: "0 12px 30px #0008",
                }}
              >
                {searchMatches.map((course) => (
                  <button
                    key={course.code}
                    data-suggestion
                    className="course-link"
                    onClick={() => selectTakenCourse(course.code)}
                    style={{
                      width: "100%",
                      padding: "9px 8px",
                      textAlign: "left",
                      borderRadius: 6,
                    }}
                  >
                    <span>
                      <strong>{course.code}</strong>
                      <small>{course.title}</small>
                    </span>
                    <Icon name="plus" size={14} />
                  </button>
                ))}
                {!searchMatches.length && (
                  <p style={{ padding: 8, color: "#748399", fontSize: 11 }}>
                    No matching courses to add.
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="course-list">
            {completed.map((code) => (
              <div className="list-item" key={code}>
                <button className="course-link" onClick={() => focusCourse(code, false)}>
                  <i className="status-dot completed" />
                  <span>
                    <strong>
                      <CourseCode code={code} />
                    </strong>
                    <small>{COURSES[code].title}</small>
                  </span>
                </button>
                <button
                  className="remove-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setCompleted((items) => items.filter((item) => item !== code));
                  }}
                  aria-label={`Remove ${code} from courses taken`}
                  title="Remove course"
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>
        <section className="list-section planned-section">
          <div className="section-title">
            <div>
              <span className="section-icon yellow">
                <Icon name="star" size={14} />
              </span>
              <h3>Courses planned</h3>
            </div>
            <span>{planned.length}</span>
          </div>
          <div className="course-list">
            {planned.map((code) => (
              <div className="list-item" key={code}>
                <button className="course-link" onClick={() => focusCourse(code, false)}>
                  <i className="status-dot planned" />
                  <span>
                    <strong>
                      <CourseCode code={code} />
                    </strong>
                    <small>{COURSES[code].title}</small>
                  </span>
                </button>
                <button
                  className="remove-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setPlanned((items) => items.filter((item) => item !== code));
                  }}
                  aria-label={`Remove ${code} from plan`}
                  title="Remove course"
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
            {!planned.length && (
              <div className="empty-state">Select a course star to add it to your plan.</div>
            )}
          </div>
        </section>
        <footer className="sidebar-footer">
          <div className="avatar">AM</div>
          <div>
            <strong>Alex Morgan</strong>
            <span>Year 2 · {requirements[0].done} credits</span>
          </div>
          <button aria-label="Open profile">
            <Icon name="chevron" size={16} />
          </button>
        </footer>
      </aside>
      <div className="search-view-content" hidden={view !== "search"}>
        <SearchCompare
          planned={planned}
          completed={completed}
          eligibility={eligibility}
          status={status}
          addPlan={addPlan}
          removePlan={(code) => setPlanned((items) => items.filter((item) => item !== code))}
        />
      </div>
    </main>
  );
}

export default App;
