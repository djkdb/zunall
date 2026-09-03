import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { mailConfigured } from "@/lib/email";
import { ForgotForm } from "@/components/auth/forgot-form";

export const metadata: Metadata = { title: "비밀번호 재설정" };

export default async function ForgotPage() {
  const user = await getCurrentUser();
  if (user) redirect("/settings");
  return <ForgotForm mailReady={mailConfigured()} />;
}
