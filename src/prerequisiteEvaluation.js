const highSchoolPattern = /(?:principles of mathematics|pre[- ]calculus|high school(?: calculus| biology)?|AP Calculus(?: AB| BC)?|(?:CALC|ENGL|CHEM|PHYS|BIOL|MATH)\s+(?:11|12)\b)/i;
export function evaluatePrerequisites(course, taken) {
  const hasHighSchool = highSchoolPattern.test(course.prerequisiteText);
  const text = course.prerequisiteText.replace(/This course is not eligible[\s\S]*/i, '').replace(/(?:Principles of Mathematics|Pre[- ]calculus|CALC|ENGL|CHEM|PHYS|BIOL|MATH)\s+(?:11|12)\b|AP Calculus(?: AB| BC)?|High School Biology/gi, ' HIGHSCHOOL ').replace(/High school calculus is strongly recommended\.?/gi, '').replace(/\b([A-Z]{2,5})_V\s+(\d{3})/g, '$1 $2');
  const review = (course.manualRequirement && !(hasHighSchool && !/[A-Z]{2,5}(?:_O)?\s+\d{3}/.test(text))) || /(?:score of|minimum grade|advanced credit|as a co-?requisite|credit exclusion|standing|permission|credits (?:of|from|beyond))/i.test(text.replace(/[^.]*HIGHSCHOOL[^.]*(?:\.|$)/g, part => /[A-Z]{2,5}(?:_O)?\s+\d{3}/.test(part) ? part : ''));
  const evaluateText = value => {
    const alternatives = value.split(/\bor\s+\(?[a-d]\)/i);
    if (alternatives.length > 1) return alternatives.some(evaluateText);
    const conjunctions = value.split(/\band\b|;/i).filter(part => /HIGHSCHOOL|[A-Z]{2,5}(?:_O)?\s+\d{3}/.test(part));
    if (conjunctions.length > 1) return conjunctions.every(evaluateText);
    const codes = value.match(/[A-Z]{2,5}(?:_O)?\s+\d{3}/g) || [];
    const options = [...codes.map(code => taken.has(code)), ...(value.includes('HIGHSCHOOL') ? [true] : [])];
    if (!options.length) return true;
    return /one of|either|\bor\b/i.test(value) ? options.some(Boolean) : options.every(Boolean);
  };
  const met = course.prerequisitePaths.length ? course.prerequisitePaths.some(path => path.every(code => taken.has(code) || highSchoolPattern.test(code))) : !course.prerequisiteText || evaluateText(text);
  return { met, review, hasHighSchool };
}
export function evaluateWithPlan(course, completed, planned) {
  const taken = new Set(completed);
  const current = evaluatePrerequisites(course, taken);
  const contributors = new Set(planned.filter(code => !taken.has(code) && code !== course.code));
  const withPlan = evaluatePrerequisites(course, new Set([...taken, ...contributors]));
  const state = current.met ? 'satisfied' : withPlan.met ? 'with-plan' : 'incomplete';
  if (state === 'with-plan') for (const code of contributors) {
    const trial = new Set([...taken, ...contributors]); trial.delete(code);
    if (evaluatePrerequisites(course, trial).met) contributors.delete(code);
  }
  return { ...current, state, plannedContributors: state === 'with-plan' ? [...contributors] : [] };
}
export function hasUnresolvedChain(code, catalog, completed, planned, visiting = new Set()) {
  if (completed.includes(code)) return false;
  if (visiting.has(code) || !catalog[code]) return true;
  const course = catalog[code];
  if (evaluateWithPlan(course, completed, []).state === 'satisfied') return false;
  const next = new Set(visiting); next.add(code);
  const references = new Set([...course.prerequisitePaths.flat(), ...(course.prerequisiteText.replace(/\b([A-Z]{2,5})_V\s+(\d{3})/g, '$1 $2').match(/\b[A-Z]{2,5}\s+\d{3}\b/g) || [])]);
  const usable = planned.filter(item => item !== code && references.has(item) && !hasUnresolvedChain(item, catalog, completed, planned, next));
  return evaluateWithPlan(course, completed, usable).state === 'incomplete';
}
