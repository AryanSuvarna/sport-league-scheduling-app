import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarRange, Clock3, ListChecks, Users } from "lucide-react";
import { formatSeason, type League } from "@/lib/leagues";
import { createClient } from "@/lib/supabase/server";

export default async function LeaguesPage() {
  const supabase = await createClient();
  const { data: leagues, error } = await supabase
    .from("leagues")
    .select(
      `
        id,
        name,
        sport,
        season_start_date,
        season_end_date,
        match_duration_minutes,
        max_matches_per_team_per_week,
        match_rules,
        league_teams (
          id,
          name,
          captain_name,
          captain_phone,
          captain_email
        )
      `,
    )
    .order("created_at", { ascending: false })
    .returns<League[]>();

  return (
    <main className="min-h-screen bg-[#f6f7f4] text-[#18211c]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-7 px-4 py-6 sm:px-6 lg:px-8">
        <header className="border-b border-[#d6ded5] pb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#1f5b47] transition hover:text-[#164333]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Main page
          </Link>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-[#637066]">View leagues</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#16211b] sm:text-4xl">
                Leagues
              </h1>
            </div>
            <Link
              href="/create-league"
              className="inline-flex h-11 items-center justify-center rounded-md border border-[#c7d3ca] bg-white px-5 text-sm font-semibold text-[#1f5b47] transition hover:border-[#9fb5a8] focus:outline-none focus:ring-2 focus:ring-[#1f5b47] focus:ring-offset-2"
            >
              Create league
            </Link>
          </div>
        </header>

        {error ? (
          <p className="rounded-md border border-[#e1c3bd] bg-white p-5 text-sm text-[#9a3d31] shadow-sm">
            {error.message}
          </p>
        ) : null}

        {!error && leagues?.length === 0 ? (
          <section className="rounded-md border border-[#d6ded5] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#16211b]">No leagues yet</h2>
            <p className="mt-2 text-sm leading-6 text-[#637066]">
              Create a league first, then it will appear here.
            </p>
          </section>
        ) : null}

        <section className="grid gap-4">
          {leagues?.map((league) => (
            <article
              key={league.id}
              className="rounded-md border border-[#d6ded5] bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[#16211b]">{league.name}</h2>
                  <p className="mt-2 text-sm text-[#637066]">
                    {league.sport} /{" "}
                    {formatSeason(league.season_start_date, league.season_end_date)}
                  </p>
                </div>
                <Link
                  href={`/leagues/${league.id}`}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#1f5b47] px-5 text-sm font-semibold text-white transition hover:bg-[#164333] focus:outline-none focus:ring-2 focus:ring-[#1f5b47] focus:ring-offset-2"
                >
                  View league
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                <LeagueStat icon={Users} label="Teams" value={league.league_teams.length} />
                <LeagueStat
                  icon={Clock3}
                  label="Duration"
                  value={`${league.match_duration_minutes} min`}
                />
                <LeagueStat
                  icon={CalendarRange}
                  label="Weekly max"
                  value={league.max_matches_per_team_per_week}
                />
                <LeagueStat icon={ListChecks} label="Rules" value={league.match_rules.length} />
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

function LeagueStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-md border border-[#e1e7e0] bg-[#fbfcfa] p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-[#637066]">
        <Icon className="h-4 w-4 text-[#1f5b47]" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-2 text-sm font-semibold text-[#18211c]">{value}</p>
    </div>
  );
}
