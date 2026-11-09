import type { Metadata } from "next";
import { SignOutPanel } from "@/components/auth/sign-out-panel";

export const metadata: Metadata = { title: "Sign out", robots: { index: false } };

export default function SignOutPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold">Sign out</h1>
      <SignOutPanel />
    </>
  );
}
