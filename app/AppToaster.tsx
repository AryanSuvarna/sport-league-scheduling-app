"use client";

import { Toaster } from "react-hot-toast";

export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 5_000,
        style: {
          background: "#18211c",
          color: "#fff",
          borderRadius: "0.5rem",
          maxWidth: "28rem",
        },
        success: { duration: 4_000, iconTheme: { primary: "#6fcf97", secondary: "#18211c" } },
        error: { duration: 7_000, iconTheme: { primary: "#f28b82", secondary: "#18211c" } },
      }}
    />
  );
}
