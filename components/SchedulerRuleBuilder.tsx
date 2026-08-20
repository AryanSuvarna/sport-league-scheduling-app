"use client";

import { Plus, Trash2 } from "lucide-react";
import { type SchedulerRule, defaultRule, ruleSummary } from "@/lib/scheduling/rules";

type Props = { rules: SchedulerRule[]; onChange: (rules: SchedulerRule[]) => void };

const ruleOptions = [
  { type: "games_per_pair", label: "Games per pairing" },
  { type: "max_matches_per_team_per_week", label: "Weekly team match limit" },
  { type: "max_matches_per_team_per_day", label: "Daily team match limit" },
  { type: "min_rest_hours", label: "Minimum rest between games" },
  { type: "avoid_dates", label: "Avoid dates" },
] as const;

export function SchedulerRuleBuilder({ rules, onChange }: Props) {
  const selectedTypes = new Set(rules.map((rule) => rule.type));
  const available = ruleOptions.filter((option) => !selectedTypes.has(option.type));

  function update(ruleId: string, nextRule: SchedulerRule) {
    onChange(rules.map((rule) => rule.id === ruleId ? nextRule : rule));
  }

  return <section className="rounded-md border border-[#d6ded5] bg-[#fbfcfa] p-4">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div><h3 className="text-base font-semibold text-[#18211c]">Scheduler rules</h3><p className="mt-1 text-sm text-[#637066]">These rules are enforced when a schedule is generated</p></div>
      {available.length > 0 ? <select aria-label="Add scheduler rule" defaultValue="" onChange={(event) => { const type = event.target.value as SchedulerRule["type"]; if (type) { onChange([...rules, defaultRule(type)]); event.currentTarget.value = ""; } }} className="h-10 rounded-md border border-[#c7d3ca] bg-white px-3 text-sm font-semibold text-[#1f5b47]"><option value="">Add a rule…</option>{available.map((option) => <option key={option.type} value={option.type}>{option.label}</option>)}</select> : null}
    </div>
    <div className="mt-4 space-y-3">
      {rules.map((rule) => <RuleCard key={rule.id} rule={rule} onChange={(next) => update(rule.id, next)} onRemove={() => onChange(rules.filter((item) => item.id !== rule.id))} />)}
      {rules.length === 0 ? <div className="rounded-md border border-dashed border-[#cfd8d0] bg-white px-4 py-5 text-sm text-[#637066]"><Plus className="mr-2 inline h-4 w-4 text-[#1f5b47]" />Add a rule to make it part of the solver input.</div> : null}
    </div>
  </section>;
}

function RuleCard({ rule, onChange, onRemove }: { rule: SchedulerRule; onChange: (rule: SchedulerRule) => void; onRemove: () => void }) {
  const title = ruleOptions.find((option) => option.type === rule.type)?.label;
  return <article className="rounded-md border border-[#d6ded5] bg-white p-4"><div className="flex items-start justify-between gap-4"><div><h4 className="font-semibold text-[#18211c]">{title}</h4><p className="mt-1 text-sm text-[#637066]">{ruleSummary(rule)}</p></div><button type="button" onClick={onRemove} aria-label={`Remove ${title}`} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#d7ded7] text-[#637066] hover:text-[#9a3d31]"><Trash2 className="h-4 w-4" /></button></div>
    {rule.type === "avoid_dates" ? <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-[#39433d]">Date<input required type="date" value={rule.dates[0] ?? ""} onChange={(event) => onChange({ ...rule, dates: event.target.value ? [event.target.value] : [] })} className="mt-1 h-10 w-full rounded border border-[#cfd8d0] px-3" /></label><label className="text-sm font-medium text-[#39433d]">Enforcement<select value={rule.strength} onChange={(event) => onChange({ ...rule, strength: event.target.value as "hard" | "soft" })} className="mt-1 h-10 w-full rounded border border-[#cfd8d0] bg-white px-3"><option value="hard">Never schedule</option><option value="soft">Avoid when possible</option></select></label></div> : <label className="mt-4 block max-w-xs text-sm font-medium text-[#39433d]">{rule.type === "games_per_pair" ? "Games" : rule.type === "min_rest_hours" ? "Hours" : "Maximum games"}<input type="number" min={rule.type === "min_rest_hours" ? 0 : 1} max={rule.type === "games_per_pair" ? 10 : rule.type === "min_rest_hours" ? 168 : rule.type === "max_matches_per_team_per_week" ? 7 : 4} value={rule.value} onChange={(event) => onChange({ ...rule, value: Number(event.target.value) } as SchedulerRule)} className="mt-1 h-10 w-full rounded border border-[#cfd8d0] px-3" /></label>}
  </article>;
}
