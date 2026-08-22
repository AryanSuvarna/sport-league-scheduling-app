import type { Metadata } from "next";
import {
  ClerkProvider,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { AppToaster } from "./AppToaster";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Sports League Scheduler",
  description: "Manage ground availability for sports league scheduling.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("h-full antialiased", "font-sans", geist.variable)}>
      <body className="min-h-full flex flex-col">
        <ClerkProvider appearance={{ theme: shadcn }}>
          <div className="absolute right-4 top-4 z-10">
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
          {children}
          <footer className="border-t border-[#d6ded5] bg-[#f6f7f4] px-4 py-4 text-center text-sm text-[#637066]">
            Powered by AI
          </footer>
          <AppToaster />
        </ClerkProvider>
      </body>
    </html>
  );
}
