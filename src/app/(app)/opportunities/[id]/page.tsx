import { redirect } from "next/navigation";

/** 기회 상세 = 활동 상세의 적합도 탭 (기존 화면 재사용) */
export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/activities/${encodeURIComponent(id)}?tab=fit`);
}
