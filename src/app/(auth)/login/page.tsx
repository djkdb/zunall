import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { googleAuthEnabled } from "@/lib/auth/google";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "로그인" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/");
  const { error } = await searchParams;
  return <AuthForm mode="login" googleEnabled={googleAuthEnabled()} errorCode={error} />;
}
