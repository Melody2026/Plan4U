import type { Course } from './data/courses';
export type PrerequisiteStatus = { met: boolean; review: boolean; hasHighSchool: boolean; state: 'satisfied' | 'with-plan' | 'incomplete'; plannedContributors: string[] };
export function evaluatePrerequisites(course: Course, taken: ReadonlySet<string>): Omit<PrerequisiteStatus, 'state' | 'plannedContributors'>;
export function evaluateWithPlan(course: Course, completed: readonly string[], planned: readonly string[]): PrerequisiteStatus;
export function hasUnresolvedChain(code: string, catalog: Record<string, Course>, completed: readonly string[], planned: readonly string[]): boolean;
