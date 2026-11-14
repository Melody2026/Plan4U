import { useMemo, useRef, useState } from "react";

import { COURSE_LIST, COURSES, type Course } from "./data/courses";

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

function App() {
  const [completed, setCompleted] = useState(["CPSC 110", "MATH 100", "ENGL 110"]);
  const [planned, setPlanned] = useState(["CPSC 210", "MATH 101"]);
  const [center, setCenter] = useState("CPSC 110");
  const [history, setHistory] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const direct = useMemo(() => {
    const current = COURSES[center];
    return [...new Set([...getPrerequisites(current), ...getDependents(center)])];
  }, [center]);

  const second = useMemo(() => {
    const expanded = direct.flatMap((code) => [
      ...getPrerequisites(COURSES[code]),
      ...getDependents(code),
    ]);
    return [...new Set(expanded)].filter((code) => code !== center && !direct.includes(code));
  }, [center, direct]);

  const positions = useMemo(() => {
    const result: Record<string, { x: number; y: number; layer: number }> = {
      [center]: { x: 500, y: 350, layer: 0 },
    };
    direct.forEach((code, i) => {
      const angle = -Math.PI / 2 + (i * Math.PI * 2) / Math.max(direct.length, 1);
      result[code] = { x: 500 + Math.cos(angle) * 205, y: 350 + Math.sin(angle) * 180, layer: 1 };
    });
    second.forEach((code, i) => {
      const angle = -Math.PI / 2 + 0.38 + (i * Math.PI * 2) / Math.max(second.length, 1);
      result[code] = { x: 500 + Math.cos(angle) * 375, y: 350 + Math.sin(angle) * 292, layer: 2 };
    });
    return result;
  }, [center, direct, second]);

  const visible = [center, ...direct, ...second];
  const connections = visible.flatMap((code) =>
    getPrerequisites(COURSES[code])
      .filter((pre) => visible.includes(pre))
      .map((pre) => ({ from: pre, to: code })),
  );

  const focusCourse = (code: string, showDetails = true) => {
    if (code !== center) setHistory((items) => [...items, center]);
    setCenter(code);
    setSelected(showDetails ? code : null);
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };

  const addCompleted = () => {
    const normalized = Object.keys(COURSES).find(
      (code) => code.toLowerCase() === query.trim().toLowerCase(),
    );
    if (!normalized || completed.includes(normalized)) return;
    setCompleted((items) => [...items, normalized]);
    setPlanned((items) => items.filter((code) => code !== normalized));
    setQuery("");
  };

  const addPlan = (code: string) => {
    if (!completed.includes(code) && !planned.includes(code))
      setPlanned((items) => [...items, code]);
  };

  const requirements = useMemo(() => {
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
        done: sum(completed, () => true),
        plan: sum(planned, () => true),
      },
      {
        label: "Major",
        short: "Major",
        target: 42,
        done: sum(completed, (c) => c.category === "Major"),
        plan: sum(planned, (c) => c.category === "Major"),
      },
      {
        label: "Science",
        short: "Science",
        target: 24,
        done: sum(completed, (c) => c.category === "Science"),
        plan: sum(planned, (c) => c.category === "Science"),
      },
      {
        label: "Elective",
        short: "Elective",
        target: 18,
        done: sum(completed, (c) => c.category === "Elective"),
        plan: sum(planned, (c) => c.category === "Elective"),
      },
      {
        label: "Upper-level",
        short: "Upper",
        target: 30,
        done: sum(completed, (c) => c.level >= 300),
        plan: sum(planned, (c) => c.level >= 300),
      },
    ];
  }, [completed, planned]);

  const currentDetails = selected ? COURSES[selected] : null;
  const prerequisitesMet = currentDetails
    ? !currentDetails.prerequisiteText ||
      currentDetails.prerequisitePaths.some((path) =>
        path.every((code) => completed.includes(code)),
      )
    : false;
  const corequisitesMet = currentDetails
    ? currentDetails.corequisiteGroups.every((group) =>
        group.some((code) => completed.includes(code) || planned.includes(code)),
      )
    : false;
  const needsManualReview = Boolean(
    currentDetails &&
    (currentDetails.manualRequirement ||
      (currentDetails.prerequisiteText && !currentDetails.prerequisitePaths.length)),
  );
  const isEligible = prerequisitesMet && corequisitesMet && !needsManualReview;
  const status = (code: string) =>
    completed.includes(code) ? "completed" : planned.includes(code) ? "planned" : "available";

  return (
    <main className="app-shell">
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
          <div className="term-pill">
            <span /> 2025W planning
          </div>
        </header>

        <div className="progress-card glass-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Degree progress</span>
              <h2>
                {requirements[0].done} <small>/ 120 credits</small>
              </h2>
            </div>
            <div className="degree-badge">
              {Math.min(100, Math.round((requirements[0].done / requirements[0].target) * 100))}%
            </div>
          </div>
          <div className="requirement-list">
            {requirements.map((req) => (
              <div className="requirement" key={req.label}>
                <div className="requirement-meta">
                  <span>{req.short}</span>
                  <span>
                    {req.done + req.plan}/{req.target}
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
          className="graph-stage"
          onWheel={(event) => {
            event.preventDefault();
            setZoom((value) => Math.min(1.45, Math.max(0.65, value - event.deltaY * 0.001)));
          }}
          onPointerDown={(event) => {
            if ((event.target as HTMLElement).closest("button")) return;
            drag.current = { x: event.clientX, y: event.clientY, px: pan.x, py: pan.y };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            setPan({
              x: drag.current.px + event.clientX - drag.current.x,
              y: drag.current.py + event.clientY - drag.current.y,
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
              transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
            }}
          >
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <svg className="connection-layer" viewBox="0 0 1000 700">
              <defs>
                <marker
                  id="arrow"
                  markerWidth="8"
                  markerHeight="8"
                  refX="6"
                  refY="3"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M0,0 L0,6 L7,3 z" fill="#7d8ba9" />
                </marker>
              </defs>
              {connections.map(({ from, to }) => {
                const a = positions[from];
                const b = positions[to];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const length = Math.sqrt(dx * dx + dy * dy);
                const startR = a.layer === 0 ? 53 : a.layer === 1 ? 43 : 32;
                const endR = b.layer === 0 ? 62 : b.layer === 1 ? 52 : 40;
                return (
                  <line
                    key={`${from}-${to}`}
                    x1={a.x + (dx / length) * startR}
                    y1={a.y + (dy / length) * startR}
                    x2={b.x - (dx / length) * endR}
                    y2={b.y - (dy / length) * endR}
                    className={
                      a.layer === 2 || b.layer === 2 ? "connection secondary" : "connection"
                    }
                    markerEnd="url(#arrow)"
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
                  className={`course-node layer-${pos.layer} ${nodeStatus}`}
                  style={{ left: pos.x, top: pos.y }}
                  onClick={(event) => {
                    event.stopPropagation();
                    focusCourse(code);
                  }}
                  aria-label={`View ${code}, ${COURSES[code].title}`}
                >
                  <span className="node-glow" />
                  <span className="node-core">
                    {pos.layer === 0 && <span className="center-dot" />}
                  </span>
                  <strong>{code}</strong>
                  {pos.layer < 2 && <small>{COURSES[code].title}</small>}
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
              setCenter(previous);
              setHistory((items) => items.slice(0, -1));
              setSelected(null);
              setPan({ x: 0, y: 0 });
              setZoom(1);
            }}
          >
            <Icon name="back" /> Back
          </button>
          <span />
          <button aria-label="Zoom out" onClick={() => setZoom((v) => Math.max(0.65, v - 0.15))}>
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
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
          >
            <Icon name="reset" /> Reset
          </button>
        </div>

        <div className="legend glass-panel">
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
        </div>

        {currentDetails && (
          <article className="detail-card glass-panel">
            <button
              className="close-button"
              onClick={() => setSelected(null)}
              aria-label="Close course details"
            >
              <Icon name="x" />
            </button>
            <div className="detail-topline">
              <span className={`status-chip ${status(currentDetails.code)}`}>
                {status(currentDetails.code)}
              </span>
              <span>
                {currentDetails.creditsLabel === "1"
                  ? "1 credit"
                  : `${currentDetails.creditsLabel} credits`}
              </span>
            </div>
            <h2>{currentDetails.code}</h2>
            <h3>{currentDetails.title}</h3>
            <p>{currentDetails.description}</p>
            <div className="course-stats">
              <div>
                <span>Avg. grade</span>
                <strong>Not published</strong>
              </div>
              <div>
                <span>Professor</span>
                <strong>Varies by section</strong>
              </div>
            </div>
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
                        ? "A valid prerequisite pathway is complete"
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
          <div className="course-search">
            <Icon name="search" size={17} />
            <input
              value={query}
              onChange={(e) => {
                const value = e.target.value;
                setQuery(value);
                const exact = COURSES[value.trim().toUpperCase()];
                if (exact) focusCourse(exact.code);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") addCompleted();
              }}
              list="course-options"
              placeholder="Search course code"
            />
            <datalist id="course-options">
              {COURSE_LIST.filter((course) => !completed.includes(course.code)).map((course) => (
                <option key={course.code} value={course.code}>
                  {course.title}
                </option>
              ))}
            </datalist>
            <button onClick={addCompleted}>Add</button>
          </div>
          <div className="course-list">
            {completed.map((code) => (
              <div className="list-item" key={code}>
                <button className="course-link" onClick={() => focusCourse(code, false)}>
                  <i className="status-dot completed" />
                  <span>
                    <strong>{code}</strong>
                    <small>{COURSES[code].title}</small>
                  </span>
                </button>
                <button
                  className="remove-button"
                  onClick={() => setCompleted((items) => items.filter((item) => item !== code))}
                  aria-label={`Remove ${code} from courses taken`}
                  title="Remove from courses taken"
                >
                  <Icon name="minus" size={14} />
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
                    <strong>{code}</strong>
                    <small>{COURSES[code].title}</small>
                  </span>
                </button>
                <button
                  className="remove-button"
                  onClick={() => setPlanned((items) => items.filter((item) => item !== code))}
                  aria-label={`Remove ${code} from plan`}
                  title="Remove from course plan"
                >
                  <Icon name="minus" size={14} />
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
    </main>
  );
}

export default App;
