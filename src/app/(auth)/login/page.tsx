import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "로그인" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");
  return <AuthForm mode="login" />;
}
