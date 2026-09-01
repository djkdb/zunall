import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "회원가입" };

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");
  return <AuthForm mode="signup" />;
}
