import { createHash, randomBytes } from "crypto";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type InviteRequestBody = {
  captainName?: string;
  captainPhone?: string;
  leagueId?: string;
  teamId?: string;
  teamName?: string;
  leagueName?: string;
};

const requiredEnvVars = [
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
] as const;

export async function POST(request: NextRequest) {
  const { isAuthenticated } = await auth();
  if (!isAuthenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

  if (missingEnvVars.length > 0) {
    return NextResponse.json(
      { error: `Missing WhatsApp env vars: ${missingEnvVars.join(", ")}` },
      { status: 500 },
    );
  }

  const templateName =
    process.env.WHATSAPP_INVITE_TEMPLATE_NAME || process.env.WHATSAPP_TEMPLATE_NAME;

  if (!templateName) {
    return NextResponse.json(
      {
        error:
          "Missing WhatsApp env var: WHATSAPP_INVITE_TEMPLATE_NAME or WHATSAPP_TEMPLATE_NAME",
      },
      { status: 500 },
    );
  }

  let body: InviteRequestBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const leagueId = body.leagueId?.trim();
  const teamId = body.teamId?.trim();

  if (!leagueId || !teamId) {
    return NextResponse.json(
      { error: "League ID and team ID are required." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const [{ data: league }, { data: team }] = await Promise.all([
    supabase.from("leagues").select("id, name").eq("id", leagueId).maybeSingle(),
    supabase
      .from("league_teams")
      .select("id, league_id, name, captain_name, captain_phone")
      .eq("id", teamId)
      .maybeSingle(),
  ]);
  if (!league || !team || team.league_id !== league.id) {
    return NextResponse.json({ error: "League or team not found." }, { status: 404 });
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const ttlDays = Math.max(1, Number.parseInt(process.env.TEAM_CAPTAIN_INVITE_TTL_DAYS || "30", 10) || 30);
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();

  await supabase
    .from("team_captain_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("team_id", team.id)
    .is("revoked_at", null);

  const { error: inviteError } = await supabase.from("team_captain_invites").insert({
    league_id: league.id,
    team_id: team.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });
  if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 500 });

  const captainName = team.captain_name;
  const captainPhone = normalizePhoneNumber(team.captain_phone);
  const teamName = team.name;
  const leagueName = league.name;
  const inviteUrl = buildInviteUrl(request, {
    token,
  });

  if (process.env.NODE_ENV !== "production") {
    console.log(`Team captain invite for ${teamName}: ${inviteUrl}`);
  }

  const apiVersion =
    process.env.WHATSAPP_API_VERSION || process.env.WHATSAPP_GRAPH_API_VERSION || "v25.0";
  const language =
    process.env.WHATSAPP_INVITE_TEMPLATE_LANGUAGE ||
    process.env.WHATSAPP_TEMPLATE_LANGUAGE ||
    "en_US";
  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: `1${captainPhone}`,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: language,
          },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: captainName },
                { type: "text", text: teamName },
                { type: "text", text: leagueName },
                { type: "text", text: inviteUrl },
              ],
            },
          ],
        },
      }),
    },
  );
  const responseBody = await response.json().catch(() => null);

  if (!response.ok) {
    const metaMessage = responseBody?.error?.message;

    return NextResponse.json(
      { error: metaMessage || "WhatsApp could not send the invite." },
      { status: response.status },
    );
  }

  return NextResponse.json({
    message: "Invite sent.",
    inviteUrl,
    whatsapp: responseBody,
  });
}

function normalizePhoneNumber(phoneNumber: string) {
  return phoneNumber.replace(/\D/g, "");
}

function buildInviteUrl(
  request: NextRequest,
  params: {
    token: string;
  },
) {
  const baseUrl =
    process.env.WHATSAPP_APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    request.nextUrl.origin;
  const inviteUrl = new URL("/team-captain", baseUrl);

  inviteUrl.searchParams.set("token", params.token);

  return inviteUrl.toString();
}
