This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## WhatsApp production setup

Set the production domain to `https://suvsolution.com` in the host's environment
variables:

```text
NEXT_PUBLIC_APP_URL=https://suvsolution.com
WHATSAPP_APP_BASE_URL=https://suvsolution.com
```

Copy the remaining WhatsApp variables from `env.example` into the production
environment. Use a permanent system-user access token, not a temporary Meta
testing token.

In the Meta App Dashboard, configure WhatsApp webhooks as follows:

- Callback URL: `https://suvsolution.com/api/whatsapp`
- Verify token: the exact `WHATSAPP_VERIFY_TOKEN` value configured in production
- Subscribe the WhatsApp Business Account to the message events your app needs

`WHATSAPP_APP_SECRET` is required: the webhook verifies Meta's
`X-Hub-Signature-256` before accepting a request. In Meta, set the WhatsApp app,
business account, and phone number to live/production mode, and ensure the
invite template is approved before sending live messages.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
