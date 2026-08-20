"use client";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  CalendarCheck,
  CalendarDays,
  CircleAlert,
  Clock3,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "react-hot-toast";

type Weekday =
  | "Sunday"
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday";
type TimeOfDay = "Morning" | "Afternoon" | "Evening";

type TeamCaptainForm = {
  leagueId: string;
  teamId: string;
  availableStartDate: string;
  availableEndDate: string;
  availableDates: string[];
  hasDayPreference: boolean;
  preferredDaysOfWeek: Weekday[];
  hasTimePreference: boolean;
  preferredTimesOfDay: TimeOfDay[];
  blackoutDates: string[];
  notes: string;
};

type LeagueTeam = {
  id: string;
  name: string;
  captain_name: string;
  captain_email: string | null;
};

type League = {
  id: string;
  name: string;
  sport: string;
  season_start_date: string;
  season_end_date: string;
  league_teams: LeagueTeam[];
};

const weekdayOptions: Weekday[] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const timeOfDayOptions: TimeOfDay[] = ["Morning", "Afternoon", "Evening"];

const initialForm: TeamCaptainForm = {
  leagueId: "",
  teamId: "",
  availableStartDate: "",
  availableEndDate: "",
  availableDates: [""],
  hasDayPreference: false,
  preferredDaysOfWeek: [],
  hasTimePreference: false,
  preferredTimesOfDay: [],
  blackoutDates: [""],
  notes: "",
};

function getInitialForm() {
  if (typeof window === "undefined") {
    return initialForm;
  }

  const searchParams = new URLSearchParams(window.location.search);

  return {
    ...initialForm,
    leagueId: searchParams.get("leagueId") || "",
    teamId: searchParams.get("teamId") || "",
  };
}

function compactDates(dates: string[]) {
  return dates.filter(Boolean);
}

function isInsideSeason(date: string, league: League | null) {
  return Boolean(
    league && date >= league.season_start_date && date <= league.season_end_date,
  );
}

function subscribeToLocation() {
  return () => {};
}

function getInviteLockSnapshot() {
  if (typeof window === "undefined") {
    return true;
  }

  const searchParams = new URLSearchParams(window.location.search);
  return Boolean(searchParams.get("leagueId") && searchParams.get("teamId"));
}

function getInviteLockServerSnapshot() {
  return true;
}

export default function TeamCaptainPage() {
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<TeamCaptainForm>(getInitialForm);
  const [isSaving, setIsSaving] = useState(false);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [isLoadingLeagues, setIsLoadingLeagues] = useState(true);
  const isInviteLink = useSyncExternalStore(
    subscribeToLocation,
    getInviteLockSnapshot,
    getInviteLockServerSnapshot,
  );

  const availableDates = compactDates(form.availableDates);
  const blackoutDates = compactDates(form.blackoutDates);
  const hasAvailabilityRange = form.availableStartDate && form.availableEndDate;
  const hasAvailableDates = availableDates.length > 0;
  const selectedLeague = useMemo(
    () => leagues.find((league) => league.id === form.leagueId) ?? null,
    [form.leagueId, leagues],
  );
  const selectedTeam = useMemo(
    () => selectedLeague?.league_teams.find((team) => team.id === form.teamId) ?? null,
    [form.teamId, selectedLeague],
  );

  useEffect(() => {
    async function loadLeagues() {
      const { data, error } = await supabase
        .from("leagues")
        .select("id, name, sport, season_start_date, season_end_date, league_teams(id, name, captain_name, captain_email)")
        .order("name", { ascending: true });

      if (error) {
        toast.error(`Could not load leagues: ${error.message}`);
      } else {
        setLeagues((data ?? []) as League[]);
      }

      setIsLoadingLeagues(false);
    }

    void loadLeagues();
  }, [supabase]);

  function updateField(field: keyof TeamCaptainForm, value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function updateDateList(
    field: "availableDates" | "blackoutDates",
    index: number,
    value: string,
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: currentForm[field].map((date, dateIndex) =>
        dateIndex === index ? value : date,
      ),
    }));
  }

  function addDateListItem(field: "availableDates" | "blackoutDates") {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: [...currentForm[field], ""],
    }));
  }

  function removeDateListItem(field: "availableDates" | "blackoutDates", index: number) {
    setForm((currentForm) => {
      const nextDates = currentForm[field].filter((_, dateIndex) => dateIndex !== index);

      return {
        ...currentForm,
        [field]: nextDates.length > 0 ? nextDates : [""],
      };
    });
  }

  function setAnyDayPreference() {
    setForm((currentForm) => ({
      ...currentForm,
      hasDayPreference: false,
      preferredDaysOfWeek: [],
    }));
  }

  function togglePreferredDay(day: Weekday) {
    setForm((currentForm) => {
      const isSelected = currentForm.preferredDaysOfWeek.includes(day);
      const nextDays = isSelected
        ? currentForm.preferredDaysOfWeek.filter((preferredDay) => preferredDay !== day)
        : [...currentForm.preferredDaysOfWeek, day];

      return {
        ...currentForm,
        hasDayPreference: nextDays.length > 0,
        preferredDaysOfWeek: nextDays,
      };
    });
  }

  function setAnyTimePreference() {
    setForm((currentForm) => ({
      ...currentForm,
      hasTimePreference: false,
      preferredTimesOfDay: [],
    }));
  }

  function toggleTimeOfDay(option: TimeOfDay) {
    setForm((currentForm) => {
      const isSelected = currentForm.preferredTimesOfDay.includes(option);
      const nextTimes = isSelected
        ? currentForm.preferredTimesOfDay.filter((time) => time !== option)
        : [...currentForm.preferredTimesOfDay, option];

      return {
        ...currentForm,
        hasTimePreference: nextTimes.length > 0,
        preferredTimesOfDay: nextTimes,
      };
    });
  }

  function validateForm() {
    if (!selectedLeague) {
      return "Choose your league.";
    }

    if (!selectedTeam) {
      return "Choose your team.";
    }

    if (!hasAvailabilityRange && !hasAvailableDates) {
      return "Add an availability range or at least one available date.";
    }

    if (form.availableStartDate && !isInsideSeason(form.availableStartDate, selectedLeague)) {
      return "Availability start date must be inside the league season.";
    }

    if (form.availableEndDate && !isInsideSeason(form.availableEndDate, selectedLeague)) {
      return "Availability end date must be inside the league season.";
    }

    if (
      form.availableStartDate &&
      form.availableEndDate &&
      form.availableEndDate < form.availableStartDate
    ) {
      return "Availability end date must be on or after the start date.";
    }

    if (availableDates.some((date) => !isInsideSeason(date, selectedLeague))) {
      return "Specific available dates must be inside the league season.";
    }

    if (blackoutDates.some((date) => !isInsideSeason(date, selectedLeague))) {
      return "Blackout dates must be inside the league season.";
    }

    const availableDateSet = new Set(availableDates);
    const blackoutOutsideAvailableDates = blackoutDates.some((blackoutDate) => {
      const isSpecificAvailableDate = availableDateSet.has(blackoutDate);
      const isInsideAvailableRange = Boolean(
        form.availableStartDate &&
          form.availableEndDate &&
          blackoutDate >= form.availableStartDate &&
          blackoutDate <= form.availableEndDate,
      );

      return !isSpecificAvailableDate && !isInsideAvailableRange;
    });

    if (blackoutOutsideAvailableDates) {
      return "Blackout dates must be inside the available range or listed available dates.";
    }

    return "";
  }

  async function submitAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsSaving(true);

    const { error } = await supabase.from("team_availability_submissions").insert({
      team_id: selectedTeam!.id,
      available_start_date: form.availableStartDate || null,
      available_end_date: form.availableEndDate || null,
      available_dates: availableDates,
      has_day_preference: form.hasDayPreference,
      preferred_days_of_week: form.preferredDaysOfWeek,
      has_time_preference: form.hasTimePreference,
      preferred_times_of_day: form.preferredTimesOfDay,
      blackout_dates: blackoutDates,
      notes: form.notes.trim(),
    });

    if (error) {
      toast.error(`Could not submit availability: ${error.message}`);
      setIsSaving(false);
      return;
    }

    setForm((currentForm) =>
      isInviteLink
        ? { ...initialForm, leagueId: currentForm.leagueId, teamId: currentForm.teamId }
        : initialForm,
    );
    toast.success("Availability submitted.");
    setIsSaving(false);
  }

  return (
    <main className="min-h-screen bg-[#f6f7f4] text-[#1b241f]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-7 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-[#d6ded5] pb-6">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-[#637066]">
            <span>Aryan Suvarna</span>
            <span aria-hidden="true">/</span>
            <span>Cricket League - Mississauga</span>
            <span aria-hidden="true">/</span>
            <span className="text-[#1f5b47]">Team Captain</span>
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-normal text-[#16211b] sm:text-4xl">
              Team captain availability
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#58635c] sm:text-base">
              Submit the dates and dayparts your team can play before scheduling starts.
            </p>
          </div>
        </header>

        <form
          onSubmit={submitAvailability}
          className="grid gap-5 rounded-lg border border-[#d6ded5] bg-white p-5 shadow-sm"
        >
          <section className="grid gap-4">
            <div className="flex items-center gap-2">
              <CalendarCheck aria-hidden="true" size={18} className="text-[#1f5b47]" />
              <h2 className="text-lg font-semibold text-[#16211b]">Team details</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-[#2f3d34]">
                League
                <select
                  value={form.leagueId}
                  onChange={(event) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      leagueId: event.target.value,
                      teamId: "",
                    }))
                  }
                  required
                  disabled={isInviteLink}
                  className="h-11 rounded-md border border-[#cbd5cf] bg-white px-3 text-base text-[#16211b] outline-none transition placeholder:text-[#8a968f] focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/20 disabled:cursor-not-allowed disabled:bg-[#f1f4ef] disabled:text-[#58635c]"
                >
                  <option value="">{isLoadingLeagues ? "Loading leagues..." : "Choose a league"}</option>
                  {leagues.map((league) => (
                    <option key={league.id} value={league.id}>
                      {league.name} · {league.sport}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-[#2f3d34]">
                Team
                <select
                  value={form.teamId}
                  onChange={(event) => updateField("teamId", event.target.value)}
                  required
                  disabled={!selectedLeague || isInviteLink}
                  className="h-11 rounded-md border border-[#cbd5cf] bg-white px-3 text-base text-[#16211b] outline-none transition placeholder:text-[#8a968f] focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/20 disabled:cursor-not-allowed disabled:bg-[#f1f4ef] disabled:text-[#58635c]"
                >
                  <option value="">{selectedLeague ? "Choose your team" : "Choose a league first"}</option>
                  {selectedLeague?.league_teams.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </label>
            </div>

            {selectedLeague ? (
              <div className="rounded-md border border-[#d6ded5] bg-[#f7faf5] px-3 py-2 text-sm font-medium text-[#405047]">
                League season: <span className="text-[#16211b]">{selectedLeague.season_start_date} to {selectedLeague.season_end_date}</span>
                {selectedTeam ? <span className="block mt-1 text-xs">Captain: {selectedTeam.captain_name}{selectedTeam.captain_email ? ` · ${selectedTeam.captain_email}` : ""}</span> : null}
              </div>
            ) : null}
          </section>

          <section className="grid gap-4 border-t border-[#e1e7e2] pt-5">
            <div className="flex items-center gap-2">
              <CalendarCheck aria-hidden="true" size={18} className="text-[#1f5b47]" />
              <h2 className="text-lg font-semibold text-[#16211b]">Available dates</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-[#2f3d34]">
                Range start
                <input
                  type="date"
                  min={selectedLeague?.season_start_date ?? ""}
                  max={selectedLeague?.season_end_date ?? ""}
                  value={form.availableStartDate}
                  onChange={(event) =>
                    updateField("availableStartDate", event.target.value)
                  }
                  className="h-11 rounded-md border border-[#cbd5cf] bg-white px-3 text-base text-[#16211b] outline-none transition focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/20"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-[#2f3d34]">
                Range end
                <input
                  type="date"
                  min={selectedLeague?.season_start_date ?? ""}
                  max={selectedLeague?.season_end_date ?? ""}
                  value={form.availableEndDate}
                  onChange={(event) => updateField("availableEndDate", event.target.value)}
                  className="h-11 rounded-md border border-[#cbd5cf] bg-white px-3 text-base text-[#16211b] outline-none transition focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/20"
                />
              </label>
            </div>

            <div className="grid gap-3">
              {form.availableDates.map((date, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[1fr_44px]">
                  <label className="grid gap-2 text-sm font-medium text-[#2f3d34]">
                    Specific available date {index + 1}
                    <input
                      type="date"
                      min={selectedLeague?.season_start_date ?? ""}
                      max={selectedLeague?.season_end_date ?? ""}
                      value={date}
                      onChange={(event) =>
                        updateDateList("availableDates", index, event.target.value)
                      }
                      className="h-11 rounded-md border border-[#cbd5cf] bg-white px-3 text-base text-[#16211b] outline-none transition focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/20"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeDateListItem("availableDates", index)}
                    aria-label={`Remove available date ${index + 1}`}
                    title="Remove date"
                    className="mt-auto flex h-11 w-11 items-center justify-center rounded-md border border-[#cad4cc] text-[#405047] transition hover:bg-[#f1f4ef] focus:outline-none focus:ring-2 focus:ring-[#9aa79f] focus:ring-offset-2"
                  >
                    <Trash2 aria-hidden="true" size={17} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addDateListItem("availableDates")}
                className="flex h-10 w-fit items-center gap-2 rounded-md border border-[#cad4cc] px-4 text-sm font-semibold text-[#1f5b47] transition hover:bg-[#f1f4ef] focus:outline-none focus:ring-2 focus:ring-[#9aa79f] focus:ring-offset-2"
              >
                <Plus aria-hidden="true" size={16} />
                Add available date
              </button>
            </div>
          </section>

          <section className="grid gap-4 border-t border-[#e1e7e2] pt-5">
            <div className="flex items-center gap-2">
              <CalendarDays aria-hidden="true" size={18} className="text-[#b97913]" />
              <h2 className="text-lg font-semibold text-[#16211b]">
                Preferred days of week
              </h2>
            </div>

            <div className="grid gap-2 sm:grid-cols-4">
              <button
                type="button"
                onClick={setAnyDayPreference}
                aria-pressed={!form.hasDayPreference}
                className={`h-11 rounded-md border px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#b97913] focus:ring-offset-2 ${
                  !form.hasDayPreference
                    ? "border-[#e2b65c] bg-[#fff6df] text-[#8a5a0a]"
                    : "border-[#cad4cc] text-[#405047] hover:bg-[#f1f4ef]"
                }`}
              >
                Any day
              </button>

              {weekdayOptions.map((day) => {
                const isSelected = form.preferredDaysOfWeek.includes(day);

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => togglePreferredDay(day)}
                    aria-pressed={isSelected}
                    className={`h-11 rounded-md border px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#b97913] focus:ring-offset-2 ${
                      isSelected
                        ? "border-[#e2b65c] bg-[#fff6df] text-[#8a5a0a]"
                        : "border-[#cad4cc] text-[#405047] hover:bg-[#f1f4ef]"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="grid gap-4 border-t border-[#e1e7e2] pt-5">
            <div className="flex items-center gap-2">
              <Clock3 aria-hidden="true" size={18} className="text-[#34506d]" />
              <h2 className="text-lg font-semibold text-[#16211b]">
                Preferred time of day
              </h2>
            </div>

            <div className="grid gap-2 sm:grid-cols-4">
              <button
                type="button"
                onClick={setAnyTimePreference}
                aria-pressed={!form.hasTimePreference}
                className={`h-11 rounded-md border px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#34506d] focus:ring-offset-2 ${
                  !form.hasTimePreference
                    ? "border-[#b8c8db] bg-[#eaf0f7] text-[#34506d]"
                    : "border-[#cad4cc] text-[#405047] hover:bg-[#f1f4ef]"
                }`}
              >
                Any time
              </button>

              {timeOfDayOptions.map((option) => {
                const isSelected = form.preferredTimesOfDay.includes(option);

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleTimeOfDay(option)}
                    aria-pressed={isSelected}
                    className={`h-11 rounded-md border px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#34506d] focus:ring-offset-2 ${
                      isSelected
                        ? "border-[#b8c8db] bg-[#eaf0f7] text-[#34506d]"
                        : "border-[#cad4cc] text-[#405047] hover:bg-[#f1f4ef]"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="grid gap-4 border-t border-[#e1e7e2] pt-5">
            <div className="flex items-center gap-2">
              <CircleAlert aria-hidden="true" size={18} className="text-[#8a3829]" />
              <h2 className="text-lg font-semibold text-[#16211b]">
                Blackout dates
              </h2>
            </div>

            <div className="grid gap-3">
              {form.blackoutDates.map((date, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[1fr_44px]">
                  <label className="grid gap-2 text-sm font-medium text-[#2f3d34]">
                    Unavailable date {index + 1}
                    <input
                      type="date"
                      min={selectedLeague?.season_start_date ?? ""}
                      max={selectedLeague?.season_end_date ?? ""}
                      value={date}
                      onChange={(event) =>
                        updateDateList("blackoutDates", index, event.target.value)
                      }
                      className="h-11 rounded-md border border-[#cbd5cf] bg-white px-3 text-base text-[#16211b] outline-none transition focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/20"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeDateListItem("blackoutDates", index)}
                    aria-label={`Remove blackout date ${index + 1}`}
                    title="Remove date"
                    className="mt-auto flex h-11 w-11 items-center justify-center rounded-md border border-[#cad4cc] text-[#405047] transition hover:bg-[#f1f4ef] focus:outline-none focus:ring-2 focus:ring-[#9aa79f] focus:ring-offset-2"
                  >
                    <Trash2 aria-hidden="true" size={17} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addDateListItem("blackoutDates")}
                className="flex h-10 w-fit items-center gap-2 rounded-md border border-[#cad4cc] px-4 text-sm font-semibold text-[#1f5b47] transition hover:bg-[#f1f4ef] focus:outline-none focus:ring-2 focus:ring-[#9aa79f] focus:ring-offset-2"
              >
                <Plus aria-hidden="true" size={16} />
                Add blackout date
              </button>
            </div>

            <label className="grid gap-2 text-sm font-medium text-[#2f3d34]">
              Notes
              <textarea
                value={form.notes}
                onChange={(event) => updateField("notes", event.target.value)}
                rows={3}
                className="min-h-24 rounded-md border border-[#cbd5cf] bg-white px-3 py-2 text-base text-[#16211b] outline-none transition placeholder:text-[#8a968f] focus:border-[#1f5b47] focus:ring-2 focus:ring-[#1f5b47]/20"
                placeholder="Tournament, travel, or roster constraints"
              />
            </label>
          </section>

          <div className="flex flex-col gap-3 border-t border-[#e1e7e2] pt-5 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={isSaving}
              className="flex h-11 items-center justify-center gap-2 rounded-md bg-[#1f5b47] px-5 text-sm font-semibold text-white transition hover:bg-[#164333] focus:outline-none focus:ring-2 focus:ring-[#1f5b47] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#8ba89d]"
            >
              <Send aria-hidden="true" size={16} />
              {isSaving ? "Submitting..." : "Submit availability"}
            </button>

            <button
              type="button"
              onClick={() => {
                setForm((currentForm) =>
                  isInviteLink
                    ? { ...initialForm, leagueId: currentForm.leagueId, teamId: currentForm.teamId }
                    : initialForm,
                );
              }}
              className="h-11 rounded-md border border-[#cad4cc] px-5 text-sm font-semibold text-[#405047] transition hover:bg-[#f1f4ef] focus:outline-none focus:ring-2 focus:ring-[#9aa79f] focus:ring-offset-2"
            >
              Clear
            </button>
          </div>

        </form>
      </div>
    </main>
  );
}
