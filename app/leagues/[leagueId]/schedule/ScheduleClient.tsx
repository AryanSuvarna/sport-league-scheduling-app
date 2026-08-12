"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  LoaderCircle,
  MapPin,
} from "lucide-react";
import { formatSeason } from "@/lib/leagues";
import { createClient } from "@/lib/supabase/client";

export type ScheduleLeague = {
  id: string;
  name: string;
  sport: string;
  season_start_date: string;
  season_end_date: string;
  league_teams: Array<{ id: string; name: string }>;
};

export type ScheduleMatch = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  field_id: string;
  starts_at: string;
  ends_at: string;
  home_team_name: string;
  away_team_name: string;
  field_label: string;
  venue_name: string;
};

export type ScheduleRun = {
  id: string;
  solver_status: string;
  objective_value: number | null;
  created_at: string;
};

type GenerateScheduleResult = {
  error?: string;
  missing_teams?: string[];
  matches?: unknown[];
};

type ScheduleClientProps = {
  league: ScheduleLeague;
  initialRun: ScheduleRun | null;
  initialMatches: ScheduleMatch[];
  initialLoadError: string;
};

export function ScheduleClient({
  league,
  initialRun,
  initialMatches,
  initialLoadError,
}: ScheduleClientProps) {
  const supabase = useMemo(() => createClient(), []);
  const [message, setMessage] = useState(initialLoadError);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [scheduleRun, setScheduleRun] = useState<ScheduleRun | null>(initialRun);
  const [matches, setMatches] = useState<ScheduleMatch[]>(initialMatches);
  const [options, setOptions] = useState({
    gamesPerPair: "1",
    maxMatchesPerTeamPerDay: "1",
  });

  async function loadLatestSchedule() {
    setIsLoading(true);

    const { data: run, error: runError } = await supabase
      .from("league_schedule_runs")
      .select("id, solver_status, objective_value, created_at")
      .eq("league_id", league.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<ScheduleRun>();

    if (runError) {
      setMessage(`Could not load the latest schedule: ${runError.message}`);
      setIsLoading(false);
      return;
    }

    if (!run) {
      setScheduleRun(null);
      setMatches([]);
      setIsLoading(false);
      return;
    }

    const { data: rawMatches, error: matchesError } = await supabase
      .from("league_matches")
      .select("id, home_team_id, away_team_id, field_id, starts_at, ends_at")
      .eq("schedule_run_id", run.id)
      .order("starts_at", { ascending: true });

    if (matchesError) {
      setMessage(`Could not load schedule matches: ${matchesError.message}`);
      setIsLoading(false);
      return;
    }

    const fieldIds = [...new Set((rawMatches ?? []).map((match) => match.field_id))];
    const { data: fields, error: fieldsError } = fieldIds.length
      ? await supabase
          .from("fields")
          .select("id, label, venues(name)")
          .in("id", fieldIds)
      : { data: [], error: null };

    if (fieldsError) {
      setMessage(`Could not load schedule fields: ${fieldsError.message}`);
      setIsLoading(false);
      return;
    }

    const teamNames = new Map(league.league_teams.map((team) => [team.id, team.name]));
    const fieldRows = (fields ?? []) as unknown as Array<{
      id: string;
      label: string;
      venues: { name: string } | null;
    }>;
    const fieldById = new Map(
      fieldRows.map((field) => [
        field.id,
        { label: field.label, venue: field.venues?.name ?? "Venue" },
      ]),
    );

    setScheduleRun(run);
    setMatches(
      (rawMatches ?? []).map((match) => {
        const field = fieldById.get(match.field_id);
        return {
          ...match,
          home_team_name: teamNames.get(match.home_team_id) ?? "Unknown team",
          away_team_name: teamNames.get(match.away_team_id) ?? "Unknown team",
          field_label: field?.label ?? "Field",
          venue_name: field?.venue ?? "Venue",
        };
      }),
    );
    setIsLoading(false);
  }

  async function generateSchedule() {
    const gamesPerPair = Number(options.gamesPerPair);
    const maxMatchesPerTeamPerDay = Number(options.maxMatchesPerTeamPerDay);

    if (!Number.isInteger(gamesPerPair) || gamesPerPair < 1 || gamesPerPair > 10) {
      setMessage("Games per pair must be a whole number from 1 to 10.");
      return;
    }

    if (
      !Number.isInteger(maxMatchesPerTeamPerDay) ||
      maxMatchesPerTeamPerDay < 1 ||
      maxMatchesPerTeamPerDay > 4
    ) {
      setMessage("Max matches per team per day must be a whole number from 1 to 4.");
      return;
    }

    setIsGenerating(true);
    setMessage("");

    try {
      const response = await fetch(`/api/leagues/${league.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gamesPerPair, maxMatchesPerTeamPerDay }),
      });
      const result = (await response.json().catch(() => null)) as GenerateScheduleResult | null;

      if (!response.ok) {
        const missingTeams = result?.missing_teams?.join(", ");
        setMessage(
          missingTeams
            ? `${result?.error ?? "Could not generate schedule."} Missing: ${missingTeams}`
            : result?.error ?? "Could not generate schedule.",
        );
        return;
      }

      setMessage(`Schedule generated with ${result?.matches?.length ?? 0} matches.`);
      await loadLatestSchedule();
    } catch {
      setMessage("Could not reach the scheduling service.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f4] text-[#18211c]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-4 py-6 sm:px-6 lg:px-8">
        <header className="border-b border-[#d6ded5] pb-6">
          <Link
            href={`/leagues/${league.id}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#1f5b47] transition hover:text-[#164333]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {league.name}
          </Link>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-[#637066]">Scheduling</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#16211b] sm:text-4xl">
                League schedule
              </h1>
              <p className="mt-2 text-sm text-[#637066]">
                {league.sport} / {formatSeason(league.season_start_date, league.season_end_date)}
              </p>
            </div>
            <Link
              href="/venue-availability"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#c7d3ca] bg-white px-5 text-sm font-semibold text-[#1f5b47] transition hover:border-[#9fb5a8] focus:outline-none focus:ring-2 focus:ring-[#1f5b47] focus:ring-offset-2"
            >
              Venue availability
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          {message ? <p className="mt-4 text-sm text-[#637066]">{message}</p> : null}
        </header>

        <section className="rounded-md border border-[#d6ded5] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[#18211c]">Generate schedule</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[#637066]">
                Create fixtures from captain availability and venue permits. Previous runs remain saved.
              </p>
            </div>
            {scheduleRun ? (
              <span className="inline-flex w-fit rounded-full bg-[#e9f1eb] px-3 py-1 text-xs font-semibold text-[#1f5b47]">
                {scheduleRun.solver_status}
              </span>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3 sm:items-end">
            <label className="block text-sm font-medium text-[#39433d]">
              Games per pair
              <input
                type="number"
                min="1"
                max="10"
                value={options.gamesPerPair}
                onChange={(event) =>
                  setOptions((current) => ({ ...current, gamesPerPair: event.target.value }))
                }
                className="mt-2 h-11 w-full rounded-md border border-[#cfd8d0] bg-white px-3 text-sm text-[#18211c] outline-none transition focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/15"
              />
              <span className="mt-1 block text-xs font-normal text-[#637066]">
                1 = single round robin; 2 = home and away.
              </span>
            </label>
            <label className="block text-sm font-medium text-[#39433d]">
              Max matches per team per day
              <input
                type="number"
                min="1"
                max="4"
                value={options.maxMatchesPerTeamPerDay}
                onChange={(event) =>
                  setOptions((current) => ({
                    ...current,
                    maxMatchesPerTeamPerDay: event.target.value,
                  }))
                }
                className="mt-2 h-11 w-full rounded-md border border-[#cfd8d0] bg-white px-3 text-sm text-[#18211c] outline-none transition focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/15"
              />
              <span className="mt-1 block text-xs font-normal text-[#637066]">
                Default is 1 to avoid same-day doubleheaders.
              </span>
            </label>
            <button
              type="button"
              onClick={generateSchedule}
              disabled={isGenerating}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#1f5b47] px-5 text-sm font-semibold text-white transition hover:bg-[#164333] focus:outline-none focus:ring-2 focus:ring-[#1f5b47] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isGenerating ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {isGenerating ? "Generating..." : scheduleRun ? "Regenerate schedule" : "Generate schedule"}
            </button>
          </div>
        </section>

        <section className="rounded-md border border-[#d6ded5] bg-white p-5 shadow-sm">
          {isLoading ? (
            <p className="text-sm text-[#637066]">Loading saved schedule...</p>
          ) : matches.length > 0 ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e1e7e0] pb-4">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-[#1f5b47]" aria-hidden="true" />
                  <h2 className="text-lg font-semibold text-[#18211c]">
                    {matches.length} scheduled matches
                  </h2>
                </div>
                <span className="text-xs text-[#637066]">
                  Generated {formatScheduleDate(scheduleRun?.created_at ?? "")}
                </span>
              </div>
              <div className="divide-y divide-[#e1e7e0]">
                {matches.map((match) => (
                  <div
                    key={match.id}
                    className="grid gap-3 py-4 sm:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)_200px] sm:items-center"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#18211c]">
                        {formatScheduleDate(match.starts_at)}
                      </p>
                      <p className="mt-1 text-sm text-[#637066]">
                        {formatScheduleTime(match.starts_at)} – {formatScheduleTime(match.ends_at)}
                      </p>
                    </div>
                    <TeamCell label="Home" value={match.home_team_name} />
                    <TeamCell label="Away" value={match.away_team_name} />
                    <div className="min-w-0">
                      <span className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase text-[#637066]">
                        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                        Venue
                      </span>
                      <p className="truncate text-sm font-medium text-[#39433d]">
                        {match.venue_name} / {match.field_label}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-md border border-dashed border-[#cfd8d0] bg-[#fbfcfa] px-4 py-6 text-sm text-[#637066]">
              No schedule has been generated yet. Confirm that every team has submitted availability and that venue permits cover the season.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function formatScheduleDate(value: string) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatScheduleTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function TeamCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="mb-1 block text-xs font-semibold uppercase text-[#637066] sm:hidden">
        {label}
      </span>
      <p className="truncate text-sm font-semibold text-[#18211c]">{value}</p>
    </div>
  );
}
