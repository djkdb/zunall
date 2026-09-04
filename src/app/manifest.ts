import type { MetadataRoute } from "next";

/** 홈 화면에 추가(PWA). iOS 는 홈 화면에 추가해야 푸시 알림을 받을 수 있다. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    // 공유 대상 등록: 브라우저·카톡에서 "공유 → Cavero" 로 공고를 바로 넘길 수 있다.
    // (Next 의 Manifest 타입에는 아직 share_target 이 없어 확장해 붙인다)
    ...({
      share_target: {
        action: "/share",
        method: "GET",
        params: { title: "title", text: "text", url: "url" },
      },
      shortcuts: [
        { name: "새 활동 만들기", url: "/activities/new" },
        { name: "수집한 공고", url: "/opportunities?tab=feed" },
      ],
    } as Partial<MetadataRoute.Manifest>),
    name: "Cavero — AI Career OS",
    short_name: "Cavero",
    description: "공모전·대외활동·인턴을 한 흐름으로 관리하고 다음 합격을 설계합니다",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2F6BFF",
    lang: "ko",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
