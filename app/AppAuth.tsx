"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { usePathname } from "next/navigation";

export function AppAuth() {
  const pathname = usePathname();

  if (pathname.startsWith("/team-captain")) {
    return null;
  }

  return (
    <div className="app-auth absolute right-4 top-4 z-10">
      <Show when="signed-out">
        <div className="flex items-center gap-2">
          <SignInButton>
            <button className="rounded-md px-3 py-2 text-sm font-semibold text-[#1f5b47] hover:bg-[#edf6f1] focus:outline-none focus:ring-2 focus:ring-[#1f5b47] focus:ring-offset-2">
              Sign in
            </button>
          </SignInButton>
          <SignUpButton>
            <button className="rounded-md bg-[#1f5b47] px-3 py-2 text-sm font-semibold text-white hover:bg-[#174a39] focus:outline-none focus:ring-2 focus:ring-[#1f5b47] focus:ring-offset-2">
              Sign up
            </button>
          </SignUpButton>
        </div>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </div>
  );
}
