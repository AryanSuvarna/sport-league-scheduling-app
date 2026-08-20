"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  Clock3,
  ListChecks,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { formatSeason, type League, type LeagueTeam } from "@/lib/leagues";
import { SchedulerRuleBuilder } from "@/components/SchedulerRuleBuilder";
import { parseSchedulerRules, ruleSummary, withWeeklyMatchLimit } from "@/lib/scheduling/rules";
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
  hasSubmittedAvailability: boolean;
  isNew: boolean;
};

export function LeagueDetailClient({ league }: LeagueDetailClientProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);
  const [sendingInviteTeamId, setSendingInviteTeamId] = useState<string | null>(null);
  const [removedTeamIds, setRemovedTeamIds] = useState<string[]>([]);
  const [editableLeague, setEditableLeague] = useState({
    name: league.name,
    sport: league.sport,
    seasonStartDate: league.season_start_date,
    seasonEndDate: league.season_end_date,
    matchDurationMinutes: String(league.match_duration_minutes),
    schedulerRules: withWeeklyMatchLimit(league.scheduler_rules, league.max_matches_per_team_per_week),
  });
  const [editableTeams, setEditableTeams] = useState<EditableTeam[]>(
    league.league_teams.map(formatEditableTeam),
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
        hasSubmittedAvailability: false,
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

    if (!parseSchedulerRules(editableLeague.schedulerRules)) {
      setMessage("Complete or remove every scheduler rule before saving.");
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
        scheduler_rules: editableLeague.schedulerRules,
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
    if (team.hasSubmittedAvailability) return;
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
                onClick={() => setIsDeleteConfirmationOpen(true)}
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
              <p className="text-sm font-medium text-[#637066]">Scheduling</p>
              <div className="mt-1 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[#18211c]">League schedule</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-[#637066]">
                    Review availability, generate fixtures, and view the latest schedule.
                  </p>
                </div>
                <Link
                  href={`/leagues/${league.id}/schedule`}
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-[#1f5b47] px-5 text-sm font-semibold text-white transition hover:bg-[#164333] focus:outline-none focus:ring-2 focus:ring-[#1f5b47] focus:ring-offset-2"
                >
                  Open schedule
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
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
                </div>

                <div className="mt-5">
                  <SchedulerRuleBuilder
                    rules={editableLeague.schedulerRules}
                    onChange={(schedulerRules) => {
                      setMessage("");
                      setEditableLeague((currentLeague) => ({ ...currentLeague, schedulerRules }));
                    }}
                  />
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
                            disabled={team.hasSubmittedAvailability || sendingInviteTeamId === team.id}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#c7d3ca] bg-white px-4 text-sm font-semibold text-[#1f5b47] transition hover:border-[#9fb5a8] focus:outline-none focus:ring-2 focus:ring-[#1f5b47] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            <MessageCircle className="h-4 w-4" aria-hidden="true" />
                            {team.hasSubmittedAvailability ? "Submitted" : sendingInviteTeamId === team.id ? "Sending..." : "Invite"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-md border border-[#d6ded5] bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-semibold text-[#18211c]">Scheduler rules</h2>
                  {editableLeague.schedulerRules.length > 0 ? (
                    <ul className="mt-4 space-y-2">
                      {editableLeague.schedulerRules.map((rule) => (
                        <li key={rule.id} className="rounded-md border border-[#e1e7e0] bg-[#fbfcfa] px-3 py-2 text-sm text-[#39433d]">
                          {ruleSummary(rule)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-4 text-sm text-[#637066]">No solver constraints added.</p>
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
            <SummaryMetric icon={ListChecks} label="Rules" value={editableLeague.schedulerRules.length} />
          </aside>
        </section>
      </div>
      {isDeleteConfirmationOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#18211c]/45 px-4" role="dialog" aria-modal="true" aria-labelledby="delete-league-title">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 id="delete-league-title" className="text-xl font-semibold text-[#18211c]">Delete league?</h2>
            <p className="mt-2 text-sm leading-6 text-[#637066]">Are you sure you want to delete <span className="font-semibold text-[#18211c]">{league.name}</span>? This permanently removes the league, its teams, availability, and schedules.</p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setIsDeleteConfirmationOpen(false)} disabled={isSaving} className="h-11 rounded-md border border-[#c7d3ca] bg-white px-4 text-sm font-semibold text-[#1f5b47] disabled:opacity-50">Cancel</button>
              <button type="button" onClick={() => void deleteLeague()} disabled={isSaving} className="h-11 rounded-md bg-[#9a3d31] px-4 text-sm font-semibold text-white hover:bg-[#7f3027] disabled:opacity-50">{isSaving ? "Deleting..." : "Delete league"}</button>
            </div>
          </div>
        </div>
      ) : null}
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
    hasSubmittedAvailability: Boolean(team.has_submitted_availability),
    isNew: false,
  };
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
