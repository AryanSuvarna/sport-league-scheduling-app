import { NextRequest, NextResponse } from "next/server";

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

  const captainName = body.captainName?.trim();
  const captainPhone = normalizePhoneNumber(body.captainPhone || "");
  const leagueId = body.leagueId?.trim();
  const teamId = body.teamId?.trim();
  const teamName = body.teamName?.trim();
  const leagueName = body.leagueName?.trim();

  if (!captainName || !captainPhone || !leagueId || !teamId || !teamName || !leagueName) {
    return NextResponse.json(
      { error: "Captain name, phone, league ID, team ID, team name, and league name are required." },
      { status: 400 },
    );
  }

  const inviteUrl = buildInviteUrl(request, {
    leagueId,
    teamId,
  });
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
    leagueId: string;
    teamId: string;
  },
) {
  const baseUrl =
    process.env.WHATSAPP_APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    request.nextUrl.origin;
  const inviteUrl = new URL("/team-captain", baseUrl);

  inviteUrl.searchParams.set("leagueId", params.leagueId);
  inviteUrl.searchParams.set("teamId", params.teamId);

  return inviteUrl.toString();
}
