import { NextRequest, NextResponse } from "next/server";

type InviteRequestBody = {
  captainName?: string;
  captainPhone?: string;
  captainEmail?: string;
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
  const captainEmail = body.captainEmail?.trim() || "";
  const teamName = body.teamName?.trim();
  const leagueName = body.leagueName?.trim();

  if (!captainName || !captainPhone || !teamName || !leagueName) {
    return NextResponse.json(
      { error: "Captain name, phone, team name, and league name are required." },
      { status: 400 },
    );
  }

  const inviteUrl = buildInviteUrl(request, {
    captainName,
    captainEmail,
    teamName,
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
        to: captainPhone,
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
    captainName: string;
    captainEmail: string;
    teamName: string;
  },
) {
  const baseUrl =
    process.env.WHATSAPP_APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    request.nextUrl.origin;
  const inviteUrl = new URL("/team-captain", baseUrl);

  inviteUrl.searchParams.set("team", params.teamName);
  inviteUrl.searchParams.set("captain", params.captainName);

  if (params.captainEmail) {
    inviteUrl.searchParams.set("email", params.captainEmail);
  }

  return inviteUrl.toString();
}
