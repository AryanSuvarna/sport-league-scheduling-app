export type RuleStrength = "hard" | "soft";

export type SchedulerRule =
  | { id: string; type: "games_per_pair"; value: number }
  | { id: string; type: "max_matches_per_team_per_week"; value: number }
  | { id: string; type: "max_matches_per_team_per_day"; value: number }
  | { id: string; type: "min_rest_hours"; value: number }
  | { id: string; type: "avoid_dates"; dates: string[]; strength: RuleStrength };

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function validNumber(value: unknown, minimum: number, maximum: number) {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum;
}

function isRule(value: unknown): value is SchedulerRule {
  if (!value || typeof value !== "object") return false;
  const rule = value as Record<string, unknown>;
  if (typeof rule.id !== "string" || !rule.id) return false;
  if (rule.type === "games_per_pair") return validNumber(rule.value, 1, 10);
  if (rule.type === "max_matches_per_team_per_week") return validNumber(rule.value, 1, 7);
  if (rule.type === "max_matches_per_team_per_day") return validNumber(rule.value, 1, 4);
  if (rule.type === "min_rest_hours") return validNumber(rule.value, 0, 168);
  return rule.type === "avoid_dates" &&
    (rule.strength === "hard" || rule.strength === "soft") &&
    Array.isArray(rule.dates) && rule.dates.length > 0 && rule.dates.every((date) => typeof date === "string" && datePattern.test(date));
}

export function parseSchedulerRules(value: unknown): SchedulerRule[] | null {
  return Array.isArray(value) && value.every(isRule) ? value : null;
}

export function defaultRule(type: SchedulerRule["type"]): SchedulerRule {
  const id = `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  switch (type) {
    case "games_per_pair": return { id, type, value: 1 };
    case "max_matches_per_team_per_week": return { id, type, value: 1 };
    case "max_matches_per_team_per_day": return { id, type, value: 1 };
    case "min_rest_hours": return { id, type, value: 0 };
    case "avoid_dates": return { id, type, dates: [], strength: "hard" };
  }
}

export function withWeeklyMatchLimit(rules: SchedulerRule[], fallback = 1): SchedulerRule[] {
  return rules.some((rule) => rule.type === "max_matches_per_team_per_week")
    ? rules
    : [{ id: "weekly-match-limit", type: "max_matches_per_team_per_week", value: fallback }, ...rules];
}

export function ruleSummary(rule: SchedulerRule) {
  switch (rule.type) {
    case "games_per_pair": return `${rule.value} game${rule.value === 1 ? "" : "s"} per pairing`;
    case "max_matches_per_team_per_week": return `At most ${rule.value} match${rule.value === 1 ? "" : "es"} per team per week`;
    case "max_matches_per_team_per_day": return `At most ${rule.value} match${rule.value === 1 ? "" : "es"} per team per day`;
    case "min_rest_hours": return `At least ${rule.value} rest hour${rule.value === 1 ? "" : "s"}`;
    case "avoid_dates": return `${rule.strength === "hard" ? "Never schedule" : "Avoid when possible"} on ${rule.dates.length} selected date${rule.dates.length === 1 ? "" : "s"}`;
  }
}
