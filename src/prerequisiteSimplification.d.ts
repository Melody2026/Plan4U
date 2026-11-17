export type PrerequisiteExpression =
  | { type: "true" }
  | { type: "false" }
  | { type: "count"; count: number; codes: string[] }
  | { type: "and" | "or"; children: PrerequisiteExpression[] };

export function simplifyPrerequisites(
  paths: string[][],
  completed?: ReadonlySet<string>,
): PrerequisiteExpression;
