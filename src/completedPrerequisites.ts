import type { Course } from "./data/courses";

export function inferCompletedPrerequisites(
  code: string,
  current: ReadonlySet<string>,
  catalog: Record<string, Course>,
  canInfer: (course: Course) => boolean,
  suppressed: ReadonlySet<string> = new Set(),
) {
  const selected = new Set(current);
  const inferred = new Set<string>();
  const visited = new Set<string>();
  const visit = (next: string) => {
    if (visited.has(next)) return;
    visited.add(next);
    const course = catalog[next];
    if (!course || !canInfer(course) || !course.prerequisitePaths.length) return;
    const paths = course.prerequisitePaths;
    // Keep a completed alternative. Otherwise infer only requirements common
    // to every path, leaving the alternative choice to the student.
    const satisfied = paths.find((path) => path.every((item) => selected.has(item)));
    const required =
      satisfied ?? paths[0].filter((item) => paths.every((path) => path.includes(item)));
    for (const item of required) {
      if (!catalog[item] || suppressed.has(item)) continue;
      if (!selected.has(item)) {
        selected.add(item);
        inferred.add(item);
      }
      visit(item);
    }
  };
  selected.add(code);
  visit(code);
  return { selected, inferred };
}
