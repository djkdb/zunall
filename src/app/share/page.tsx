import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { ShareReceiver } from "@/components/activities/share-receiver";

export const metadata: Metadata = { title: "공유로 등록" };

/**
 * 홈 화면에 추가한 앱의 "공유 대상".
 * 브라우저·메신저에서 공고를 공유하면 이 화면으로 들어온다.
 */
export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string; text?: string; title?: string }>;
}) {
  const user = await getCurrentUser();
  const { url, text, title } = await searchParams;

  if (!user) {
    // 로그인 후 이 화면으로 돌아오도록 공유 내용을 그대로 들고 간다
    const query = new URLSearchParams();
    if (url) query.set("url", url);
    if (text) query.set("text", text);
    if (title) query.set("title", title);
    redirect(`/login?next=${encodeURIComponent(`/share?${query.toString()}`)}`);
  }

  return <ShareReceiver sharedUrl={url ?? ""} sharedText={text ?? ""} sharedTitle={title ?? ""} />;
}
