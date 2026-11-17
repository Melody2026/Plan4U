import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(new URL("../src/completedPrerequisites.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText;
const { inferCompletedPrerequisites: infer } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);
const course = (paths = [], extra = {}) => ({ prerequisitePaths: paths, ...extra });
const catalog = {
  A: course([["B", "C"]]),
  B: course([["D"]]),
  C: course([["D"]]),
  D: course(),
  OR: course([["B"], ["C"]]),
  COMMON: course([
    ["B", "D"],
    ["C", "D"],
  ]),
  MANUAL: course([["B"]], { manual: true }),
  CORE: course([], { corequisiteGroups: [["B"]] }),
  HS: course([["High school calculus"]]),
};
const allowed = (c) => !c.manual;
test("AND requirements recurse and diamond prerequisites remain unique", () => {
  const result = infer("A", new Set(), catalog, allowed);
  assert.deepEqual([...result.selected].sort(), ["A", "B", "C", "D"]);
  assert.equal(result.inferred.size, 3);
});
test("unresolved OR alternatives are not guessed; common AND requirements are inferred", () => {
  assert.deepEqual([...infer("OR", new Set(), catalog, allowed).selected], ["OR"]);
  assert.deepEqual([...infer("COMMON", new Set(), catalog, allowed).selected].sort(), [
    "COMMON",
    "D",
  ]);
});
test("selected OR alternative is retained without adding the other", () => {
  const selected = infer("OR", new Set(["C"]), catalog, allowed).selected;
  assert.equal(selected.has("B"), false);
  assert.equal(selected.has("C"), true);
  assert.equal(selected.has("D"), true);
});
test("manual, corequisite and high-school requirements do not become completed courses", () => {
  for (const code of ["MANUAL", "CORE", "HS"])
    assert.deepEqual([...infer(code, new Set(), catalog, allowed).selected], [code]);
});
test("cycles terminate and student corrections override inference", () => {
  const cyclic = { ...catalog, D: course([["A"]]) };
  assert.equal(infer("A", new Set(), cyclic, allowed).selected.size, 4);
  const result = infer("A", new Set(), catalog, allowed, new Set(["B", "D"]));
  assert.deepEqual([...result.selected].sort(), ["A", "C"]);
});
