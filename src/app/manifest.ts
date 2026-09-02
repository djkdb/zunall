import type { MetadataRoute } from "next";

/** 홈 화면에 추가(PWA). iOS 는 홈 화면에 추가해야 푸시 알림을 받을 수 있다. */
export default function manifest(): MetadataRoute.Manifest {
  return {
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
