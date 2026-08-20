"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "react-hot-toast";
import { AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, ChevronRight, CircleAlert, Download, Lock, MapPin, Users } from "lucide-react";
import type { ScheduleEditorData } from "@/lib/scheduling/editor-data";
import type { EditorMatch, ScheduleIssue } from "@/lib/scheduling/editor";

const BigCalendar = dynamic(() => import("./BigCalendar").then((module) => module.BigCalendar), {
  ssr: false,
  loading: () => <div className="rounded-md border border-[#d6ded5] bg-white p-8 text-center text-sm text-[#637066]">Loading calendar…</div>,
});
const ScheduleVersionsDialog = dynamic(() => import("./ScheduleVersionsDialog").then((module) => module.ScheduleVersionsDialog), { ssr: false });

type Props = { initialData: ScheduleEditorData };
type Tab = "calendar" | "matches" | "teams" | "venues";

export function ScheduleClient({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [tab, setTab] = useState<Tab>("calendar");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [teamFilter, setTeamFilter] = useState("all");
  const [venueFilter, setVenueFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const selected = data.matches.find((match) => match.id === selectedId) ?? null;
  const issueByMatch = useMemo(() => new Map(data.matches.map((match) => [match.id, data.issues.filter((issue) => issue.matchId === match.id)])), [data]);
  const visibleMatches = useMemo(() => data.matches.filter((match) => {
    const issues = issueByMatch.get(match.id) ?? [];
    const matchesHealth = statusFilter === "all" ||
      (statusFilter === "cancelled" && match.match_status === "cancelled") ||
      (statusFilter === "conflict" && match.match_status !== "cancelled" && issues.some((item) => item.severity === "conflict")) ||
      (statusFilter === "warning" && match.match_status !== "cancelled" && issues.some((item) => item.severity === "warning")) ||
      (statusFilter === "clear" && match.match_status !== "cancelled" && issues.length === 0);
    return (teamFilter === "all" || match.home_team_id === teamFilter || match.away_team_id === teamFilter) &&
      (venueFilter === "all" || match.field_id === venueFilter) && matchesHealth;
  }), [data.matches, issueByMatch, statusFilter, teamFilter, venueFilter]);
  const healthCounts = useMemo(() => data.matches.reduce((counts, match) => {
    if (match.match_status === "cancelled") return counts;
    const issues = issueByMatch.get(match.id) ?? [];
    if (issues.some((issue) => issue.severity === "conflict")) counts.conflicts += 1;
    else if (issues.length > 0) counts.warnings += 1;
    else counts.valid += 1;
    return counts;
  }, { valid: 0, warnings: 0, conflicts: 0 }), [data.matches, issueByMatch]);
  const { valid, warnings, conflicts } = healthCounts;

  async function refresh() {
    const response = await fetch(`/api/leagues/${data.league.id}/schedule/editor`);
    const next = await response.json();
    if (!response.ok) throw new Error(next.error ?? "Could not refresh schedule.");
    setData(next);
  }
  async function clonePublished() {
    if (!data.run) return;
    setBusy(true);
    try { const response = await fetch(`/api/leagues/${data.league.id}/schedule/${data.run.id}/clone`, { method: "POST" }); const result = await response.json(); if (!response.ok) throw new Error(result.error); await refresh(); toast.success("Editable draft created."); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not create draft."); } finally { setBusy(false); }
  }
  async function runAction(action: "undo" | "redo" | "optimize" | "publish") {
    if (!data.run) return;
    setBusy(true);
    try {
      const endpoint = action === "undo" || action === "redo"
        ? `/api/leagues/${data.league.id}/schedule/${data.run.id}/history`
        : `/api/leagues/${data.league.id}/schedule/${data.run.id}/${action}`;
      const response = await fetch(endpoint, { method: "POST", headers: action === "undo" || action === "redo" ? { "Content-Type": "application/json" } : undefined, body: action === "undo" || action === "redo" ? JSON.stringify({ action }) : undefined });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? `Could not ${action} schedule.`);
      await refresh(); toast.success(action === "optimize" ? "Created an optimized draft that preserved locked matches." : `Schedule ${action} complete.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : `Could not ${action} schedule.`); } finally { setBusy(false); }
  }
  async function moveMatch(matchId: string, startsAt: string, fieldId: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/leagues/${data.league.id}/schedule/matches/${matchId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ startsAt, fieldId }) });
      const result = await response.json().catch(() => null) as { error?: string; issues?: Array<{ detail: string }> } | null;
      if (!response.ok) throw new Error(result?.issues?.[0]?.detail ?? result?.error ?? "Could not move match.");
      await refresh(); toast.success("Match moved.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not move match."); } finally { setBusy(false); }
  }
  function focusIssue(matchId: string) { setSelectedId(matchId); setIssuesOpen(false); }
  const unscheduled = data.matches.filter((match) => match.match_status !== "cancelled" && (!match.starts_at || !match.field_id));

  return <main className="min-h-screen bg-[#f6f7f4] text-[#18211c]"><div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
    <header className="flex flex-col gap-5 border-b border-[#d6ded5] pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div><Link href={`/leagues/${data.league.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-[#1f5b47]"><ArrowLeft className="h-4 w-4" />{data.league.name}</Link><div className="mt-3 flex items-center gap-3"><h1 className="text-3xl font-semibold">Schedule editor</h1>{data.run ? <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${data.run.schedule_status === "published" ? "bg-[#e9f1eb] text-[#1f5b47]" : "bg-[#f8ecd6] text-[#815615]"}`}>{data.run.schedule_status}</span> : null}</div><p className="mt-1 text-sm text-[#637066]">{data.league.sport} · {data.matches.length} fixtures</p></div>
      <div className="flex flex-wrap gap-2"><button onClick={() => void runAction("undo")} disabled={!data.run || busy || data.run.schedule_status !== "draft"} className="h-10 rounded-md border border-[#cfd8d0] bg-white px-3 text-sm font-semibold text-[#1f5b47] disabled:text-[#9aa39c]">Undo</button><button onClick={() => void runAction("redo")} disabled={!data.run || busy || data.run.schedule_status !== "draft"} className="h-10 rounded-md border border-[#cfd8d0] bg-white px-3 text-sm font-semibold text-[#1f5b47] disabled:text-[#9aa39c]">Redo</button><button onClick={() => setVersionsOpen(true)} disabled={busy} className="h-10 rounded-md border border-[#cfd8d0] bg-white px-4 text-sm font-semibold text-[#1f5b47] disabled:opacity-45">Previous versions</button>{data.run?.schedule_status === "published" ? <><a href={`/api/leagues/${data.league.id}/schedule/${data.run.id}/export`} className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cfd8d0] bg-white px-4 text-sm font-semibold text-[#1f5b47]"><Download className="h-4 w-4" />Export Excel</a><button onClick={() => void clonePublished()} disabled={busy} className="h-10 rounded-md bg-[#1f5b47] px-4 text-sm font-semibold text-white">{busy ? "Creating..." : "Create editable draft"}</button></> : <><button onClick={() => void runAction("optimize")} disabled={!data.run || busy} className="h-10 rounded-md border border-[#cfd8d0] bg-white px-4 text-sm font-semibold text-[#1f5b47] disabled:opacity-45">{busy ? "Working..." : "Optimize schedule"}</button><button onClick={() => void runAction("publish")} disabled={!data.run || busy || conflicts > 0 || unscheduled.length > 0} className="h-10 rounded-md bg-[#1f5b47] px-4 text-sm font-semibold text-white disabled:opacity-45">Publish schedule</button></>}</div>
    </header>
    {!data.run ? <EmptySchedule leagueId={data.league.id} onGenerated={() => void refresh()} /> : <>
      <GenerationRules snapshot={data.run.input_snapshot} />
      <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><nav className="flex gap-1 rounded-md border border-[#d6ded5] bg-white p-1">{(["calendar", "matches", "teams", "venues"] as Tab[]).map((item) => <button key={item} onClick={() => setTab(item)} className={`rounded px-4 py-2 text-sm font-semibold capitalize ${tab === item ? "bg-[#e9f1eb] text-[#1f5b47]" : "text-[#637066]"}`}>{item}</button>)}</nav><div className="flex flex-wrap gap-2"><Filter value={teamFilter} onChange={setTeamFilter}><option value="all">All teams</option>{data.league.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Filter><Filter value={venueFilter} onChange={setVenueFilter}><option value="all">All venues</option>{data.fields.map((field) => <option key={field.id} value={field.id}>{field.venue_name} / {field.label}</option>)}</Filter><Filter value={statusFilter} onChange={setStatusFilter}><option value="all">All health</option><option value="conflict">Conflicts</option><option value="warning">Warnings</option><option value="clear">Clear</option><option value="cancelled">Cancelled</option></Filter><button onClick={() => setIssuesOpen(true)} className="inline-flex items-center gap-2 rounded-md border border-[#d6ded5] bg-white px-3 text-sm font-semibold"><CircleAlert className="h-4 w-4 text-[#b44632]" />{valid} valid · {warnings} warnings · {conflicts} conflicts</button></div></div>
      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]"> <div className="min-w-0">{tab === "calendar" ? <BigCalendar matches={visibleMatches.filter((match) => match.match_status !== "cancelled")} issueByMatch={issueByMatch} onSelect={setSelectedId} disabled={busy || data.run.schedule_status !== "draft"} onMove={moveMatch} /> : tab === "matches" ? <MatchesTable matches={visibleMatches} issueByMatch={issueByMatch} onSelect={setSelectedId} /> : tab === "teams" ? <TeamsView data={data} issueByMatch={issueByMatch} onViewTeam={(teamId) => { setTeamFilter(teamId); setTab("matches"); }} /> : <VenuesView data={data} issueByMatch={issueByMatch} onSelect={setSelectedId} />}</div><Unscheduled matches={unscheduled} counts={data.validSlotCounts} onSelect={setSelectedId} /></section>
    </>}
  </div>{issuesOpen ? <IssuesPanel issues={data.issues} matches={data.matches} onClose={() => setIssuesOpen(false)} onSelect={focusIssue} /> : null}{selected ? <MatchDrawer match={selected} data={data} issues={issueByMatch.get(selected.id) ?? []} onClose={() => setSelectedId(null)} onSaved={(message) => { void refresh(); toast.success(message ?? "Match changes saved."); }} onMakeupCreated={(matchId) => { setSelectedId(matchId); void refresh(); toast.success("Make-up fixture created. Choose a time to schedule it."); }} onMessage={(value) => { if (value) toast.error(value); }} /> : null}{versionsOpen ? <ScheduleVersionsDialog leagueId={data.league.id} onClose={() => setVersionsOpen(false)} onRestored={refresh} /> : null}</main>;
}

function Filter({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: ReactNode }) { return <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-md border border-[#cfd8d0] bg-white px-3 text-sm text-[#39433d]">{children}</select>; }
function EmptySchedule({ leagueId, onGenerated }: { leagueId: string; onGenerated: () => void }) {
  const [isGenerating, setIsGenerating] = useState(false);

  async function generate() {
    setIsGenerating(true); const toastId = toast.loading("Generating schedule…");
    try {
      const response = await fetch(`/api/leagues/${leagueId}/schedule`, { method: "POST" });
      const result = await response.json().catch(() => null) as { error?: string; missing_teams?: string[]; matches?: unknown[] } | null;
      if (!response.ok) { const missing = result?.missing_teams?.join(", "); throw new Error(missing ? `${result?.error ?? "Could not generate schedule."} Missing: ${missing}` : result?.error ?? "Could not generate schedule."); }
      toast.success(`Schedule generated with ${result?.matches?.length ?? 0} matches.`, { id: toastId }); onGenerated();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not reach the scheduling service.", { id: toastId }); } finally { setIsGenerating(false); }
  }

  return <section className="mt-7 rounded-md border border-dashed border-[#cfd8d0] bg-white px-6 py-12 text-center"><CalendarDays className="mx-auto h-8 w-8 text-[#1f5b47]" /><h2 className="mt-3 text-lg font-semibold">Create your first schedule draft</h2><p className="mx-auto mt-1 max-w-xl text-sm text-[#637066]">Generate fixtures from the team and venue availability you have collected. Your saved scheduler rules will be applied automatically.</p><div className="mt-5 flex flex-wrap justify-center gap-3"><button onClick={() => void generate()} disabled={isGenerating} className="inline-flex h-11 items-center justify-center rounded-md bg-[#1f5b47] px-5 text-sm font-semibold text-white disabled:opacity-60">{isGenerating ? "Generating schedule..." : "Generate schedule"}</button><Link href={`/leagues/${leagueId}`} className="inline-flex h-11 items-center justify-center rounded-md border border-[#c7d3ca] bg-white px-5 text-sm font-semibold text-[#1f5b47]">Back to league</Link></div></section>;
}
function GenerationRules({ snapshot }: { snapshot: NonNullable<ScheduleEditorData["run"]>["input_snapshot"] }) {
  const settings = snapshot?.settings;
  if (!settings) return null;
  const rules = [
    `${settings.games_per_pair ?? 1} game${settings.games_per_pair === 1 ? "" : "s"} per pairing`,
    `max ${settings.max_matches_per_team_per_week ?? 1} game per team per week`,
    `max ${settings.max_matches_per_team_per_day ?? 1} game per team per day`,
    `${settings.min_rest_hours ?? 0} rest hour${settings.min_rest_hours === 1 ? "" : "s"}`,
  ];
  if (snapshot.excluded_dates?.length) rules.push(`${snapshot.excluded_dates.length} hard avoided date${snapshot.excluded_dates.length === 1 ? "" : "s"}`);
  if (snapshot.soft_avoid_dates?.length) rules.push(`${snapshot.soft_avoid_dates.length} soft avoided date${snapshot.soft_avoid_dates.length === 1 ? "" : "s"}`);
  return <section className="mt-5 rounded-md border border-[#d6ded5] bg-white p-4"><p className="text-sm font-semibold text-[#18211c]">Generation rules</p><p className="mt-1 text-sm text-[#637066]">These are the values used to create this schedule run.</p><div className="mt-3 flex flex-wrap gap-2">{rules.map((rule) => <span key={rule} className="rounded-full bg-[#e9f1eb] px-3 py-1 text-xs font-semibold text-[#1f5b47]">{rule}</span>)}</div></section>;
}
function Unscheduled({ matches, counts, onSelect }: { matches: EditorMatch[]; counts: Record<string, number>; onSelect: (id: string) => void }) { return <aside className="rounded-md border border-[#d6ded5] bg-white p-4"><h2 className="font-semibold">Unscheduled matches</h2><p className="mt-1 text-xs text-[#637066]">Prioritize fixtures with fewer available permit windows.</p><div className="mt-3 space-y-2">{matches.sort((a, b) => (counts[a.id] ?? 0) - (counts[b.id] ?? 0)).map((match) => <button key={match.id} onClick={() => onSelect(match.id)} className="w-full rounded border border-[#e1e7e0] p-3 text-left text-sm"><strong>{match.home_team_name} vs {match.away_team_name}</strong>{match.fixture_type === "makeup" ? <span className="mt-1 block text-xs font-semibold text-[#815615]">Make-up fixture</span> : null}<span className={`mt-1 block text-xs ${(counts[match.id] ?? 0) < 3 ? "text-[#b44632]" : "text-[#1f5b47]"}`}>{counts[match.id] ?? 0} available permit windows</span></button>)}{matches.length === 0 ? <p className="py-4 text-sm text-[#637066]">Every fixture has a placement.</p> : null}</div></aside>; }
function MatchesTable({ matches, issueByMatch, onSelect }: { matches: EditorMatch[]; issueByMatch: Map<string, ScheduleIssue[]>; onSelect: (id: string) => void }) { return <div className="overflow-x-auto rounded-md border border-[#d6ded5] bg-white"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b bg-[#fbfcfa] text-xs uppercase text-[#637066]"><tr>{["Date", "Time", "Home", "Away", "Venue", "Status"].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr></thead><tbody>{matches.map((match) => <tr key={match.id} onClick={() => onSelect(match.id)} className="cursor-pointer border-b last:border-0 hover:bg-[#fbfcfa]"><td className="px-4 py-3">{match.starts_at ? formatDate(match.starts_at) : "Unscheduled"}</td><td className="px-4 py-3">{formatTime(match.starts_at)}</td><td className="px-4 py-3 font-semibold">{match.home_team_name}{match.fixture_type === "makeup" ? <span className="ml-2 text-xs font-medium text-[#815615]">Make-up</span> : null}</td><td className="px-4 py-3 font-semibold">{match.away_team_name}</td><td className="px-4 py-3">{match.venue_name ?? "—"}</td><td className="px-4 py-3">{match.match_status === "cancelled" ? <span className="text-xs font-semibold text-[#9a3d31]">Cancelled</span> : <Health issues={issueByMatch.get(match.id) ?? []} />}</td></tr>)}</tbody></table></div>; }
function TeamsView({ data, issueByMatch, onViewTeam }: { data: ScheduleEditorData; issueByMatch: Map<string, ScheduleIssue[]>; onViewTeam: (teamId: string) => void }) { return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.league.teams.map((team) => { const matches = data.matches.filter((match) => match.home_team_id === team.id || match.away_team_id === team.id); return <button onClick={() => onViewTeam(team.id)} key={team.id} className="rounded-md border border-[#d6ded5] bg-white p-4 text-left"><Users className="h-5 w-5 text-[#1f5b47]" /><h2 className="mt-3 font-semibold">{team.name}</h2><p className="mt-1 text-sm text-[#637066]">{matches.length} total matches · {matches.filter((match) => (issueByMatch.get(match.id) ?? []).length).length} needing review</p><span className="mt-3 block text-xs font-semibold text-[#1f5b47]">View matches</span></button>; })}</div>; }
function VenuesView({ data, issueByMatch, onSelect }: { data: ScheduleEditorData; issueByMatch: Map<string, ScheduleIssue[]>; onSelect: (id: string) => void }) { return <div className="grid gap-3 sm:grid-cols-2">{data.fields.map((field) => { const matches = data.matches.filter((match) => match.field_id === field.id); return <button onClick={() => matches[0] && onSelect(matches[0].id)} key={field.id} className="rounded-md border border-[#d6ded5] bg-white p-4 text-left"><MapPin className="h-5 w-5 text-[#1f5b47]" /><h2 className="mt-3 font-semibold">{field.venue_name} / {field.label}</h2><p className="mt-1 text-sm text-[#637066]">{matches.length} occupied slots · {data.permits.filter((permit) => permit.field_id === field.id).length} permitted windows</p><Health issues={matches.flatMap((match) => issueByMatch.get(match.id) ?? [])} /></button>; })}</div>; }
function Health({ issues }: { issues: ScheduleIssue[] }) { const conflict = issues.some((issue) => issue.severity === "conflict"); return <span className={`inline-flex items-center gap-1 text-xs font-semibold ${conflict ? "text-[#b44632]" : issues.length ? "text-[#a66c13]" : "text-[#1f5b47]"}`}>{conflict ? <CircleAlert className="h-3.5 w-3.5" /> : issues.length ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{conflict ? "Conflict" : issues.length ? "Warning" : "Ready"}</span>; }
function IssuesPanel({ issues, matches, onClose, onSelect }: { issues: ScheduleIssue[]; matches: EditorMatch[]; onClose: () => void; onSelect: (id: string) => void }) { return <div className="fixed inset-0 z-40 bg-[#18211c]/25" onClick={onClose}><aside onClick={(event) => event.stopPropagation()} className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Schedule issues</h2><button onClick={onClose} className="text-sm font-semibold text-[#1f5b47]">Close</button></div><div className="mt-5 space-y-2">{issues.map((issue) => { const match = matches.find((item) => item.id === issue.matchId); return <button key={issue.id} onClick={() => onSelect(issue.matchId)} className="w-full rounded-md border border-[#e1e7e0] p-3 text-left"><Health issues={[issue]} /><p className="mt-2 font-semibold">{match?.home_team_name} vs {match?.away_team_name}</p><p className="mt-1 text-sm text-[#637066]">{issue.detail}</p><span className="mt-2 inline-flex items-center text-xs font-semibold text-[#1f5b47]">Review match <ChevronRight className="h-3.5 w-3.5" /></span></button>; })}{issues.length === 0 ? <p className="py-8 text-center text-sm text-[#637066]">No issues found.</p> : null}</div></aside></div>; }
function MatchDrawer({ match, data, issues, onClose, onSaved, onMakeupCreated, onMessage }: { match: EditorMatch; data: ScheduleEditorData; issues: ScheduleIssue[]; onClose: () => void; onSaved: (message?: string) => void; onMakeupCreated: (matchId: string) => void; onMessage: (value: string) => void }) {
  const [date, setDate] = useState(match.starts_at?.slice(0, 10) ?? "");
  const [time, setTime] = useState(match.starts_at?.slice(11, 16) ?? "");
  const [fieldId, setFieldId] = useState(match.field_id ?? "");
  const [locked, setLocked] = useState(match.is_locked);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [creatingMakeup, setCreatingMakeup] = useState(false);
  const cancelled = match.match_status === "cancelled";
  const readOnly = data.run?.schedule_status !== "draft" || cancelled;

  async function save() {
    setSaving(true); onMessage("");
    try {
      const response = await fetch(`/api/leagues/${data.league.id}/schedule/matches/${match.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ startsAt: date && time ? `${date}T${time}:00` : null, fieldId: fieldId || null, isLocked: locked }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.issues?.[0]?.detail ?? result.error);
      onSaved(); onClose();
    } catch (error) { onMessage(error instanceof Error ? error.message : "Could not save match."); } finally { setSaving(false); }
  }

  async function cancelMatch() {
    if (!window.confirm(`Cancel ${match.home_team_name} vs ${match.away_team_name}? It will remain in the Matches list and can be restored with Undo.`)) return;
    setCancelling(true); onMessage("");
    try {
      const response = await fetch(`/api/leagues/${data.league.id}/schedule/matches/${match.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ matchStatus: "cancelled" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not cancel match.");
      onSaved("Match cancelled."); onClose();
    } catch (error) { onMessage(error instanceof Error ? error.message : "Could not cancel match."); } finally { setCancelling(false); }
  }

  async function createMakeup() {
    setCreatingMakeup(true); onMessage("");
    try {
      const response = await fetch(`/api/leagues/${data.league.id}/schedule/matches/${match.id}/makeup`, { method: "POST" });
      const result = await response.json() as { error?: string; match?: { id: string } };
      if (!response.ok || !result.match) throw new Error(result.error ?? "Could not create make-up fixture.");
      onMakeupCreated(result.match.id);
    } catch (error) { onMessage(error instanceof Error ? error.message : "Could not create make-up fixture."); } finally { setCreatingMakeup(false); }
  }

  return <div className="fixed inset-0 z-30 bg-[#18211c]/20" onClick={onClose}><aside onClick={(event) => event.stopPropagation()} className="absolute right-0 top-0 h-full w-full max-w-lg overflow-y-auto bg-white p-5 shadow-xl"><div className="flex justify-between"><div><p className="text-xs font-bold uppercase text-[#637066]">{match.fixture_type === "makeup" ? "Make-up match" : "Match editor"}</p><h2 className="mt-1 text-xl font-semibold">{match.home_team_name} vs {match.away_team_name}</h2></div><button onClick={onClose} className="text-sm font-semibold text-[#1f5b47]">Close</button></div>{cancelled ? <div className="mt-5 rounded border border-[#e1c3bd] bg-[#fff8f6] p-3 text-sm text-[#9a3d31]"><strong>Match cancelled.</strong><p className="mt-1">It no longer occupies a calendar slot or contributes scheduling conflicts.</p></div> : null}<section className="mt-6 rounded-md bg-[#fbfcfa] p-4"><h3 className="font-semibold">Assignment</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm">Date<input disabled={readOnly} type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 h-10 w-full rounded border border-[#cfd8d0] px-2" /></label><label className="text-sm">Time<input disabled={readOnly} type="time" value={time} onChange={(event) => setTime(event.target.value)} className="mt-1 h-10 w-full rounded border border-[#cfd8d0] px-2" /></label></div><label className="mt-3 block text-sm">Venue / field<select disabled={readOnly} value={fieldId} onChange={(event) => setFieldId(event.target.value)} className="mt-1 h-10 w-full rounded border border-[#cfd8d0] px-2"><option value="">Choose a field</option>{data.fields.map((field) => <option key={field.id} value={field.id}>{field.venue_name} / {field.label}</option>)}</select></label><label className="mt-4 flex items-center gap-2 text-sm font-semibold"><input disabled={readOnly} type="checkbox" checked={locked} onChange={(event) => setLocked(event.target.checked)} /> <Lock className="h-4 w-4" />Lock this match</label></section><section className="mt-5"><h3 className="font-semibold">Constraint feedback</h3><div className="mt-3 space-y-2">{issues.map((issue) => <div key={issue.id} className={`rounded border p-3 text-sm ${issue.severity === "conflict" ? "border-[#e1c3bd] bg-[#fff8f6]" : "border-[#ead7af] bg-[#fffaf0]"}`}><strong>{issue.title}</strong><p className="mt-1 text-[#637066]">{issue.detail}</p></div>)}{issues.length === 0 ? <div className="rounded border border-[#cfe0d3] bg-[#f5faf6] p-3 text-sm text-[#1f5b47]"><CheckCircle2 className="mr-1 inline h-4 w-4" />This assignment meets the current constraints.</div> : null}</div></section>{data.run?.schedule_status === "draft" && cancelled && match.fixture_type === "regular" ? <button onClick={() => void createMakeup()} disabled={creatingMakeup} className="mt-6 h-11 w-full rounded-md bg-[#1f5b47] text-sm font-semibold text-white disabled:opacity-60">{creatingMakeup ? "Creating make-up..." : "Schedule make-up match"}</button> : null}{!readOnly ? <SuggestedTimes leagueId={data.league.id} match={match} fields={data.fields} onChoose={(suggestion) => { setDate(suggestion.startsAt.slice(0, 10)); setTime(suggestion.startsAt.slice(11, 16)); setFieldId(suggestion.fieldId); }} /> : null}{data.run?.schedule_status === "draft" && !cancelled ? <button onClick={() => void cancelMatch()} disabled={cancelling || saving} className="mt-6 h-11 w-full rounded-md border border-[#d9a69c] bg-white text-sm font-semibold text-[#9a3d31] disabled:opacity-60">{cancelling ? "Cancelling..." : "Cancel match"}</button> : null}{readOnly && !cancelled ? <p className="mt-6 text-sm text-[#637066]">Published schedules are read-only. Create an editable draft to make changes.</p> : null}{!readOnly ? <button onClick={() => void save()} disabled={saving || cancelling || creatingMakeup} className="mt-3 h-11 w-full rounded-md bg-[#1f5b47] text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving..." : "Save changes"}</button> : null}</aside></div>;
}

const SUGGESTIONS_PER_PAGE = 5;

function SuggestedTimes({ leagueId, match, fields, onChoose }: { leagueId: string; match: EditorMatch; fields: ScheduleEditorData["fields"]; onChoose: (slot: { startsAt: string; fieldId: string }) => void }) {
  const [slots, setSlots] = useState<Array<{ startsAt: string; fieldId: string; warningCount: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  async function load() {
    setLoading(true);
    try {
      const response = await fetch(`/api/leagues/${leagueId}/schedule/matches/${match.id}/suggestions`);
      const result = await response.json() as { suggestions?: Array<{ startsAt: string; fieldId: string; warningCount: number }> };
      if (!response.ok) throw new Error("Could not find suggested times.");
      setSelectedKey(null);
      setSlots(result.suggestions ?? []);
      setPage(0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not find suggested times.");
    } finally { setLoading(false); }
  }
  const fieldById = new Map(fields.map((field) => [field.id, field]));
  const pageCount = Math.ceil(slots.length / SUGGESTIONS_PER_PAGE);
  const start = page * SUGGESTIONS_PER_PAGE;
  const visibleSlots = slots.slice(start, start + SUGGESTIONS_PER_PAGE);
  return <section className="mt-5 border-t border-[#e1e7e0] pt-5"><div className="flex items-center justify-between"><h3 className="font-semibold">Suggested times{slots.length ? ` (${slots.length})` : ""}</h3><button onClick={() => void load()} className="text-sm font-semibold text-[#1f5b47]">{loading ? "Finding..." : "Find another time"}</button></div>{slots.length ? <div className="mt-3 space-y-2">{visibleSlots.map((slot) => { const key = `${slot.fieldId}:${slot.startsAt}`; const selected = key === selectedKey; return <button key={key} onClick={() => { setSelectedKey(key); onChoose(slot); }} className={`w-full rounded border p-3 text-left text-sm ${selected ? "border-[#1f5b47] bg-[#edf6ef] ring-1 ring-[#1f5b47]" : "border-[#cfe0d3]"}`}><strong>{formatDate(slot.startsAt)} · {formatTime(slot.startsAt)}</strong><span className="mt-1 block text-[#637066]">{fieldById.get(slot.fieldId)?.venue_name} / {fieldById.get(slot.fieldId)?.label} · {slot.warningCount ? `${slot.warningCount} warnings` : "No conflicts"}</span>{selected ? <span className="mt-2 block font-semibold text-[#1f5b47]">Selected — review the assignment above, then save changes.</span> : null}</button>; })}</div> : null}{pageCount > 1 ? <div className="mt-3 flex items-center justify-between text-sm"><button onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0} className="rounded border border-[#cfd8d0] px-3 py-2 font-semibold text-[#1f5b47] disabled:cursor-not-allowed disabled:opacity-40">Previous</button><span className="text-[#637066]">{start + 1}–{Math.min(start + SUGGESTIONS_PER_PAGE, slots.length)} of {slots.length}</span><button onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} disabled={page === pageCount - 1} className="rounded border border-[#cfd8d0] px-3 py-2 font-semibold text-[#1f5b47] disabled:cursor-not-allowed disabled:opacity-40">Next</button></div> : null}</section>;
}
function formatDate(value: string | null) { if (!value) return "—"; return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(value)); }
function formatTime(value: string | null) { if (!value) return "—"; return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
