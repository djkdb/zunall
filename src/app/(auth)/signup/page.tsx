import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { googleAuthEnabled } from "@/lib/auth/google";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "회원가입" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reason?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/");
  const { error, reason } = await searchParams;
  return <AuthForm
      mode="signup"
      googleEnabled={googleAuthEnabled()}
      errorCode={error}
      errorReason={reason}
    />;
}
