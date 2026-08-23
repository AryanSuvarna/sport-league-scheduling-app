import { NextRequest, NextResponse } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { createAdminClient } from "@/lib/supabase/admin";

function getPrimaryEmail(user: {
  email_addresses: Array<{ id: string; email_address: string }>;
  primary_email_address_id: string | null;
}) {
  return (
    user.email_addresses.find((email) => email.id === user.primary_email_address_id)
      ?.email_address ?? user.email_addresses[0]?.email_address ?? null
  );
}

export async function POST(request: NextRequest) {
  let event: Awaited<ReturnType<typeof verifyWebhook>>;

  try {
    event = await verifyWebhook(request);
  } catch {
    return new NextResponse("Webhook verification failed.", { status: 400 });
  }

  if (event.type === "user.created" || event.type === "user.updated") {
    const user = event.data;
    const { error } = await createAdminClient().from("profiles").upsert(
      {
        clerk_user_id: user.id,
        email: getPrimaryEmail(user),
        first_name: user.first_name ?? null,
        last_name: user.last_name ?? null,
        image_url: user.image_url ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "clerk_user_id" },
    );

    if (error) {
      console.error("Unable to sync Clerk user to Supabase", error);
      return NextResponse.json({ error: "Profile sync failed." }, { status: 500 });
    }
  }

  return new NextResponse("OK", { status: 200 });
}
