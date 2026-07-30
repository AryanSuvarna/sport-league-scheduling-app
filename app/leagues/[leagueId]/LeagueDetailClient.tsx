"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  Clock3,
  ListChecks,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { formatSeason, type League } from "@/lib/leagues";
import { createClient } from "@/lib/supabase/client";

type LeagueDetailClientProps = {
  league: League;
};

export function LeagueDetailClient({ league }: LeagueDetailClientProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editableLeague, setEditableLeague] = useState({
    name: league.name,
    sport: league.sport,
    seasonStartDate: league.season_start_date,
    seasonEndDate: league.season_end_date,
    matchDurationMinutes: String(league.match_duration_minutes),
    maxMatchesPerTeamPerWeek: String(league.max_matches_per_team_per_week),
    rules: league.match_rules.join("\n"),
  });

  const rules = useMemo(
    () =>
      editableLeague.rules
        .split("\n")
        .map((rule) => rule.trim())
        .filter(Boolean),
    [editableLeague.rules],
  );
  const seasonLabel = formatSeason(
    editableLeague.seasonStartDate,
    editableLeague.seasonEndDate,
  );

  function updateField(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;

    setMessage("");
    setEditableLeague((currentLeague) => ({
      ...currentLeague,
      [name]: value,
    }));
  }

  async function saveLeague() {
    if (!editableLeague.name.trim()) {
      setMessage("League name is required.");
      return;
    }

    if (!editableLeague.seasonStartDate || !editableLeague.seasonEndDate) {
      setMessage("Choose a season start and end date.");
      return;
    }

    if (editableLeague.seasonEndDate < editableLeague.seasonStartDate) {
      setMessage("Season end date must be on or after the start date.");
      return;
    }

    if (Number(editableLeague.matchDurationMinutes) <= 0) {
      setMessage("Match duration must be greater than 0.");
      return;
    }

    if (Number(editableLeague.maxMatchesPerTeamPerWeek) <= 0) {
      setMessage("Max matches per team per week must be greater than 0.");
      return;
    }

    setIsSaving(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("leagues")
      .update({
        name: editableLeague.name.trim(),
        sport: editableLeague.sport.trim(),
        season_start_date: editableLeague.seasonStartDate,
        season_end_date: editableLeague.seasonEndDate,
        match_duration_minutes: Number(editableLeague.matchDurationMinutes),
        max_matches_per_team_per_week: Number(editableLeague.maxMatchesPerTeamPerWeek),
        match_rules: rules,
      })
      .eq("id", league.id);

    setIsSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setIsEditing(false);
    setMessage("League updated.");
    router.refresh();
  }

  async function deleteLeague() {
    setIsSaving(true);

    const supabase = createClient();
    const { error } = await supabase.from("leagues").delete().eq("id", league.id);

    setIsSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push("/leagues");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#f6f7f4] text-[#18211c]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-4 py-6 sm:px-6 lg:px-8">
        <header className="border-b border-[#d6ded5] pb-6">
          <Link
            href="/leagues"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#1f5b47] transition hover:text-[#164333]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Leagues
          </Link>

          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium text-[#637066]">League info</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#16211b] sm:text-4xl">
                {editableLeague.name}
              </h1>
              <p className="mt-2 text-sm text-[#637066]">
                {editableLeague.sport} / {seasonLabel}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setIsEditing((currentValue) => !currentValue)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#c7d3ca] bg-white px-5 text-sm font-semibold text-[#1f5b47] transition hover:border-[#9fb5a8] focus:outline-none focus:ring-2 focus:ring-[#1f5b47] focus:ring-offset-2"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                {isEditing ? "Cancel edit" : "Edit league"}
              </button>
              <button
                type="button"
                onClick={deleteLeague}
                disabled={isSaving}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#e1c3bd] bg-white px-5 text-sm font-semibold text-[#9a3d31] transition hover:border-[#c99388] focus:outline-none focus:ring-2 focus:ring-[#9a3d31] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete league
              </button>
            </div>
          </div>
          {message ? <p className="mt-4 text-sm text-[#637066]">{message}</p> : null}
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            {isEditing ? (
              <section className="rounded-md border border-[#d6ded5] bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-[#18211c]">Edit league</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <EditField
                    label="League name"
                    name="name"
                    value={editableLeague.name}
                    onChange={updateField}
                  />
                  <EditField
                    label="Sport"
                    name="sport"
                    value={editableLeague.sport}
                    onChange={updateField}
                  />
                  <label className="block text-sm font-medium text-[#39433d]">
                    Season start date
                    <input
                      type="date"
                      name="seasonStartDate"
                      value={editableLeague.seasonStartDate}
                      onChange={updateField}
                      className="mt-2 h-11 w-full rounded-md border border-[#cfd8d0] bg-white px-3 text-sm text-[#18211c] outline-none transition focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/15"
                    />
                  </label>
                  <label className="block text-sm font-medium text-[#39433d]">
                    Season end date
                    <input
                      type="date"
                      name="seasonEndDate"
                      value={editableLeague.seasonEndDate}
                      onChange={updateField}
                      min={editableLeague.seasonStartDate || undefined}
                      className="mt-2 h-11 w-full rounded-md border border-[#cfd8d0] bg-white px-3 text-sm text-[#18211c] outline-none transition focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/15"
                    />
                  </label>
                  <EditField
                    label="Match duration"
                    name="matchDurationMinutes"
                    value={editableLeague.matchDurationMinutes}
                    onChange={updateField}
                  />
                  <EditField
                    label="Max matches per team per week"
                    name="maxMatchesPerTeamPerWeek"
                    value={editableLeague.maxMatchesPerTeamPerWeek}
                    onChange={updateField}
                  />
                  <label className="block text-sm font-medium text-[#39433d] sm:col-span-2">
                    Match rules
                    <textarea
                      name="rules"
                      value={editableLeague.rules}
                      onChange={updateField}
                      rows={5}
                      className="mt-2 w-full resize-none rounded-md border border-[#cfd8d0] bg-white px-3 py-3 text-sm leading-6 text-[#18211c] outline-none transition focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/15"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={saveLeague}
                  disabled={isSaving}
                  className="mt-5 inline-flex h-11 items-center justify-center rounded-md bg-[#1f5b47] px-5 text-sm font-semibold text-white transition hover:bg-[#164333] focus:outline-none focus:ring-2 focus:ring-[#1f5b47] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : "Save changes"}
                </button>
              </section>
            ) : null}

            <section className="rounded-md border border-[#d6ded5] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-[#18211c]">Teams</h2>
              <div className="mt-4 grid gap-3">
                {league.league_teams.map((team) => (
                  <article
                    key={team.id}
                    className="rounded-md border border-[#e1e7e0] bg-[#fbfcfa] p-4"
                  >
                    <h3 className="text-sm font-semibold text-[#18211c]">{team.name}</h3>
                    <div className="mt-3 grid gap-2 text-sm text-[#637066] sm:grid-cols-3">
                      <p>{team.captain_name}</p>
                      <p>{team.captain_phone}</p>
                      <p>{team.captain_email || "No email"}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-md border border-[#d6ded5] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-[#18211c]">Match rules</h2>
              {rules.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {rules.map((rule) => (
                    <li
                      key={rule}
                      className="rounded-md border border-[#e1e7e0] bg-[#fbfcfa] px-3 py-2 text-sm text-[#39433d]"
                    >
                      {rule}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-[#637066]">No match rules added.</p>
              )}
            </section>
          </div>

          <aside className="space-y-4">
            <SummaryMetric icon={Users} label="Teams" value={league.league_teams.length} />
            <SummaryMetric
              icon={Clock3}
              label="Match duration"
              value={`${editableLeague.matchDurationMinutes || 0} min`}
            />
            <SummaryMetric
              icon={CalendarRange}
              label="Weekly max"
              value={editableLeague.maxMatchesPerTeamPerWeek || 0}
            />
            <SummaryMetric icon={ListChecks} label="Rules" value={rules.length} />
            <Link
              href="/venue-availability"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#1f5b47] px-5 text-sm font-semibold text-white transition hover:bg-[#164333] focus:outline-none focus:ring-2 focus:ring-[#1f5b47] focus:ring-offset-2"
            >
              Add venue availability
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </aside>
        </section>
      </div>
    </main>
  );
}

function EditField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="block text-sm font-medium text-[#39433d]">
      {label}
      <input
        name={name}
        value={value}
        onChange={onChange}
        className="mt-2 h-11 w-full rounded-md border border-[#cfd8d0] bg-white px-3 text-sm text-[#18211c] outline-none transition focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/15"
      />
    </label>
  );
}

function SummaryMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-md border border-[#d6ded5] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-[#637066]">
        <Icon className="h-4 w-4 text-[#1f5b47]" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold text-[#18211c]">{value}</p>
    </div>
  );
}
