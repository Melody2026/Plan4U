import { useLayoutEffect, useMemo, useRef, useState } from "react";

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({
    width: 1000,
    height: 700,
    obstacles: [] as { left: number; right: number; top: number; bottom: number }[],
  });

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const bounds = stage.getBoundingClientRect();
      const obstacles = Array.from(
        stage.parentElement!.querySelectorAll(".progress-card, .map-label, .map-controls, .legend"),
      ).map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left - bounds.left,
          right: rect.right - bounds.left,
          top: rect.top - bounds.top,
          bottom: rect.bottom - bounds.top,
        };
      });
      setViewport((previous) => {
        const next = { width: bounds.width, height: bounds.height, obstacles };
        return JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    stage
      .parentElement!.querySelectorAll(".progress-card, .map-label, .map-controls, .legend")
      .forEach((panel) => observer.observe(panel));
    measure();
    return () => observer.disconnect();
  }, []);

  const direct = useMemo(() => {
    const current = COURSES[center];
    return [...new Set([...getPrerequisites(current), ...getDependents(center)])];
  }, [center]);

  const second = useMemo(() => {
    const expanded = direct.flatMap((code) => [
      ...getPrerequisites(COURSES[code]),
      ...getDependents(code),
    ]);
    return [...new Set(expanded)]
      .filter((code) => code !== center && !direct.includes(code))
      .sort((a, b) => {
        const strength = (code: string) =>
          direct.filter(
            (neighbor) =>
              getPrerequisites(COURSES[code]).includes(neighbor) ||
              getPrerequisites(COURSES[neighbor]).includes(code),
          ).length;
        return strength(b) - strength(a) || a.localeCompare(b);
      })
      .slice(0, 6);
  }, [center, direct]);

  const visible = [center, ...direct, ...second];
  const connections = useMemo(() => {
    const primary = direct.map((code) =>
      getPrerequisites(COURSES[center]).includes(code)
        ? { from: code, to: center }
        : { from: center, to: code },
    );
    // One real prerequisite link per secondary star keeps branches readable.
    const secondary = second.flatMap((code) => {
      const parent = direct.find(
        (neighbor) =>
          getPrerequisites(COURSES[code]).includes(neighbor) ||
          getPrerequisites(COURSES[neighbor]).includes(code),
      );
      if (!parent) return [];
      return [
        getPrerequisites(COURSES[code]).includes(parent)
          ? { from: parent, to: code }
          : { from: code, to: parent },
      ];
    });
    return [...primary, ...secondary];
  }, [center, direct, second]);

  const positions = useMemo(() => {
    const { width, height, obstacles } = viewport;
    const hash = (code: string) => {
      let value = 2166136261;
      for (const char of code) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
      return (value >>> 0) / 4294967296;
    };
    const codes = [center, ...direct.slice().sort(), ...second.slice().sort()];
    const result: Record<string, { x: number; y: number; layer: number }> = {};
    const radius = (code: string) => (code === center ? 72 : direct.includes(code) ? 57 : 39);
    // Project complete node/label footprints out of the interface panels.
    const constrain = (code: string) => {
      const node = result[code];
      const r = radius(code);
      for (let pass = 0; pass < 4; pass++) {
        node.x = Math.max(r + 12, Math.min(width - r - 12, node.x));
        node.y = Math.max(r + 14, Math.min(height - r - 14, node.y));
        for (const box of obstacles) {
          const left = box.left - r - 12,
            right = box.right + r + 12;
          const top = box.top - r - 12,
            bottom = box.bottom + r + 12;
          if (node.x <= left || node.x >= right || node.y <= top || node.y >= bottom) continue;
          const choices = [
            { x: left, y: node.y },
            { x: right, y: node.y },
            { x: node.x, y: top },
            { x: node.x, y: bottom },
          ].filter(
            (p) =>
              p.x >= r + 12 && p.x <= width - r - 12 && p.y >= r + 14 && p.y <= height - r - 14,
          );
          choices.sort(
            (a, b) =>
              Math.hypot(a.x - node.x, a.y - node.y) - Math.hypot(b.x - node.x, b.y - node.y),
          );
          if (choices[0]) Object.assign(node, choices[0]);
        }
      }
    };
    result[center] = { x: width * 0.55, y: height * 0.56, layer: 0 };
    constrain(center);
    const origin = { ...result[center] };
    for (const code of codes.slice(1)) {
      const layer = direct.includes(code) ? 1 : 2;
      const parent =
        layer === 1
          ? center
          : direct.find(
              (neighbor) =>
                getPrerequisites(COURSES[code]).includes(neighbor) ||
                getPrerequisites(COURSES[neighbor]).includes(code),
            ) || center;
      const anchor = result[parent] || origin;
      const angle = hash(code) * Math.PI * 2;
      const distance = (layer === 1 ? 185 : 135) + hash(code + center) * 160;
      result[code] = {
        x: anchor.x + Math.cos(angle) * distance,
        y: anchor.y + Math.sin(angle) * distance,
        layer,
      };
      constrain(code);
    }
    const edges = connections;
    // Seeded starting points + a fixed iteration count keep repeated selections stable.
    for (let iteration = 0; iteration < 260; iteration++) {
      const forces = Object.fromEntries(codes.map((code) => [code, { x: 0, y: 0 }]));
      for (let i = 0; i < codes.length; i++) {
        for (let j = i + 1; j < codes.length; j++) {
          const a = codes[i],
            b = codes[j];
          const dx = result[b].x - result[a].x || 0.01;
          const dy = result[b].y - result[a].y || 0.01;
          const distance = Math.hypot(dx, dy);
          const spacing = radius(a) + radius(b) + 48;
          const push = Math.max(0, spacing - distance) * 0.34 + 720 / (distance * distance);
          forces[a].x -= (dx / distance) * push;
          forces[a].y -= (dy / distance) * push;
          forces[b].x += (dx / distance) * push;
          forces[b].y += (dy / distance) * push;
        }
      }
      for (const { from, to } of edges) {
        const a = result[from],
          b = result[to];
        const dx = b.x - a.x,
          dy = b.y - a.y;
        const distance = Math.hypot(dx, dy) || 1;
        const desired = radius(from) + radius(to) + 100 + hash(from + to) * 95;
        const pull = (distance - desired) * 0.025;
        forces[from].x += (dx / distance) * pull;
        forces[from].y += (dy / distance) * pull;
        forces[to].x -= (dx / distance) * pull;
        forces[to].y -= (dy / distance) * pull;
        // Keep unrelated stars and their labels away from connecting lines.
        for (const code of codes) {
          if (code === from || code === to || code === center) continue;
          const n = result[code];
          const t = Math.max(
            0.08,
            Math.min(0.92, ((n.x - a.x) * dx + (n.y - a.y) * dy) / (distance * distance)),
          );
          const ox = n.x - a.x - t * dx,
            oy = n.y - a.y - t * dy;
          const gap = Math.hypot(ox, oy) || 1;
          const push = Math.max(0, radius(code) + 24 - gap) * 0.08;
          forces[code].x += (ox / gap) * push;
          forces[code].y += (oy / gap) * push;
        }
      }
      for (const code of codes.slice(1)) {
        const node = result[code];
        const force = forces[code];
        node.x += Math.max(-9, Math.min(9, force.x + (origin.x - node.x) * 0.0008));
        node.y += Math.max(-9, Math.min(9, force.y + (origin.y - node.y) * 0.0008));
        constrain(code);
      }
    }
    // Resolve remaining label collisions after the spring forces settle.
    for (let pass = 0; pass < 120; pass++) {
      let overlaps = 0;
      for (let i = 0; i < codes.length; i++) {
        for (let j = i + 1; j < codes.length; j++) {
          const a = codes[i],
            b = codes[j];
          const first = result[a],
            last = result[b];
          const dx = last.x - first.x,
            dy = last.y - first.y;
          const distance = Math.hypot(dx, dy);
          const minimum = radius(a) + radius(b) + 12;
          if (distance >= minimum) continue;
          overlaps++;
          const angle = distance < 0.01 ? hash(a + b) * Math.PI * 2 : Math.atan2(dy, dx);
          const shift = minimum - distance + 1;
          const share = a === center ? 0 : 0.5;
          first.x -= Math.cos(angle) * shift * share;
          first.y -= Math.sin(angle) * shift * share;
          last.x += Math.cos(angle) * shift * (1 - share);
          last.y += Math.sin(angle) * shift * (1 - share);
          if (a !== center) constrain(a);
          constrain(b);
        }
      }
      if (!overlaps) break;
    }
    return result;
  }, [center, direct, second, viewport, connections]);

  const focusCourse = (code: string, showDetails = true) => {
    if (code !== center) {
      setHistory((items) => [...items, center]);
      setCenter(code);
      setPan({ x: 0, y: 0 });
      setZoom(1);
    }
    setSelected(showDetails ? code : null);
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
              width: viewport.width,
              height: viewport.height,
              left: "50%",
              top: "50%",
              transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
            }}
          >
            <svg className="connection-layer" viewBox={`0 0 ${viewport.width} ${viewport.height}`}>
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
                const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
                const startR = a.layer === 0 ? 53 : a.layer === 1 ? 43 : 32;
                const endR = b.layer === 0 ? 62 : b.layer === 1 ? 52 : 40;
                return (
                  <line
                    style={{ transition: "all 0.7s cubic-bezier(0.2, 0.8, 0.2, 1)" }}
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
          <article
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
                    <strong>{code}</strong>
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
                    <strong>{code}</strong>
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
    </main>
  );
}

export default App;
