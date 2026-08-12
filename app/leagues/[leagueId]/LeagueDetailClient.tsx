"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  Clock3,
  ListChecks,
  LoaderCircle,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { formatSeason, type League, type LeagueTeam } from "@/lib/leagues";
import { createClient } from "@/lib/supabase/client";

type LeagueDetailClientProps = {
  league: League;
};

type EditableTeam = {
  id: string;
  name: string;
  captainName: string;
  captainPhone: string;
  captainEmail: string;
  isNew: boolean;
};

type ScheduleMatch = {
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

type ScheduleRun = {
  id: string;
  solver_status: string;
  objective_value: number | null;
  created_at: string;
};

export function LeagueDetailClient({ league }: LeagueDetailClientProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [sendingInviteTeamId, setSendingInviteTeamId] = useState<string | null>(null);
  const [removedTeamIds, setRemovedTeamIds] = useState<string[]>([]);
  const [isGeneratingSchedule, setIsGeneratingSchedule] = useState(false);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(true);
  const [scheduleRun, setScheduleRun] = useState<ScheduleRun | null>(null);
  const [scheduleMatches, setScheduleMatches] = useState<ScheduleMatch[]>([]);
  const [scheduleOptions, setScheduleOptions] = useState({
    gamesPerPair: "1",
    maxMatchesPerTeamPerDay: "1",
  });
  const [editableLeague, setEditableLeague] = useState({
    name: league.name,
    sport: league.sport,
    seasonStartDate: league.season_start_date,
    seasonEndDate: league.season_end_date,
    matchDurationMinutes: String(league.match_duration_minutes),
    maxMatchesPerTeamPerWeek: String(league.max_matches_per_team_per_week),
    rules: league.match_rules.join("\n"),
  });
  const [editableTeams, setEditableTeams] = useState<EditableTeam[]>(
    league.league_teams.map(formatEditableTeam),
  );

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

  useEffect(() => {
    let isCancelled = false;

    async function loadLatestSchedule() {
      setIsLoadingSchedule(true);

      const { data: run, error: runError } = await supabase
        .from("league_schedule_runs")
        .select("id, solver_status, objective_value, created_at")
        .eq("league_id", league.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (isCancelled) return;

      if (runError) {
        setMessage(`Could not load the latest schedule: ${runError.message}`);
        setIsLoadingSchedule(false);
        return;
      }

      if (!run) {
        setScheduleRun(null);
        setScheduleMatches([]);
        setIsLoadingSchedule(false);
        return;
      }

      const { data: rawMatches, error: matchesError } = await supabase
        .from("league_matches")
        .select("id, home_team_id, away_team_id, field_id, starts_at, ends_at")
        .eq("schedule_run_id", run.id)
        .order("starts_at", { ascending: true });

      if (isCancelled) return;

      if (matchesError) {
        setMessage(`Could not load schedule matches: ${matchesError.message}`);
        setIsLoadingSchedule(false);
        return;
      }

      const fieldIds = [...new Set((rawMatches ?? []).map((match) => match.field_id))];
      const { data: fields } = fieldIds.length
        ? await supabase.from("fields").select("id, label, venues(name)").in("id", fieldIds)
        : { data: [] };
      const teamNames = new Map(league.league_teams.map((team) => [team.id, team.name]));
      const fieldRows = (fields ?? []) as unknown as Array<{
        id: string;
        label: string;
        venues: { name: string } | null;
      }>;
      const fieldById = new Map(
        fieldRows.map((field) => [field.id, { label: field.label, venue: field.venues?.name ?? "Venue" }]),
      );

      if (isCancelled) return;

      setScheduleRun(run as ScheduleRun);
      setScheduleMatches(
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
      setIsLoadingSchedule(false);
    }

    void loadLatestSchedule();

    return () => {
      isCancelled = true;
    };
  }, [league.id, league.league_teams, supabase]);

  function updateField(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;

    setMessage("");
    setEditableLeague((currentLeague) => ({
      ...currentLeague,
      [name]: value,
    }));
  }

  function updateTeam(teamId: string, field: keyof Omit<EditableTeam, "id" | "isNew">, value: string) {
    setMessage("");
    setEditableTeams((currentTeams) =>
      currentTeams.map((team) =>
        team.id === teamId
          ? {
              ...team,
              [field]: value,
            }
          : team,
      ),
    );
  }

  function addTeam() {
    setMessage("");
    setEditableTeams((currentTeams) => [
      ...currentTeams,
      {
        id: `new-${Date.now()}`,
        name: "",
        captainName: "",
        captainPhone: "",
        captainEmail: "",
        isNew: true,
      },
    ]);
  }

  function removeTeam(teamId: string) {
    setMessage("");
    setEditableTeams((currentTeams) => {
      const teamToRemove = currentTeams.find((team) => team.id === teamId);

      if (currentTeams.length === 1 || !teamToRemove) {
        return currentTeams;
      }

      if (!teamToRemove.isNew) {
        setRemovedTeamIds((currentIds) => [...currentIds, teamId]);
      }

      return currentTeams.filter((team) => team.id !== teamId);
    });
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

    const completeTeams = editableTeams.filter(
      (team) => team.name.trim() && team.captainName.trim() && team.captainPhone.trim(),
    );

    if (completeTeams.length < 2) {
      setMessage("Add at least two complete teams.");
      return;
    }

    const hasIncompleteTeam = editableTeams.some((team) => {
      const hasAnyTeamValue =
        team.name.trim() ||
        team.captainName.trim() ||
        team.captainPhone.trim() ||
        team.captainEmail.trim();

      return (
        hasAnyTeamValue &&
        (!team.name.trim() || !team.captainName.trim() || !team.captainPhone.trim())
      );
    });

    if (hasIncompleteTeam) {
      setMessage("Each started team needs a team name, captain name, and captain phone.");
      return;
    }

    const hasInvalidEmail = editableTeams.some(
      (team) => team.captainEmail.trim() && !team.captainEmail.includes("@"),
    );

    if (hasInvalidEmail) {
      setMessage("Optional captain emails need to be valid email addresses.");
      return;
    }

    setIsSaving(true);

    const supabase = createClient();
    const { error: leagueError } = await supabase
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

    if (leagueError) {
      setIsSaving(false);
      setMessage(leagueError.message);
      return;
    }

    const existingTeamUpdates = editableTeams
      .filter((team) => !team.isNew)
      .map((team) =>
        supabase
          .from("league_teams")
          .update({
            name: team.name.trim(),
            captain_name: team.captainName.trim(),
            captain_phone: team.captainPhone.trim(),
            captain_email: team.captainEmail.trim() || null,
          })
          .eq("id", team.id),
      );
    const teamUpdateResults = await Promise.all(existingTeamUpdates);
    const teamUpdateError = teamUpdateResults.find((result) => result.error)?.error;

    if (teamUpdateError) {
      setIsSaving(false);
      setMessage(teamUpdateError.message);
      return;
    }

    const newTeams = editableTeams.filter((team) => team.isNew);

    if (newTeams.length > 0) {
      const { error: insertTeamsError } = await supabase.from("league_teams").insert(
        newTeams.map((team) => ({
          league_id: league.id,
          name: team.name.trim(),
          captain_name: team.captainName.trim(),
          captain_phone: team.captainPhone.trim(),
          captain_email: team.captainEmail.trim() || null,
        })),
      );

      if (insertTeamsError) {
        setIsSaving(false);
        setMessage(insertTeamsError.message);
        return;
      }
    }

    if (removedTeamIds.length > 0) {
      const { error: deleteTeamsError } = await supabase
        .from("league_teams")
        .delete()
        .in("id", removedTeamIds);

      if (deleteTeamsError) {
        setIsSaving(false);
        setMessage(deleteTeamsError.message);
        return;
      }
    }

    setIsSaving(false);
    setRemovedTeamIds([]);
    setEditableTeams((currentTeams) =>
      currentTeams.map((team) => ({
        ...team,
        isNew: false,
      })),
    );
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

  async function sendWhatsAppInvite(team: EditableTeam) {
    setMessage("");
    setSendingInviteTeamId(team.id);

    try {
      const response = await fetch("/api/whatsapp/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          captainName: team.captainName,
          captainPhone: team.captainPhone,
          leagueId: league.id,
          teamId: team.id,
          teamName: team.name,
          leagueName: editableLeague.name,
        }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(result?.error || "Could not send WhatsApp invite.");
        return;
      }

      setMessage(`WhatsApp invite sent to ${team.captainName}.`);
    } catch {
      setMessage("Could not reach the WhatsApp invite endpoint.");
    } finally {
      setSendingInviteTeamId(null);
    }
  }

  async function generateSchedule() {
    const gamesPerPair = Number(scheduleOptions.gamesPerPair);
    const maxMatchesPerTeamPerDay = Number(scheduleOptions.maxMatchesPerTeamPerDay);

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

    setIsGeneratingSchedule(true);
    setMessage("");

    try {
      const response = await fetch(`/api/leagues/${league.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gamesPerPair, maxMatchesPerTeamPerDay }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        const missingTeams = result?.missing_teams?.join(", ");
        setMessage(
          missingTeams
            ? `${result?.error ?? "Could not generate schedule."} Missing: ${missingTeams}`
            : result?.error ?? "Could not generate schedule.",
        );
        return;
      }

      setMessage(`Schedule generated with ${result.matches?.length ?? 0} matches.`);
      router.refresh();
      // Reloading the page data is unnecessary; the schedule effect below reads
      // the newest persisted run after this request completes.
      const { data: latestRun } = await supabase
        .from("league_schedule_runs")
        .select("id, solver_status, objective_value, created_at")
        .eq("league_id", league.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestRun) {
        const { data: latestMatches } = await supabase
          .from("league_matches")
          .select("id, home_team_id, away_team_id, field_id, starts_at, ends_at")
          .eq("schedule_run_id", latestRun.id)
          .order("starts_at", { ascending: true });
        const teamNames = new Map(league.league_teams.map((team) => [team.id, team.name]));
        const fieldIds = [...new Set((latestMatches ?? []).map((match) => match.field_id))];
        const { data: fields } = fieldIds.length
          ? await supabase.from("fields").select("id, label, venues(name)").in("id", fieldIds)
          : { data: [] };
        const fieldRows = (fields ?? []) as unknown as Array<{
          id: string;
          label: string;
          venues: { name: string } | null;
        }>;
        const fieldById = new Map(
          fieldRows.map((field) => [field.id, { label: field.label, venue: field.venues?.name ?? "Venue" }]),
        );
        setScheduleRun(latestRun as ScheduleRun);
        setScheduleMatches(
          (latestMatches ?? []).map((match) => {
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
      }
    } catch {
      setMessage("Could not reach the scheduling service.");
    } finally {
      setIsGeneratingSchedule(false);
    }
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
              <Link
                href="/venue-availability"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#1f5b47] px-5 text-sm font-semibold text-white transition hover:bg-[#164333] focus:outline-none focus:ring-2 focus:ring-[#1f5b47] focus:ring-offset-2"
              >
                Add venue availability
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
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
            <section className="rounded-md border border-[#d6ded5] bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-[#637066]">Scheduling</p>
                  <h2 className="mt-1 text-xl font-semibold text-[#18211c]">Generate schedule</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-[#637066]">
                    Create a deterministic fixture list from team availability and venue permits.
                    Existing generated runs remain saved in Supabase.
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
                    value={scheduleOptions.gamesPerPair}
                    onChange={(event) =>
                      setScheduleOptions((current) => ({
                        ...current,
                        gamesPerPair: event.target.value,
                      }))
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
                    value={scheduleOptions.maxMatchesPerTeamPerDay}
                    onChange={(event) =>
                      setScheduleOptions((current) => ({
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
                  disabled={isGeneratingSchedule}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#1f5b47] px-5 text-sm font-semibold text-white transition hover:bg-[#164333] focus:outline-none focus:ring-2 focus:ring-[#1f5b47] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isGeneratingSchedule ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  {isGeneratingSchedule ? "Generating..." : "Generate schedule"}
                </button>
              </div>

              {isLoadingSchedule ? (
                <p className="mt-6 text-sm text-[#637066]">Loading saved schedule...</p>
              ) : scheduleMatches.length > 0 ? (
                <div className="mt-6 overflow-hidden rounded-md border border-[#e1e7e0]">
                  <div className="border-b border-[#e1e7e0] bg-[#fbfcfa] px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-[#18211c]">
                        {scheduleMatches.length} scheduled matches
                      </h3>
                      <span className="text-xs text-[#637066]">
                        Generated {formatScheduleDate(scheduleRun?.created_at ?? "")}
                      </span>
                    </div>
                  </div>
                  <div className="divide-y divide-[#e1e7e0]">
                    {scheduleMatches.map((match) => (
                      <div
                        key={match.id}
                        className="grid gap-2 px-4 py-4 sm:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)_170px] sm:items-center"
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
                        <div className="text-sm text-[#637066]">
                          <span className="mb-1 block text-xs font-semibold uppercase text-[#637066]">
                            Venue
                          </span>
                          <p className="font-medium text-[#39433d]">
                            {match.venue_name} / {match.field_label}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-md border border-dashed border-[#cfd8d0] bg-[#fbfcfa] px-4 py-5 text-sm text-[#637066]">
                  No schedule has been generated yet. Confirm that every team has submitted availability and that venue permits cover the season.
                </div>
              )}
            </section>

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

                <section className="mt-5 rounded-md border border-[#d6ded5] bg-[#fbfcfa] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-[#18211c]">Teams</h3>
                      <p className="mt-1 text-sm text-[#637066]">
                        Captain name and phone number are required.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addTeam}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#c7d3ca] bg-white px-4 text-sm font-semibold text-[#1f5b47] transition hover:border-[#9fb5a8] focus:outline-none focus:ring-2 focus:ring-[#1f5b47] focus:ring-offset-2"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Add team
                    </button>
                  </div>

                  <div className="mt-4 space-y-4">
                    {editableTeams.map((team, index) => (
                      <div
                        key={team.id}
                        className="rounded-md border border-[#d6ded5] bg-white p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="text-sm font-semibold text-[#18211c]">
                            Team {index + 1}
                          </h4>
                          <button
                            type="button"
                            onClick={() => removeTeam(team.id)}
                            disabled={editableTeams.length === 1}
                            aria-label={`Remove team ${index + 1}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d7ded7] text-[#637066] transition hover:border-[#b6c5bb] hover:text-[#9a3d31] focus:outline-none focus:ring-2 focus:ring-[#1f5b47] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>

                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          <EditField
                            label="Team name"
                            name="name"
                            value={team.name}
                            onChange={(event) =>
                              updateTeam(team.id, "name", event.target.value)
                            }
                          />
                          <EditField
                            label="Team captain name"
                            name="captainName"
                            value={team.captainName}
                            onChange={(event) =>
                              updateTeam(team.id, "captainName", event.target.value)
                            }
                          />
                          <EditField
                            label="Team captain phone number"
                            name="captainPhone"
                            value={team.captainPhone}
                            onChange={(event) =>
                              updateTeam(team.id, "captainPhone", event.target.value)
                            }
                          />
                          <EditField
                            label="Team captain email"
                            name="captainEmail"
                            value={team.captainEmail}
                            onChange={(event) =>
                              updateTeam(team.id, "captainEmail", event.target.value)
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

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

            {!isEditing ? (
              <>
                <section className="rounded-md border border-[#d6ded5] bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-semibold text-[#18211c]">Teams</h2>
                  <div className="mt-4 overflow-hidden rounded-md border border-[#e1e7e0]">
                    <div className="hidden grid-cols-[1.2fr_1fr_1.2fr_150px] gap-3 border-b border-[#e1e7e0] bg-[#fbfcfa] px-4 py-3 text-xs font-semibold uppercase text-[#637066] md:grid">
                      <span>Team</span>
                      <span>Phone number</span>
                      <span>Email</span>
                      <span>Send invite for availability</span>
                    </div>
                    {editableTeams.map((team) => (
                      <div
                        key={team.id}
                        className="grid gap-3 border-b border-[#e1e7e0] bg-white px-4 py-4 last:border-b-0 md:grid-cols-[1.2fr_1fr_1.2fr_150px] md:items-center"
                      >
                        <TeamCell label="Team" value={team.name} detail={team.captainName} />
                        <TeamCell label="Phone number" value={team.captainPhone} />
                        <TeamCell label="Email" value={team.captainEmail || "No email"} />
                        <div>
                          <span className="mb-1 block text-xs font-semibold uppercase text-[#637066] md:hidden">
                            Send invite for availability
                          </span>
                          <button
                            type="button"
                            onClick={() => sendWhatsAppInvite(team)}
                            disabled={sendingInviteTeamId === team.id}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#c7d3ca] bg-white px-4 text-sm font-semibold text-[#1f5b47] transition hover:border-[#9fb5a8] focus:outline-none focus:ring-2 focus:ring-[#1f5b47] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <MessageCircle className="h-4 w-4" aria-hidden="true" />
                            {sendingInviteTeamId === team.id ? "Sending..." : "Invite"}
                          </button>
                        </div>
                      </div>
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
              </>
            ) : null}
          </div>

          <aside className="space-y-4">
            <SummaryMetric icon={Users} label="Teams" value={editableTeams.length} />
            <SummaryMetric icon={CalendarRange} label="Season" value={seasonLabel} />
            <SummaryMetric
              icon={Clock3}
              label="Match duration"
              value={`${editableLeague.matchDurationMinutes || 0} min`}
            />
            <SummaryMetric icon={ListChecks} label="Rules" value={rules.length} />
          </aside>
        </section>
      </div>
    </main>
  );
}

function formatEditableTeam(team: LeagueTeam): EditableTeam {
  return {
    id: team.id,
    name: team.name,
    captainName: team.captain_name,
    captainPhone: team.captain_phone,
    captainEmail: team.captain_email || "",
    isNew: false,
  };
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

function TeamCell({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="min-w-0">
      <span className="mb-1 block text-xs font-semibold uppercase text-[#637066] md:hidden">
        {label}
      </span>
      <p className="truncate text-sm font-semibold text-[#18211c]">{value}</p>
      {detail ? <p className="mt-1 truncate text-sm text-[#637066]">{detail}</p> : null}
    </div>
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
