import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type AvailabilityBody = {
  token?: string;
  availableStartDate?: string | null;
  availableEndDate?: string | null;
  availableDates?: string[];
  hasDayPreference?: boolean;
  preferredDaysOfWeek?: string[];
  hasTimePreference?: boolean;
  preferredTimesOfDay?: string[];
  blackoutDates?: string[];
  recurringBlackouts?: Array<{ day_of_week: string; time_of_day: string }>;
  notes?: string;
};

type Invite = { id: string; league_id: string; team_id: string };

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function findActiveInvite(token: string): Promise<Invite | null> {
  const { data } = await createAdminClient()
    .from("team_captain_invites")
    .select("id, league_id, team_id")
    .eq("token_hash", hashToken(token))
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<Invite>();

  return data;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token) return NextResponse.json({ error: "Invitation token is required." }, { status: 400 });

  const invite = await findActiveInvite(token);
  if (!invite) return NextResponse.json({ error: "This invitation is invalid or expired." }, { status: 404 });

  const admin = createAdminClient();
  const [{ data: league }, { data: team }] = await Promise.all([
    admin
      .from("leagues")
      .select("id, name, sport, season_start_date, season_end_date")
      .eq("id", invite.league_id)
      .maybeSingle(),
    admin
      .from("league_teams")
      .select("id, league_id, name, captain_name, captain_email")
      .eq("id", invite.team_id)
      .maybeSingle(),
  ]);

  if (!league || !team || team.league_id !== league.id) {
    return NextResponse.json({ error: "This invitation is no longer available." }, { status: 404 });
  }

  return NextResponse.json({ league, team });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as AvailabilityBody | null;
  const token = body?.token?.trim();
  if (!token) return NextResponse.json({ error: "Invitation token is required." }, { status: 400 });

  const invite = await findActiveInvite(token);
  if (!invite) return NextResponse.json({ error: "This invitation is invalid or expired." }, { status: 404 });

  const { error } = await createAdminClient().from("team_availability_submissions").insert({
    team_id: invite.team_id,
    available_start_date: body?.availableStartDate || null,
    available_end_date: body?.availableEndDate || null,
    available_dates: body?.availableDates ?? [],
    has_day_preference: Boolean(body?.hasDayPreference),
    preferred_days_of_week: body?.preferredDaysOfWeek ?? [],
    has_time_preference: Boolean(body?.hasTimePreference),
    preferred_times_of_day: body?.preferredTimesOfDay ?? [],
    blackout_dates: body?.blackoutDates ?? [],
    recurring_blackouts: body?.recurringBlackouts ?? [],
    notes: body?.notes?.trim() || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ message: "Availability submitted." }, { status: 201 });
}
