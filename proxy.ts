import { clerkMiddleware } from "@clerk/nextjs/server";

const isPublicPath = (pathname: string) =>
  pathname.startsWith("/sign-in") ||
  pathname.startsWith("/sign-up") ||
  pathname.startsWith("/team-captain") ||
  pathname === "/api/whatsapp";

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicPath(request.nextUrl.pathname)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
