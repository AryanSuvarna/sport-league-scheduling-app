import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-[#f6f7f4] px-4 py-10">
      <SignIn />
    </main>
  );
}
