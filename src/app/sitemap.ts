import type { MetadataRoute } from "next";
import { appOrigin } from "@/lib/app-url";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await appOrigin();
  return ["/", "/signup", "/login", "/terms", "/privacy"].map((path) => ({
    url: `${origin}${path}`,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.5,
  }));
}
