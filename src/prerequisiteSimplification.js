// A monotone prerequisite expression: conjunctions, alternatives, and exact
// minimum-count groups. Every transformation preserves the original pathways.
export function simplifyPrerequisites(paths, completed = new Set()) {
  const normalize = (items) => {
    const unique = [...new Map(items.map(p => { const q = [...new Set(p)].sort(); return [JSON.stringify(q), q]; })).values()];
    return unique.filter((p, i) => !unique.some((q, j) => i !== j && q.length < p.length && q.every(c => p.includes(c))));
  };
  const and = (children) => { const flat = children.flatMap(c => c.type === 'and' ? c.children : [c]).filter(c => c.type !== 'true'); return flat.length === 0 ? {type:'true'} : flat.length === 1 ? flat[0] : {type:'and', children:flat}; };
  const factor = (input) => {
    const p = normalize(input);
    if (!p.length) return {type:'false'};
    if (p.some(x => !x.length)) return {type:'true'};
    const common = p[0].filter(c => p.every(x => x.includes(c)));
    if (common.length) return and([{type:'count', count:common.length, codes:common}, factor(p.map(x => x.filter(c => !common.includes(c))))]);
    const codes = [...new Set(p.flat())].sort();
    const k = p[0].length;
    let combinations = 1;
    for (let i = 1; i <= k; i++) combinations = combinations * (codes.length - i + 1) / i;
    if (p.every(x => x.length === k) && p.length === Math.round(combinations)) return {type:'count', count:k, codes};
    // A product of projections is independent only if it reconstructs the DNF exactly.
    if (codes.length <= 12) {
      const expected = JSON.stringify(p.map(x => JSON.stringify(x)).sort());
      for (let mask = 1; mask < (1 << (codes.length - 1)); mask++) {
        const left = new Set(codes.filter((_, i) => mask & (1 << i)));
        const a = normalize(p.map(x => x.filter(c => left.has(c))));
        const b = normalize(p.map(x => x.filter(c => !left.has(c))));
        if (a.some(x => !x.length) || b.some(x => !x.length)) continue;
        const product = normalize(a.flatMap(x => b.map(y => [...x, ...y])));
        if (JSON.stringify(product.map(x => JSON.stringify(x)).sort()) === expected) return and([factor(a), factor(b)]);
      }
    }
    // Factor a frequent course recursively rather than enumerate the original paths.
    const pivot = codes.map(code => ({code, n:p.filter(x => x.includes(code)).length})).sort((a,b) => b.n-a.n)[0].code;
    const containing = p.filter(x => x.includes(pivot)).map(x => x.filter(c => c !== pivot));
    const other = p.filter(x => !x.includes(pivot));
    return {type:'or', children:[and([{type:'count', count:1, codes:[pivot]}, factor(containing)]), factor(other)]};
  };
  if (!paths.length) return {type:'true'};
  return factor(paths.map(path => path.filter(code => !completed.has(code))));
}
