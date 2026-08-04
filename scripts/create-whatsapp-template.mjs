const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const apiVersion =
  process.env.WHATSAPP_API_VERSION || process.env.WHATSAPP_GRAPH_API_VERSION || "v25.0";
const templateName =
  process.env.WHATSAPP_INVITE_TEMPLATE_NAME ||
  process.env.WHATSAPP_TEMPLATE_NAME ||
  "team_availability_invite";
const language =
  process.env.WHATSAPP_INVITE_TEMPLATE_LANGUAGE ||
  process.env.WHATSAPP_TEMPLATE_LANGUAGE ||
  "en_US";

if (!accessToken || !businessAccountId) {
  console.error(
    "Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_BUSINESS_ACCOUNT_ID in .env.local.",
  );
  process.exit(1);
}

const response = await fetch(
  `https://graph.facebook.com/${apiVersion}/${businessAccountId}/message_templates`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: templateName,
      language,
      category: "UTILITY",
      components: [
        {
          type: "BODY",
          text: "Hi {{1}}, your team {{2}} has been added to {{3}}. Please open this availability form and submit the dates and times your team can play before scheduling starts: {{4}}. Thank you.",
          example: {
            body_text: [
              [
                "Jordan",
                "Mississauga Strikers",
                "Cricket League - Mississauga",
                "https://example.com/team-captain?leagueId=league-id&teamId=team-id",
              ],
            ],
          },
        },
      ],
    }),
  },
);

const body = await response.json().catch(() => null);

if (!response.ok) {
  console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(body, null, 2));
