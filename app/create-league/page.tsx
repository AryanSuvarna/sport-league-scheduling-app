"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarRange,
  Clock3,
  ListChecks,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type LeagueForm = {
  leagueName: string;
  sport: string;
  seasonStartDate: string;
  seasonEndDate: string;
  matchDurationMinutes: string;
  maxMatchesPerTeamPerWeek: string;
  matchRules: string;
};

type TeamForm = {
  id: number;
  teamName: string;
  captainName: string;
  captainPhone: string;
  captainEmail: string;
};

const initialForm: LeagueForm = {
  leagueName: "",
  sport: "Cricket",
  seasonStartDate: "",
  seasonEndDate: "",
  matchDurationMinutes: "120",
  maxMatchesPerTeamPerWeek: "1",
  matchRules: "",
};

const initialTeams: TeamForm[] = [
  {
    id: 1,
    teamName: "",
    captainName: "",
    captainPhone: "",
    captainEmail: "",
  },
  {
    id: 2,
    teamName: "",
    captainName: "",
    captainPhone: "",
    captainEmail: "",
  },
];

export default function CreateLeaguePage() {
  const router = useRouter();
  const [form, setForm] = useState<LeagueForm>(initialForm);
  const [teams, setTeams] = useState<TeamForm[]>(initialTeams);
  const [message, setMessage] = useState("");
  const [isCreated, setIsCreated] = useState(false);
  const [createdLeagueId, setCreatedLeagueId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const rules = useMemo(() => splitLines(form.matchRules), [form.matchRules]);
  const completeTeams = teams.filter(
    (team) =>
      team.teamName.trim() && team.captainName.trim() && team.captainPhone.trim(),
  );
  const isReadyToCreate = Boolean(form.leagueName.trim() && completeTeams.length > 1);
  const seasonLabel =
    form.seasonStartDate && form.seasonEndDate
      ? `${form.seasonStartDate} to ${form.seasonEndDate}`
      : "Not set";

  function updateField(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;

    setMessage("");
    setIsCreated(false);
    setCreatedLeagueId("");
    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  function updateTeam(
    teamId: number,
    field: keyof Omit<TeamForm, "id">,
    value: string,
  ) {
    setMessage("");
    setIsCreated(false);
    setCreatedLeagueId("");
    setTeams((currentTeams) =>
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
    setIsCreated(false);
    setCreatedLeagueId("");
    setTeams((currentTeams) => [
      ...currentTeams,
      {
        id: Math.max(...currentTeams.map((team) => team.id)) + 1,
        teamName: "",
        captainName: "",
        captainPhone: "",
        captainEmail: "",
      },
    ]);
  }

  function removeTeam(teamId: number) {
    setMessage("");
    setIsCreated(false);
    setCreatedLeagueId("");
    setTeams((currentTeams) => {
      if (currentTeams.length === 1) {
        return currentTeams;
      }

      return currentTeams.filter((team) => team.id !== teamId);
    });
  }

  async function createLeague(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.leagueName.trim()) {
      setMessage("League name is required.");
      return;
    }

    if (!form.seasonStartDate || !form.seasonEndDate) {
      setMessage("Choose a season start and end date.");
      return;
    }

    if (form.seasonEndDate < form.seasonStartDate) {
      setMessage("Season end date must be on or after the start date.");
      return;
    }

    if (Number(form.matchDurationMinutes) <= 0) {
      setMessage("Match duration must be greater than 0.");
      return;
    }

    if (Number(form.maxMatchesPerTeamPerWeek) <= 0) {
      setMessage("Max matches per team per week must be greater than 0.");
      return;
    }

    if (completeTeams.length < 2) {
      setMessage("Add at least two complete teams.");
      return;
    }

    const hasIncompleteTeam = teams.some((team) => {
      const hasAnyTeamValue =
        team.teamName.trim() ||
        team.captainName.trim() ||
        team.captainPhone.trim() ||
        team.captainEmail.trim();

      return (
        hasAnyTeamValue &&
        (!team.teamName.trim() || !team.captainName.trim() || !team.captainPhone.trim())
      );
    });

    if (hasIncompleteTeam) {
      setMessage("Each started team needs a team name, captain name, and captain phone.");
      return;
    }

    const hasInvalidEmail = teams.some(
      (team) => team.captainEmail.trim() && !team.captainEmail.includes("@"),
    );

    if (hasInvalidEmail) {
      setMessage("Optional captain emails need to be valid email addresses.");
      return;
    }

    setIsSaving(true);
    setMessage("Creating league...");

    const supabase = createClient();
    const { data: league, error: leagueError } = await supabase
      .from("leagues")
      .insert({
        name: form.leagueName.trim(),
        sport: form.sport.trim(),
        season_start_date: form.seasonStartDate,
        season_end_date: form.seasonEndDate,
        match_duration_minutes: Number(form.matchDurationMinutes),
        max_matches_per_team_per_week: Number(form.maxMatchesPerTeamPerWeek),
        match_rules: rules,
      })
      .select("id")
      .single();

    if (leagueError || !league) {
      setIsSaving(false);
      setMessage(leagueError?.message || "Could not create the league.");
      return;
    }

    const { error: teamsError } = await supabase.from("league_teams").insert(
      completeTeams.map((team) => ({
        league_id: league.id,
        name: team.teamName.trim(),
        captain_name: team.captainName.trim(),
        captain_phone: team.captainPhone.trim(),
        captain_email: team.captainEmail.trim() || null,
      })),
    );

    if (teamsError) {
      await supabase.from("leagues").delete().eq("id", league.id);
      setIsSaving(false);
      setMessage(teamsError.message);
      return;
    }

    setIsSaving(false);
    setIsCreated(true);
    setCreatedLeagueId(league.id);
    setMessage("League created. Venue availability can be added later from the league page.");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#f6f7f4] text-[#18211c]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-4 py-6 sm:px-6 lg:px-8">
        <header className="border-b border-[#d6ded5] pb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#1f5b47] transition hover:text-[#164333]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Main page
          </Link>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium text-[#637066]">Create league</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#16211b] sm:text-4xl">
                League details
              </h1>
            </div>
            <Link
              href="/leagues"
              className="inline-flex h-11 items-center justify-center rounded-md border border-[#c7d3ca] bg-white px-5 text-sm font-semibold text-[#1f5b47] transition hover:border-[#9fb5a8] focus:outline-none focus:ring-2 focus:ring-[#1f5b47] focus:ring-offset-2"
            >
              View leagues
            </Link>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <form
            onSubmit={createLeague}
            className="rounded-md border border-[#d6ded5] bg-white p-5 shadow-sm"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-[#39433d]">
                League name
                <input
                  name="leagueName"
                  value={form.leagueName}
                  onChange={updateField}
                  placeholder="e.g. Peel Premier Cricket"
                  className="mt-2 h-11 w-full rounded-md border border-[#cfd8d0] bg-white px-3 text-sm text-[#18211c] outline-none transition placeholder:text-[#8a948d] focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/15"
                />
              </label>

              <label className="block text-sm font-medium text-[#39433d]">
                Sport
                <input
                  name="sport"
                  value={form.sport}
                  onChange={updateField}
                  className="mt-2 h-11 w-full rounded-md border border-[#cfd8d0] bg-white px-3 text-sm text-[#18211c] outline-none transition focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/15"
                />
              </label>

              <fieldset className="sm:col-span-2">
                <legend className="text-sm font-medium text-[#39433d]">Season</legend>
                <div className="mt-2 grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-[#637066]">
                    Start date
                    <input
                      type="date"
                      name="seasonStartDate"
                      value={form.seasonStartDate}
                      onChange={updateField}
                      className="mt-2 h-11 w-full rounded-md border border-[#cfd8d0] bg-white px-3 text-sm text-[#18211c] outline-none transition focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/15"
                    />
                  </label>
                  <label className="block text-sm font-medium text-[#637066]">
                    End date
                    <input
                      type="date"
                      name="seasonEndDate"
                      value={form.seasonEndDate}
                      onChange={updateField}
                      min={form.seasonStartDate || undefined}
                      className="mt-2 h-11 w-full rounded-md border border-[#cfd8d0] bg-white px-3 text-sm text-[#18211c] outline-none transition focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/15"
                    />
                  </label>
                </div>
              </fieldset>

              <label className="block text-sm font-medium text-[#39433d]">
                Match duration
                <div className="mt-2 flex h-11 overflow-hidden rounded-md border border-[#cfd8d0] bg-white focus-within:border-[#1f5b47] focus-within:ring-2 focus-within:ring-[#1f5b47]/15">
                  <input
                    name="matchDurationMinutes"
                    value={form.matchDurationMinutes}
                    onChange={updateField}
                    inputMode="numeric"
                    className="min-w-0 flex-1 px-3 text-sm text-[#18211c] outline-none"
                  />
                  <span className="flex items-center border-l border-[#cfd8d0] bg-[#fbfcfa] px-3 text-sm text-[#637066]">
                    minutes
                  </span>
                </div>
              </label>

              <label className="block text-sm font-medium text-[#39433d]">
                Max matches per team per week
                <input
                  name="maxMatchesPerTeamPerWeek"
                  value={form.maxMatchesPerTeamPerWeek}
                  onChange={updateField}
                  inputMode="numeric"
                  className="mt-2 h-11 w-full rounded-md border border-[#cfd8d0] bg-white px-3 text-sm text-[#18211c] outline-none transition focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/15"
                />
              </label>
            </div>

            <section className="mt-5 rounded-md border border-[#d6ded5] bg-[#fbfcfa] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-[#18211c]">Teams</h2>
                  <p className="mt-1 text-sm text-[#637066]">
                    Captain name and phone number are required for each team.
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
                {teams.map((team, index) => (
                  <div
                    key={team.id}
                    className="rounded-md border border-[#d6ded5] bg-white p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-[#18211c]">
                        Team {index + 1}
                      </h3>
                      <button
                        type="button"
                        onClick={() => removeTeam(team.id)}
                        disabled={teams.length === 1}
                        aria-label={`Remove team ${index + 1}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d7ded7] text-[#637066] transition hover:border-[#b6c5bb] hover:text-[#9a3d31] focus:outline-none focus:ring-2 focus:ring-[#1f5b47] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label className="block text-sm font-medium text-[#39433d]">
                        Team name
                        <input
                          value={team.teamName}
                          onChange={(event) =>
                            updateTeam(team.id, "teamName", event.target.value)
                          }
                          placeholder="e.g. Lions CC"
                          className="mt-2 h-11 w-full rounded-md border border-[#cfd8d0] bg-white px-3 text-sm text-[#18211c] outline-none transition placeholder:text-[#8a948d] focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/15"
                        />
                      </label>

                      <label className="block text-sm font-medium text-[#39433d]">
                        Team captain name
                        <input
                          value={team.captainName}
                          onChange={(event) =>
                            updateTeam(team.id, "captainName", event.target.value)
                          }
                          placeholder="Required"
                          className="mt-2 h-11 w-full rounded-md border border-[#cfd8d0] bg-white px-3 text-sm text-[#18211c] outline-none transition placeholder:text-[#8a948d] focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/15"
                        />
                      </label>

                      <label className="block text-sm font-medium text-[#39433d]">
                        Team captain phone number
                        <input
                          value={team.captainPhone}
                          onChange={(event) =>
                            updateTeam(team.id, "captainPhone", event.target.value)
                          }
                          inputMode="tel"
                          placeholder="Required"
                          className="mt-2 h-11 w-full rounded-md border border-[#cfd8d0] bg-white px-3 text-sm text-[#18211c] outline-none transition placeholder:text-[#8a948d] focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/15"
                        />
                      </label>

                      <label className="block text-sm font-medium text-[#39433d]">
                        Team captain email
                        <input
                          value={team.captainEmail}
                          onChange={(event) =>
                            updateTeam(team.id, "captainEmail", event.target.value)
                          }
                          inputMode="email"
                          placeholder="Optional"
                          className="mt-2 h-11 w-full rounded-md border border-[#cfd8d0] bg-white px-3 text-sm text-[#18211c] outline-none transition placeholder:text-[#8a948d] focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/15"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="mt-5">
              <label className="block text-sm font-medium text-[#39433d]">
                Match rules
                <textarea
                  name="matchRules"
                  value={form.matchRules}
                  onChange={updateField}
                  placeholder={"One rule per line\nNo team plays twice in a day\nBalance home and away games\nAvoid holiday weekends"}
                  rows={10}
                  className="mt-2 w-full resize-none rounded-md border border-[#cfd8d0] bg-white px-3 py-3 text-sm leading-6 text-[#18211c] outline-none transition placeholder:text-[#8a948d] focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/15"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-[#e3e8e2] pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-h-5 text-sm text-[#637066]">
                <p>{message}</p>
                {isCreated ? (
                  <Link
                    href={createdLeagueId ? `/leagues/${createdLeagueId}` : "/leagues"}
                    className="mt-2 inline-flex font-semibold text-[#1f5b47] transition hover:text-[#164333]"
                  >
                    View league
                  </Link>
                ) : null}
              </div>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#1f5b47] px-5 text-sm font-semibold text-white transition hover:bg-[#164333] focus:outline-none focus:ring-2 focus:ring-[#1f5b47] focus:ring-offset-2"
              >
                {isSaving ? "Creating..." : "Create league"}
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </form>

          <aside className="space-y-4">
            <SummaryMetric icon={Users} label="Complete teams" value={completeTeams.length} />
            <SummaryMetric icon={CalendarRange} label="Season" value={seasonLabel} />
            <SummaryMetric
              icon={Clock3}
              label="Match duration"
              value={`${form.matchDurationMinutes || 0} min`}
            />
            <SummaryMetric
              icon={CalendarRange}
              label="Weekly max"
              value={form.maxMatchesPerTeamPerWeek || 0}
            />
            <SummaryMetric icon={ListChecks} label="Rules" value={rules.length} />
            <div className="rounded-md border border-[#d6ded5] bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-[#18211c]">
                {isCreated
                  ? "League created"
                  : isReadyToCreate
                    ? "Ready to create"
                    : "Needs teams"}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#637066]">
                {isCreated
                  ? "Venue availability is optional and can be added later from the league page."
                  : isReadyToCreate
                    ? "Create the league now. Venue availability is not required."
                    : "Add a league name and at least two teams to create the league."}
              </p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
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
