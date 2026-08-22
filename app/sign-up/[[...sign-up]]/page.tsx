import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-[#f6f7f4] px-4 py-10">
      <SignUp />
    </main>
  );
}
