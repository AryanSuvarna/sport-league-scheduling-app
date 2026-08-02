import { NextResponse } from 'next/server';

// 1. Webhook Verification (Meta sends a GET request to verify your endpoint)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Compare this with the custom verification token you set in Meta's dashboard
  const MY_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === MY_VERIFY_TOKEN) {
    // Return the exact challenge string as plain text with a 200 status
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse('Verification failed', { status: 403 });
}

// 2. Receiving Messages (Meta sends a POST request when events happen)
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Ensure it is a valid WhatsApp webhook payload
    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];

      if (message) {
        console.log('New Message Received:', message);
        // Process message logic here (e.g., save to DB, trigger AI reply)
      }

      // Always return 200 OK quickly so Meta doesn't retry the notification
      return NextResponse.json({ status: 'success' }, { status: 200 });
    }

    return NextResponse.json({ error: 'Not a WhatsApp event' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
