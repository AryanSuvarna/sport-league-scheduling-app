import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { AppToaster } from "./AppToaster";
import { AppAuth } from "./AppAuth";

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
          <AppAuth />
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
