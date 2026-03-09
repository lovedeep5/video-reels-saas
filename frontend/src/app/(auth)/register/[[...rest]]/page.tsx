"use client";
import { SignUp } from "@clerk/nextjs";
import { dark } from "@clerk/ui/themes";
import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 gap-8 bg-gray-950">
      <Link href="/" className="text-2xl font-bold text-indigo-400">VidToReels</Link>
      <SignUp
        appearance={{
          theme: dark,
          variables: {
            colorPrimary: "#6366f1",
            colorNeutral: "#ffffff",
          },
        }}
      />
    </div>
  );
}
