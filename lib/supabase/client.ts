import { createClient as createSupabaseClient } from "@supabase/supabase-js";

type AccessToken = () => Promise<string | null>;

export function createClient(accessToken?: AccessToken) {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      accessToken: async () => {
        if (typeof window === "undefined") return null;
        return accessToken?.() ?? null;
      },
    },
  );
}
