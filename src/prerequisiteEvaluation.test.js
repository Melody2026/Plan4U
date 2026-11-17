import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePrerequisites, evaluateWithPlan, hasUnresolvedChain } from './prerequisiteEvaluation.js';
import { simplifyPrerequisites } from './prerequisiteSimplification.js';

const course = (code, paths = [], manualRequirement = false, prerequisiteText = '') => ({ code, prerequisitePaths: paths, manualRequirement, prerequisiteText });
const cpsc221 = course('CPSC 221', [
  ['CPSC 210', 'CPSC 121'], ['CPSC 210', 'MATH 220'], ['CPSC 210', 'MATH 226'],
  ['CPEN 221', 'CPSC 121'], ['CPEN 221', 'MATH 220'], ['CPEN 221', 'MATH 226'],
], true, 'One of CPSC_V 210, CPEN_V 221 and either CPSC_V 121, MATH_V 220 or a score of 68% in MATH_V 226.');

test('course satisfaction remains separate from manual requirements', () => {
  assert.deepEqual(evaluateWithPlan(cpsc221, [], ['CPSC 210', 'CPSC 121']).state, 'with-plan');
  assert.equal(evaluateWithPlan(cpsc221, ['CPSC 210', 'CPSC 121'], []).state, 'satisfied');
  assert.equal(evaluateWithPlan(cpsc221, [], ['CPSC 210']).state, 'incomplete');
  assert.equal(evaluatePrerequisites(cpsc221, new Set(['CPSC 210', 'CPSC 121'])).review, true);
  assert.equal(evaluateWithPlan(course('X', [], true, 'Permission of instructor.'), [], []).state, 'satisfied');
});
test('alternative groups factor without making every option mandatory', () => {
  const expr = simplifyPrerequisites(cpsc221.prerequisitePaths);
  assert.equal(expr.type, 'and');
  assert.deepEqual(expr.children.map(x => x.count), [1, 1]);
  assert.equal(evaluateWithPlan(cpsc221, [], ['CPEN 221', 'MATH 220']).state, 'with-plan');
  assert.equal(evaluateWithPlan(cpsc221, ['CPEN 221', 'MATH 226'], []).state, 'satisfied');
});
test('chains require reachable prerequisites and accept a viable alternative', () => {
  const catalog = {
    A: course('A', [['B'], ['C']]),
    B: course('B', [['D']]),
    C: course('C'),
    D: course('D'),
  };
  assert.equal(hasUnresolvedChain('A', catalog, [], ['A', 'B']), true);
  assert.equal(hasUnresolvedChain('A', catalog, [], ['A', 'B', 'D']), false);
  assert.equal(hasUnresolvedChain('A', catalog, [], ['A', 'B', 'C']), false);
  assert.equal(hasUnresolvedChain('A', catalog, ['B'], ['A']), false);
  const cycle = { A: course('A', [['B']]), B: course('B', [['A']]) };
  assert.equal(hasUnresolvedChain('A', cycle, [], ['A', 'B']), true);
});
