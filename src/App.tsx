import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { COURSE_LIST, COURSES, type Course } from "./data/courses";
import { inferCompletedPrerequisites } from "./completedPrerequisites";
import { simplifyPrerequisites, type PrerequisiteExpression } from "./prerequisiteSimplification.js";
import { evaluatePrerequisites, evaluateWithPlan, hasUnresolvedChain, type PrerequisiteStatus } from "./prerequisiteEvaluation.js";

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
    {String.fromCharCode(9733)}
  </span>
);

const CourseCode = ({ code }: { code: string }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>
    {code}
  </span>
);

const gradeLabel = (value: number | null | undefined) =>
  value == null ? "Not published" : `${value.toFixed(1)}%`;

function HistoricalStatistics({ course }: { course: Course }) {
  const professorNames = [
    ...new Set((course.professors ?? []).map((professor) => professor.name.trim()).filter(Boolean)),
  ];
  return (
    <section className="course-facts" aria-label={`Course statistics for ${course.code}`}>
      <div className="course-fact course-fact-grade">
        <span>AVG. GRADE</span>
        <strong>{gradeLabel(course.averageGrade)}</strong>
      </div>
      <div className="course-fact course-fact-professor">
        <span>PROFESSOR</span>
        <strong title={professorNames.join(", ")}>
          {professorNames.length ? professorNames.join(", ") : "Not available"}
        </strong>
      </div>
    </section>
  );
}

const Icon = ({
  name,
  size = 18,
}: {
  name:
    | "search"
    | "plus"
    | "minus"
    | "x"
    | "back"
    | "reset"
    | "check"
    | "chevron"
    | "star"
    | "constellation"
    | "compare";
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
    constellation: (
      <>
        <circle cx="6" cy="8" r="1.5" />
        <circle cx="17" cy="5" r="1.5" />
        <circle cx="15" cy="17" r="1.5" />
        <path d="m7.5 7.6 8-2.2M16.6 6.4 15.4 15.5M7 9.2l7 6.7" />
      </>
    ),
    compare: (
      <>
        <circle cx="9" cy="9" r="4.5" />
        <path d="m12.3 12.3 5.2 5.2M15 5h4M17 3v4" />
      </>
    ),
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

function GlobalCourseSearch({ onSelect }: { onSelect: (code: string) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const options = COURSE_LIST.filter((c) =>
    `${c.code} ${c.title}`.toLowerCase().includes(query.trim().toLowerCase()),
  ).slice(0, 10);
  const choose = (code: string) => {
    onSelect(code);
    setQuery("");
    setOpen(false);
    setActive(0);
  };
  useEffect(() => {
    document.getElementById(`global-course-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active]);
  return (
    <div
      className="global-course-search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <Icon name="search" size={15} />
      <input
        placeholder="Search courses..."
        aria-label="Search courses"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && Boolean(query.trim())}
        aria-controls="global-course-options"
        aria-activedescendant={
          open && query.trim() && options[active] ? `global-course-${active}` : undefined
        }
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            setActive((old) =>
              options.length
                ? (old + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length
                : 0,
            );
          }
          if (e.key === "Enter" && open && query.trim() && options[active]) {
            e.preventDefault();
            choose(options[active].code);
          }
        }}
      />
      {open && query.trim() && (
        <div
          id="global-course-options"
          className="global-course-options"
          role="listbox"
          aria-label="Matching courses"
        >
          {options.map((course, index) => (
            <button
              type="button"
              role="option"
              aria-selected={active === index}
              id={`global-course-${index}`}
              key={course.code}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(course.code)}
            >
              <CourseCode code={course.code} />
              <small>{course.title}</small>
            </button>
          ))}
          {!options.length && <p>No matching courses.</p>}
        </div>
      )}
    </div>
  );
}

function TakenCoursesEditor({
  completed,
  onSave,
  onCancel,
}: {
  completed: string[];
  onSave: (codes: string[]) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(new Set(completed));
  const [automatic, setAutomatic] = useState(new Set<string>());
  const [suppressed, setSuppressed] = useState(new Set<string>());
  const [filter, setFilter] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const canInfer = (course: Course) => !evaluatePrerequisites(course, new Set()).review;
  const addCourses = (codes: string[]) => {
    let next = new Set(draft);
    const inferred = new Set(automatic);
    const exclusions = new Set(suppressed);
    for (const code of codes) {
      exclusions.delete(code);
      const result = inferCompletedPrerequisites(code, next, COURSES, canInfer, exclusions);
      next = result.selected;
      for (const item of result.inferred) inferred.add(item);
      inferred.delete(code);
    }
    setDraft(next);
    setAutomatic(inferred);
    setSuppressed(exclusions);
  };
  const pending = [...draft]
    .map((code) => COURSES[code])
    .filter(
      (c) =>
        c.prerequisitePaths.length > 1 &&
        canInfer(c) &&
        !evaluatePrerequisites(c, draft).met &&
        !c.prerequisitePaths.some((path) => path.every((item) => draft.has(item))),
    );
  const levels = [...new Set([100, 200, 300, 400, ...COURSE_LIST.map((c) => c.level)])].sort(
    (a, b) => a - b,
  );
  return (
    <dialog
      ref={dialog}
      className="taken-dialog"
      onCancel={onCancel}
      aria-labelledby="taken-dialog-title"
    >
      <div className="taken-dialog-heading">
        <h2 id="taken-dialog-title">Add Courses Taken</h2>
        <button aria-label="Close Add Courses Taken" onClick={onCancel}>
          <Icon name="x" />
        </button>
      </div>
      <input
        className="taken-filter"
        autoFocus
        placeholder="Search courses..."
        aria-label="Filter courses taken checklist"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <nav className="taken-levels" aria-label="Course levels">
        {[100, 200, 300, 400].map((level) => (
          <button
            key={level}
            onClick={() =>
              document
                .getElementById(`taken-level-${level}`)
                ?.scrollIntoView({ block: "start", behavior: "smooth" })
            }
          >
            {level}-level
          </button>
        ))}
      </nav>
      <div className="taken-checklist">
        {pending.length > 0 && (
          <div className="taken-alternatives">
            {pending.map((course) => (
              <div key={course.code}>
                <strong>{course.code}: choose a prerequisite path</strong>
                <div>
                  {course.prerequisitePaths.map((path, index) => (
                    <button
                      key={index}
                      disabled={path.some((item) => !COURSES[item])}
                      onClick={() => addCourses(path.filter((item) => COURSES[item]))}
                    >
                      {path.join(" + ")}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {levels.map((level) => {
          const courses = COURSE_LIST.filter(
            (c) =>
              c.level === level &&
              `${c.code} ${c.title}`.toLowerCase().includes(filter.trim().toLowerCase()),
          ).sort((a, b) => a.code.localeCompare(b.code));
          return (
            <section key={level} id={`taken-level-${level}`}>
              <h3>{level}-level</h3>
              {courses.map((course) => (
                <label className="taken-checklist-row" key={course.code}>
                  <input
                    type="checkbox"
                    checked={draft.has(course.code)}
                    onChange={(e) => {
                      if (e.target.checked) addCourses([course.code]);
                      else {
                        setDraft((old) => {
                          const next = new Set(old);
                          next.delete(course.code);
                          return next;
                        });
                        setAutomatic((old) => {
                          const next = new Set(old);
                          next.delete(course.code);
                          return next;
                        });
                        setSuppressed((old) => new Set(old).add(course.code));
                      }
                    }}
                  />
                  <strong>
                    <CourseCode code={course.code} />
                  </strong>
                  <span>{course.title}</span>
                  {automatic.has(course.code) && (
                    <small title="Automatically selected prerequisite. Uncheck to correct.">
                      Auto
                    </small>
                  )}
                </label>
              ))}
              {!courses.length && <p className="taken-no-results">No matching courses.</p>}
            </section>
          );
        })}
      </div>
      <footer className="taken-actions">
        <span aria-live="polite">{draft.size} selected</span>
        <button onClick={onCancel}>Cancel</button>
        <button className="taken-save" onClick={() => onSave([...draft])}>
          Save Courses
        </button>
      </footer>
    </dialog>
  );
}

function AppHeader({
  view,
  onViewChange,
  onCourseSelect,
  onReset,
}: {
  view: "constellation" | "search";
  onViewChange: (view: "constellation" | "search") => void;
  onCourseSelect: (code: string) => void;
  onReset: () => void;
}) {
  return (
    <header className="topbar">
      <div className="topbar-content">
        <button className="brand-home" onClick={onReset} aria-label="Reset to the default constellation">
        <div className="brand-mark">
          <span className="brand-orbit" />
          <span className="brand-core" />
        </div>
        <div>
          <div className="brand-name">CoursePath</div>
          <div className="brand-subtitle">UBC {"\u00B7"} BSc Computer Science</div>
        </div>
        </button>
        <nav className="view-tabs" aria-label="Workspace views">
          <button
            aria-current={view === "constellation" ? "page" : undefined}
            onClick={() => onViewChange("constellation")}
          >
            <Icon name="constellation" size={15} />
            Constellation
          </button>
          <button
            aria-current={view === "search" ? "page" : undefined}
            onClick={() => onViewChange("search")}
          >
            <Icon name="compare" size={15} />
            Search &amp; Compare
          </button>
        </nav>
      </div>
      {view === "constellation" && <GlobalCourseSearch onSelect={onCourseSelect} />}
    </header>
  );
}

function PlannedCourseList({
  planned,
  onRemove,
  onSelect,
  eligibility,
  completed,
}: {
  planned: string[];
  onRemove: (code: string) => void;
  onSelect: (code: string) => void;
  eligibility: Record<string, PrerequisiteStatus>;
  completed: string[];
}) {
  return (
    <div className="course-list shared-planned-list">
      {planned.map((code) => (
        <div className="list-item" key={code}>
          <div className="course-link planned-course-link">
            <i className="status-dot planned" />
            <div className="planned-course-content">
              <div className="planned-course-heading">
                <button className="planned-course-code" onClick={() => onSelect(code)}><strong><CourseCode code={code} /></strong></button>
                <span className={`planned-readiness ${eligibility[code].state}`}>
                  {eligibility[code].state === "satisfied" ? "Ready to take" : eligibility[code].state === "incomplete" ? "Missing prerequisites" : <>
                    After <PlannedDependencies course={COURSES[code]} completed={completed} planned={planned} onSelect={onSelect} />
                  </>}
                </span>
              </div>
              <small>{COURSES[code].title}</small>
              {eligibility[code].review && <span className="planned-chain-note">Additional requirements apply</span>}
              {eligibility[code].state === "with-plan" && hasUnresolvedChain(code, COURSES, completed, planned) && <span className="planned-chain-note">Prerequisite chain needs attention</span>}
            </div>
          </div>
          <button
            className="remove-button"
            onClick={(event) => {
              event.stopPropagation();
              onRemove(code);
            }}
            aria-label={`Remove ${code} from plan`}
            title="Remove course"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
      {!planned.length && <div className="empty-state">No planned courses.</div>}
    </div>
  );
}

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

// Each path is a complete alternative; courses within a path are all required.
const missingPrerequisitePaths = (course: Course, _taken: ReadonlySet<string>) => {
  let paths = course.prerequisitePaths;
  if (!paths.length && course.prerequisiteText) {
    const text = course.prerequisiteText.split(/\.\s/)[0];
    const codes = [...text.matchAll(/\b([A-Z]{2,5})(?:_V)?\s+(\d{3})\b/g)].map((match) => `${match[1]} ${match[2]}`);
    if (/^one of\b/i.test(text) && !/\band\b|\bplus\b/i.test(text)) paths = codes.map((code) => [code]);
    else if ((/^all of\b/i.test(text) && !/\bor\b/i.test(text)) || (codes.length === 1 && !/\bor\b|\bone of\b/i.test(text))) paths = codes.length ? [codes] : [];
  }
  return paths.map((path) => path.filter((code) => !highSchoolPattern.test(code)));
};

function PlannedDependencies({ course, completed, planned, onSelect }: { course: Course; completed: string[]; planned: string[]; onSelect: (code: string) => void }) {
  const taken = new Set(completed);
  const paths = missingPrerequisitePaths(course, taken).map((path) => path.filter((code) => !taken.has(code))).filter((path) => path.every((code) => planned.includes(code) && code !== course.code));
  if (!paths.length) return <>{evaluateWithPlan(course, completed, planned).plannedContributors.map((code, i) => <span key={code}>{i > 0 && ", "}<button onClick={() => onSelect(code)}>{code}</button></span>)}</>;
  const render = (node: PrerequisiteExpression): React.ReactNode => {
    if (node.type === "true" || node.type === "false") return null;
    if (node.type === "count") return <>{node.count < node.codes.length && (node.count === 1 ? "either " : `${node.count} of `)}{node.codes.map((code, i) => <span key={code}>{i > 0 && (i === node.codes.length - 1 ? (node.count === node.codes.length ? " and " : " or ") : ", ")}<button onClick={() => onSelect(code)}>{code}</button></span>)}</>;
    return <>{node.children.map((child, i) => <span key={i}>{i > 0 && (node.type === "and" ? " and " : " or ")}{node.type === "or" && "("}{render(child)}{node.type === "or" && ")"}</span>)}</>;
  };
  return <>{render(simplifyPrerequisites(paths))}</>;
}

function PrerequisiteGroups({ expression, completed, planned, onSelect }: { expression: PrerequisiteExpression; completed: string[]; planned: string[]; onSelect: (code: string) => void }) {
  if (expression.type === "true" || expression.type === "false") return null;
  if (expression.type === "count") {
    const completedCount = expression.codes.filter((code) => completed.includes(code)).length;
    const plannedCount = expression.codes.filter((code) => !completed.includes(code) && planned.includes(code)).length;
    const covered = completedCount >= expression.count ? "Completed" : completedCount + plannedCount >= expression.count ? "Covered by plan" : "Incomplete";
    const label = expression.count === expression.codes.length ? "Complete all of the following" : `Complete ${expression.count} of the following`;
    return (
    <div className="missing-path">
      <span className="missing-path-label">{label} <span className={`requirement-state ${covered === "Covered by plan" ? "with-plan" : covered.toLowerCase()}`}>· {covered}</span> ({Math.min(completedCount, expression.count)} completed, {Math.min(plannedCount, Math.max(0, expression.count - completedCount))} planned)</span>
      {expression.codes.map((code) => <div className="missing-course" key={code}>
        {COURSES[code] ? <button onClick={() => onSelect(code)}><strong><CourseCode code={code} /></strong><span>{COURSES[code].title}</span></button> : <span><strong>{code}</strong> Course details unavailable</span>}
        <small className={completed.includes(code) ? "requirement-completed" : planned.includes(code) ? "requirement-planned" : "requirement-alternative"}>{completed.includes(code) ? "✓ Completed" : planned.includes(code) ? "● Planned" : covered === "Incomplete" ? "Additional selection" : "Alternative"}</small>
      </div>)}
    </div>
  );
  }
  return <div>{expression.children.map((child, index) => <div className="missing-path" key={index}>
    {index > 0 && <span className="missing-path-label">{expression.type === "or" ? "OR" : "AND"}</span>}
    {expression.type === "or" && <span className="missing-path-label">Option {index + 1}</span>}
    <PrerequisiteGroups expression={child} completed={completed} planned={planned} onSelect={onSelect} />
  </div>)}</div>;
}

function RequirementSummary({ expression, completed, planned }: { expression: PrerequisiteExpression; completed: string[]; planned: string[] }) {
  const groups = expression.type === "count" ? [expression] : expression.type === "and" ? expression.children : [];
  if (!groups.length || groups.some((group) => group.type !== "count")) return null;
  const seen = new Set<string>();
  for (const group of groups) {
    if (group.type !== "count" || group.codes.some((code) => seen.has(code))) return null;
    group.codes.forEach((code) => seen.add(code));
  }
  const covered = groups.filter((group) => group.type === "count" && group.codes.filter((code) => completed.includes(code) || planned.includes(code)).length >= group.count).length;
  return <p className="requirement-summary">{covered} of {groups.length} course requirement groups covered</p>;
}

function SearchPrerequisiteStatus({ course, evaluation, completed, planned, onSelect }: { course: Course; evaluation: PrerequisiteStatus; completed: string[]; planned: string[]; onSelect: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  useEffect(() => { if (evaluation.state !== "incomplete") setOpen(false); }, [evaluation.state]);
  const label = evaluation.state === "satisfied" ? "Prerequisites satisfied" : evaluation.state === "with-plan" ? "Satisfied with planned courses" : "Prerequisites not satisfied";
  const paths = open ? missingPrerequisitePaths(course, new Set(completed)) : [];
  const expression = paths.length ? simplifyPrerequisites(paths, new Set([...completed, ...planned])) : null;
  return <div className={`sc-prerequisite-status ${evaluation.state}`} ref={container}>
    {evaluation.state === "incomplete" ? <button className="sc-prerequisite-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{label}</button> : <span>{label}</span>}
    {evaluation.state === "with-plan" && evaluation.plannedContributors.length > 0 && <div className="sc-prerequisite-dependencies">Depends on: {evaluation.plannedContributors.map((code, index) => <span key={code}>{index > 0 && ", "}{COURSES[code] ? <button onClick={() => onSelect(code)}>{code}</button> : code}</span>)}</div>}
    {open && <div className="sc-prerequisite-details">
      {expression && expression.type !== "true" ? <PrerequisiteGroups expression={expression} completed={completed} planned={planned} onSelect={onSelect} /> : <span>Review the Academic Calendar for prerequisite details.</span>}
    </div>}
  </div>;
}

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
  obstacles: { left: number; right: number; top: number; bottom: number }[];
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
    const spacing = attempt % 2 === 0 ? 1 : 0.88;
    const halfWidth = Math.min(area.width / 2 - area.left, area.right - area.width / 2) / fitZoom;
    const halfHeight = (area.bottom - area.top) / fitZoom / 2;
    const centerX = area.width / 2;
    const centerY = (area.top + area.bottom) / 2;
    const fits = (point: MapPoint, radius: number) =>
      Math.abs(point.x - anchor.x) + radius <= halfWidth &&
      Math.abs(point.y - anchor.y) + radius <= halfHeight &&
      area.obstacles.every((obstacle) => {
        const x = centerX + (point.x - anchor.x) * fitZoom;
        const y = centerY + (point.y - anchor.y) * fitZoom;
        const nearestX = Math.max(obstacle.left, Math.min(x, obstacle.right));
        const nearestY = Math.max(obstacle.top, Math.min(y, obstacle.bottom));
        return Math.hypot(x - nearestX, y - nearestY) >= radius * fitZoom + 8;
      });
    placed = { [code]: anchor };
    const clear = (point: MapPoint, radius: number) =>
      Object.entries(placed).every(
        ([other, position]) =>
          Math.hypot(position.x - point.x, position.y - point.y) >=
          (other === code ? 160 : 156) * spacing,
      );
    const candidates: MapPoint[] = [];
    for (let radius = 190 * spacing; radius <= Math.hypot(halfWidth, halfHeight); radius += 90 * spacing) {
      for (let step = 0; step < 48; step++) {
        const angle = (step / 48) * Math.PI * 2;
        const irregularity = Math.sin(step * 7 + radius) * 6;
        const point = { x: anchor.x + Math.cos(angle) * (radius + irregularity), y: anchor.y + Math.sin(angle) * (radius + irregularity) };
        if (fits(point, 72)) candidates.push(point);
      }
    }
    for (const [index, neighbor] of direct.entries()) {
      const targetAngle = index * Math.PI * (3 - Math.sqrt(5));
      const score = (point: MapPoint) => {
        const dx = point.x - anchor.x, dy = point.y - anchor.y;
        const angle = Math.atan2(dy, dx);
        const difference = Math.atan2(Math.sin(angle - targetAngle), Math.cos(angle - targetAngle));
        const leftCount = Object.values(placed).filter((p) => p.x < anchor.x - 1).length;
        const rightCount = Object.values(placed).filter((p) => p.x > anchor.x + 1).length;
        const imbalance = dx < -10 ? leftCount - rightCount : dx > 10 ? rightCount - leftCount : 0;
        return Math.hypot(dx, dy) + Math.abs(difference) * 35 + Math.max(0, imbalance) * 90;
      };
      const available = candidates
        .filter((point) => clear(point, 57))
        .sort((a, b) => score(a) - score(b));
      if (available[0]) placed[neighbor] = available[0];
    }
    if (fits(anchor, 87) && direct.every((neighbor) => placed[neighbor])) break;
    if (attempt % 2 === 1) fitZoom *= 0.95;
  }
  return {
    positions: { ...previous, ...placed },
    zoom: fitZoom,
    pan: {
      x: initial.x - anchor.x,
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
  onSelectCourse,
}: {
  planned: string[];
  completed: string[];
  addPlan: (code: string) => void;
  removePlan: (code: string) => void;
  eligibility: Record<string, PrerequisiteStatus>;
  status: (code: string) => string;
  onSelectCourse: (code: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<string[]>([]);
  const [sort, setSort] = useState("relevance");
  const [choices, setChoices] = useState<[string, string]>(["", ""]);
  const [comparison, setComparison] = useState<[string, string] | null>(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
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
  const planButton = (code: string) => (
    <button
      className="sc-plan"
      disabled={completed.includes(code) || planned.includes(code)}
      onClick={() => addPlan(code)}
    >
      {completed.includes(code)
        ? "Taken"
        : planned.includes(code)
          ? "Already Added"
          : "+ Add to Plan"}
    </button>
  );
  return (
    <div className="search-compare">
      <section className="sc-panel sc-search" aria-label="Search courses">
        <h1>Search Courses</h1>
        <label className="sc-search-input">
          <Icon name="search" />
          <input
            aria-label="Search all courses"
            placeholder={"Search codes, topics or interests \u2014 machine learning, security, graphics\u2026"}
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
            <article className={`sc-course${planned.includes(course.code) ? " is-planned" : ""}${completed.includes(course.code) ? " is-completed" : ""}${chosen.some((choice) => choice?.code === course.code) ? " is-compared" : ""}`} key={course.code}>
              <div className="sc-course-heading">
                <h2>
                  <CourseCode code={course.code} /> <span>{course.title}</span>
                </h2>
                {planButton(course.code)}
              </div>
              <p
                id={`description-${course.code.replace(/\s/g, "-")}`}
                className={`sc-description ${expandedDescriptions.has(course.code) ? "expanded" : ""}`}
              >
                {course.description}
              </p>
              <button
                className="sc-description-toggle"
                aria-expanded={expandedDescriptions.has(course.code)}
                aria-controls={`description-${course.code.replace(/\s/g, "-")}`}
                onClick={() =>
                  setExpandedDescriptions((previous) => {
                    const next = new Set(previous);
                    if (next.has(course.code)) next.delete(course.code);
                    else next.add(course.code);
                    return next;
                  })
                }
              >
                {expandedDescriptions.has(course.code) ? "Show less" : "Full description"}
              </button>
              <HistoricalStatistics course={course} />
              <div className="sc-tags">
                <span>{course.creditsLabel} credits</span>
                <span>{course.level}-level</span>
                {topicsFor(course).map((topic) => (
                  <span key={topic}>{topic}</span>
                ))}
              </div>
              <SearchPrerequisiteStatus course={course} evaluation={eligibility[course.code]} completed={completed} planned={planned} onSelect={onSelectCourse} />
              {eligibility[course.code].review && <p className="sc-footnote">Additional requirements may apply; check the Academic Calendar.</p>}
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
          <h2>Planned Courses</h2>
          <PlannedCourseList planned={planned} completed={completed} onRemove={removePlan} onSelect={onSelectCourse} eligibility={eligibility} />
        </section>
        <section className="sc-panel sc-compare">
          <h2>Compare Courses</h2>
          {choices.map((value, index) => (
            <label className={`sc-choice${chosen[index] ? " is-selected" : ""}`} key={index}>
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
                return (
                  <article key={code}>
                    <h2>
                      <CourseCode code={code} />
                    </h2>
                    <div className="sc-comparison-title">
                      <h3>{course.title}</h3>
                    </div>
                    <dl>
                      <div className="sc-comparison-section">
                        <dt>Description</dt>
                        <dd>{course.description}</dd>
                      </div>
                      <div className="sc-comparison-section">
                        <dt>Main topics</dt>
                        <dd>
                          {topicsFor(course).join(" \u00B7 ") ||
                            "No topic tags identified in catalog text"}
                        </dd>
                      </div>
                      <div className="sc-comparison-section">
                        <dt>Credits</dt>
                        <dd>{course.creditsLabel}</dd>
                      </div>
                      <div className="sc-comparison-section">
                        <dt>Prerequisites</dt>
                        <dd>
                          <SearchPrerequisiteStatus course={course} evaluation={eligibility[code]} completed={completed} planned={planned} onSelect={(target) => { setComparison(null); onSelectCourse(target); }} />
                          {eligibility[code].hasHighSchool && (
                            <p className="sc-footnote">
                              High school prerequisites are assumed satisfied. Verify that you meet
                              them.
                            </p>
                          )}
                          {eligibility[code].review && (
                            <p className="sc-footnote">
                              Check grade, standing, and permission requirements in the Calendar.
                            </p>
                          )}
                        </dd>
                      </div>
                      <div className="sc-comparison-section">
                        <dt>Corequisites</dt>
                        <dd>{course.corequisiteText || "None listed"}</dd>
                      </div>
                      <div className="sc-comparison-section">
                        <dt>Degree requirements</dt>
                        <dd>
                          {requirementLabels(course).join(" \u00B7 ")}
                          <p className="sc-footnote">
                            Credit categories used by your progress report; subject to program
                            rules.
                          </p>
                        </dd>
                      </div>
                      <div className="sc-comparison-section">
                        <dt>Historical averages &amp; instructors</dt>
                        <dd>
                          <HistoricalStatistics course={course} />
                        </dd>
                      </div>
                    </dl>
                    <a href={course.sourceUrl} target="_blank" rel="noreferrer">
                      Academic Calendar source {"\u2197"}
                    </a>
                    {planButton(code)}
                  </article>
                );
              })}
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
  const [takenEditorOpen, setTakenEditorOpen] = useState(false);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean; hadPopup: boolean } | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState(COURSE_POSITIONS);
  const [mapArea, setMapArea] = useState<MapArea | null>(null);
  const [popupPlacement, setPopupPlacement] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  useLayoutEffect(() => {
    const stage = stageRef.current;
    const card = courseDetailsRef.current;
    const workspace = stage?.parentElement;
    if (!selected || !stage || !card || !workspace) return;
    const place = () => {
      const bounds = workspace.getBoundingClientRect();
      const header = document.querySelector(".topbar")?.getBoundingClientRect();
      const margin = 18;
      const width = Math.min(286, Math.max(0, bounds.width - margin * 2));
      const topLimit = Math.max(margin, (header?.bottom ?? bounds.top) - bounds.top + margin);
      const bottomLimit = bounds.height - margin;
      const obstacles = [...workspace.querySelectorAll(".progress-card, .map-toolbar, .legend")].map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left - bounds.left - margin, right: rect.right - bounds.left + margin, top: rect.top - bounds.top - margin, bottom: rect.bottom - bounds.top + margin };
      });
      const node = [...stage.querySelectorAll<HTMLElement>(".course-node")].find((element) => element.dataset.code === selected)?.getBoundingClientRect();
      const nodeX = node ? (node.left + node.right) / 2 - bounds.left : bounds.width / 2;
      const nodeY = node ? (node.top + node.bottom) / 2 - bounds.top : bounds.height / 2;
      const radius = node ? node.width / 2 : 0;
      const clampX = (x: number) => Math.max(margin, Math.min(bounds.width - margin - width, x));
      const xCandidates = [bounds.width - margin - width, nodeX + radius + margin, nodeX - radius - margin - width, margin, ...obstacles.flatMap((item) => [item.left - width, item.right])].map(clampX);
      const desiredHeight = card.scrollHeight;
      const candidates = xCandidates.flatMap((left, index) => {
        const blocking = obstacles.filter((item) => left < item.right && left + width > item.left).sort((a, b) => a.top - b.top);
        const intervals: { top: number; bottom: number }[] = [];
        let start = topLimit;
        for (const item of blocking) {
          if (item.top > start) intervals.push({ top: start, bottom: Math.min(item.top, bottomLimit) });
          start = Math.max(start, item.bottom);
        }
        if (start < bottomLimit) intervals.push({ top: start, bottom: bottomLimit });
        return intervals.filter((interval) => interval.bottom > interval.top).map((interval) => {
          const maxHeight = interval.bottom - interval.top;
          const height = Math.min(desiredHeight, maxHeight);
          const preferredTop = index === 0 ? topLimit : nodeY - height / 2;
          const top = Math.max(interval.top, Math.min(interval.bottom - height, preferredTop));
          const distance = Math.hypot(left + width / 2 - nodeX, top + height / 2 - nodeY);
          return { left, top, width, maxHeight, full: maxHeight >= desiredHeight, distance, index };
        });
      });
      candidates.sort((a, b) => Number(b.full) - Number(a.full) || (a.full && b.full && (a.index === 0 || b.index === 0) ? a.index - b.index : 0) || (b.full ? a.distance - b.distance : b.maxHeight - a.maxHeight));
      const best = candidates[0];
      if (best) setPopupPlacement({ left: best.left, top: best.top, width: best.width, maxHeight: best.maxHeight });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(workspace);
    workspace.querySelectorAll(".progress-card, .map-toolbar, .legend").forEach((element) => observer.observe(element));
    window.addEventListener("resize", place);
    stage.addEventListener("transitionend", place);
    return () => { observer.disconnect(); window.removeEventListener("resize", place); stage.removeEventListener("transitionend", place); };
  }, [selected, pan, zoom, positions, mapArea, view, planned, completed]);
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const workspace = stage.parentElement!;
      const workspaceBounds = workspace.getBoundingClientRect();
      const legend = workspace.querySelector<HTMLElement>(".legend");
      if (legend) {
        const legendBounds = legend.getBoundingClientRect();
        stage.style.bottom = `${Math.max(0, workspaceBounds.bottom - legendBounds.top + 8)}px`;
      }
      const bounds = stage.getBoundingClientRect();
      const toolbar = workspace.querySelector<HTMLElement>(".map-toolbar");
      const sidebarHeading = document.querySelector<HTMLElement>(".sidebar-header h2");
      if (toolbar && sidebarHeading) {
        const headingBounds = sidebarHeading.getBoundingClientRect();
        const toolbarBounds = toolbar.getBoundingClientRect();
        toolbar.style.top = `${(headingBounds.top + headingBounds.bottom) / 2 - workspaceBounds.top - toolbarBounds.height / 2}px`;
      }
      let left = 16,
        top = 16,
        bottom = bounds.height - 16;
      const obstacles: MapArea["obstacles"] = [];
      stage
        .parentElement!.querySelectorAll(".progress-card, .map-label, .map-toolbar")
        .forEach((element) => {
          const rect = element.getBoundingClientRect();
          if (element.classList.contains("progress-card") || element.classList.contains("map-toolbar"))
            obstacles.push({ left: rect.left - bounds.left, right: rect.right - bounds.left, top: rect.top - bounds.top, bottom: rect.bottom - bounds.top });
          else if (element.classList.contains("map-label"))
            top = Math.max(top, rect.bottom - bounds.top + 18);
        });
      const next = {
        left,
        top,
        right: bounds.width - 16,
        bottom,
        width: bounds.width,
        height: bounds.height,
        obstacles,
      };
      setMapArea((old) => (JSON.stringify(old) === JSON.stringify(next) ? old : next));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    const sidebarHeading = document.querySelector(".sidebar-header h2");
    if (sidebarHeading) observer.observe(sidebarHeading);
    stage
      .parentElement!.querySelectorAll(".progress-card, .map-label, .map-toolbar, .legend")
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

  const goBack = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setCenter(previous.code);
    setHistory((items) => items.slice(0, -1));
    setSelected(null);
    setPositions(previous.positions);
    setPan(previous.pan);
    setZoom(previous.zoom);
  };
  const resetConstellation = () => {
    setView("constellation");
    setCenter("CPSC 110");
    setHistory([]);
    setSelected(null);
    if (mapArea) {
      const fitted = fitNeighborhood("CPSC 110", COURSE_POSITIONS, mapArea, DEFAULT_ZOOM);
      setPositions(fitted.positions);
      setPan(fitted.pan);
      setZoom(fitted.zoom);
    }
  };

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
  const missingPaths = currentDetails ? missingPrerequisitePaths(currentDetails, new Set(completed)) : [];
  const missingExpression = simplifyPrerequisites(missingPaths, new Set());
  const eligibility = useMemo(() => {
    return Object.fromEntries(
      COURSE_LIST.map((course) => [course.code, evaluateWithPlan(course, completed, planned)]),
    );
  }, [completed, planned]);
  const detailEligibility = currentDetails ? eligibility[currentDetails.code] : null;
  const needsManualReview = Boolean(detailEligibility?.review);
  const isEligible = detailEligibility?.state === "satisfied";
  const satisfiedWithPlan = detailEligibility?.state === "with-plan";
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
        : eligibility[code]?.state !== "incomplete"
          ? "satisfied"
          : "available";
  const statusLabel = (code: string) =>
    status(code) === "satisfied"
      ? eligibility[code].state === "with-plan" ? "Prerequisites satisfied with plan" : "Prerequisites satisfied"
      : status(code) === "available"
        ? "Other"
        : status(code);

  return (
    <main className={`app-shell ${view === "search" ? "search-view" : ""}`}>
      <AppHeader
        view={view}
        onReset={resetConstellation}
        onCourseSelect={(code) => {
          focusCourse(code, false);
          setSelected(code);
        }}
        onViewChange={(nextView) => {
          if (nextView === "search") setSelected(null);
          setView(nextView);
        }}
      />
      <section className="map-workspace" aria-label="Course prerequisite map">
        <div className="progress-card glass-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Degree progress</span>
              <h2>
                {requirements[0].done}{" "}
                {requirements[0].plan > 0 && (
                  <span style={{ color: "#e9bd50", fontSize: 17 }}>+{requirements[0].plan} </span>
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
                    <span style={{ color: "#ffffff" }}>{req.done}</span>
                    {req.plan > 0 && <span style={{ color: "#e9bd50" }}> +{req.plan}</span>}
                    <span style={{ color: "#d0cecc" }}> / {req.target}</span>
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
            if (event.button !== 0 || (event.target as Element).closest("button, a, input, select, [role='button']")) return;
            drag.current = { x: event.clientX, y: event.clientY, px: pan.x, py: pan.y, moved: false, hadPopup: Boolean(selected) };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            if (Math.hypot(event.clientX - drag.current.x, event.clientY - drag.current.y) < 5 && !drag.current.moved) return;
            drag.current.moved = true;
            setPan({
              x: drag.current.px + (event.clientX - drag.current.x) / zoom,
              y: drag.current.py + (event.clientY - drag.current.y) / zoom,
            });
          }}
          onPointerUp={() => {
            if (drag.current && !drag.current.moved && !drag.current.hadPopup) goBack();
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
                const startR = layer(from) === 0 ? 55 : layer(from) === 1 ? 44 : 33;
                const endR = layer(to) === 0 ? 64 : layer(to) === 1 ? 54 : 42;
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
                  data-code={code}
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
                  <strong>
                    <CourseCode code={code} />
                  </strong>
                </button>
              );
            })}
          </div>
        </div>

        <div className="map-label">
          <span className="eyebrow">Solar map</span>
          <h1>
            {center} {"\u00B7"} {COURSES[center].title}
          </h1>
          <p>
            Drag to pan {"\u00B7"} Scroll to zoom {"\u00B7"} Select a star to explore
          </p>
        </div>

        <div className="map-toolbar">
                <div className="map-controls glass-panel">
                  <button
                    disabled={!history.length}
                    onClick={goBack}
                  >
                    <Icon name="back" /> Back
                  </button>
                  <span />
                  <button
                    aria-label="Zoom out"
                    onClick={() => setZoom((v) => Math.max(0.35, v - 0.15))}
                  >
                    <Icon name="minus" />
                  </button>
                  <b>{Math.round(zoom * 100)}%</b>
                  <button
                    aria-label="Zoom in"
                    onClick={() => setZoom((v) => Math.min(1.45, v + 0.15))}
                  >
                    <Icon name="plus" />
                  </button>
                  <span />
                  <button
                    onClick={resetConstellation}
                  >
                    <Icon name="reset" /> Reset
                  </button>
                </div>
        </div>

        <div className="map-footer-controls">
          <div className="legend glass-panel">
            <span>
              <i className="satisfied" />
              Prerequisites satisfied (with plan)
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
                <span className="legend-arrow-key">
                  <span style={{ color: "#62e4f4", fontSize: 14 }} aria-hidden="true">
                    &#8594;
                  </span>{" "}
                  Prerequisite
                </span>
                <span className="legend-arrow-key">
                  <span style={{ color: "#ffa65c", fontSize: 14 }} aria-hidden="true">
                    &#8594;
                  </span>{" "}
                  Dependent course
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
              left: popupPlacement?.left ?? 18,
              right: "auto",
              top: popupPlacement?.top ?? 96,
              width: popupPlacement?.width ?? 286,
              padding: 16,
              maxHeight: popupPlacement?.maxHeight ?? 0,
              visibility: popupPlacement ? "visible" : "hidden",
              transform: "none",
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
            {currentDetails.corequisiteText && (
              <div className="prereq-row">
                <span>Corequisites</span>
                <strong>{currentDetails.corequisiteText}</strong>
              </div>
            )}
            {missingPaths.length > 0 && (
              <section className="missing-prerequisites" aria-label="Missing prerequisites">
                <h4>Course prerequisites</h4>
                <RequirementSummary expression={missingExpression} completed={completed} planned={planned} />
                <PrerequisiteGroups expression={missingExpression} completed={completed} planned={planned} onSelect={(code) => focusCourse(code, false)} />
              </section>
            )}
            {missingPaths.length === 0 && detailEligibility?.state === "incomplete" && currentDetails.prerequisiteText && currentDetails.prerequisitePaths.length === 0 && (
              <section className="missing-prerequisites" aria-label="Missing prerequisites">
                <h4>Missing prerequisites</h4>
                <p>Review the Academic Calendar source for requirements that could not be separated into course options.</p>
              </section>
            )}
            {detailEligibility?.hasHighSchool && (
              <p style={{ color: "#e8e6e3", fontSize: 13, lineHeight: 1.55 }}>
                High school prerequisites are assumed satisfied. Please verify that you meet these
                requirements.
              </p>
            )}
            <div className={`eligibility ${isEligible || satisfiedWithPlan ? "eligible" : ""}`}>
              <span className="eligibility-icon">
                <Icon name={isEligible || satisfiedWithPlan ? "check" : "x"} size={15} />
              </span>
              <span>
                <strong>
                  {currentDetails.referenceOnly
                    ? "Reference only"
                    : isEligible
                        ? "Prerequisites satisfied"
                        : satisfiedWithPlan
                          ? "Prerequisites satisfied with plan"
                        : "Prerequisites incomplete"}
                </strong>
                <small>
                  {currentDetails.referenceOnly
                    ? "No current Vancouver course listing"
                    : isEligible
                        ? currentDetails.corequisiteText
                          ? corequisitesMet
                            ? "Prerequisites met; corequisites completed or planned."
                            : "Prerequisites met. Listed corequisites still need to be completed or planned."
                          : "A valid prerequisite pathway is complete"
                        : satisfiedWithPlan
                          ? "Requires completion of the planned prerequisites listed above."
                          : missingPaths.length ? "Complete the missing prerequisite requirements" : "Review the Academic Calendar requirements"}
                </small>
              </span>
            </div>
            {needsManualReview && <p className="additional-requirements">Additional requirements may apply, such as grades, standing or permission. Check the Academic Calendar.</p>}
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
            <h2>Course plan</h2>
          </div>
        </div>
        <section className="list-section">
          <div className="section-title">
            <div>
              <span className="section-icon green">
                <i className="status-dot completed" />
              </span>
              <h3>Courses taken</h3>
            </div>
            <div className="taken-heading-actions">
              <span>{completed.length}</span>
              <button
                className="taken-add"
                aria-label="Add courses taken"
                onClick={() => setTakenEditorOpen(true)}
              >
                <Icon name="plus" size={15} />
              </button>
            </div>
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
                <i className="status-dot planned" />
              </span>
              <h3>Courses planned</h3>
            </div>
            <span>{planned.length}</span>
          </div>
          <PlannedCourseList
            planned={planned}
            completed={completed}
            eligibility={eligibility}
            onSelect={(code) => focusCourse(code, false)}
            onRemove={(code) => setPlanned((items) => items.filter((item) => item !== code))}
          />
        </section>
      </aside>
      {takenEditorOpen && (
        <TakenCoursesEditor
          completed={completed}
          onCancel={() => setTakenEditorOpen(false)}
          onSave={(codes) => {
            setCompleted(codes);
            setPlanned((items) => items.filter((code) => !codes.includes(code)));
            setTakenEditorOpen(false);
          }}
        />
      )}
      <div className="search-view-content" hidden={view !== "search"}>
        <SearchCompare
          planned={planned}
          completed={completed}
          eligibility={eligibility}
          status={status}
          onSelectCourse={(code) => { setView("constellation"); focusCourse(code, false); }}
          addPlan={addPlan}
          removePlan={(code) => setPlanned((items) => items.filter((item) => item !== code))}
        />
      </div>
    </main>
  );
}

export default App;
