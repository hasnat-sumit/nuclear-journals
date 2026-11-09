import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getPublicData, getPublicList } from "@/lib/api";
import type { ArticleSummary, Category } from "@/lib/types";

const STATIC_PATHS = ["", "/articles", "/categories", "/about", "/editorial-policy", "/contributor-guidelines", "/how-to-publish", "/reviewer-guidelines", "/contact"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Built per request, so newly published articles appear without a redeploy.
  await connection();
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({ url: `${siteUrl}${path}` }));

  try {
    const [categories, articles] = await Promise.all([
      getPublicData<Category[]>("/categories"),
      getPublicList<ArticleSummary>("/articles?limit=50"),
    ]);
    for (const category of categories ?? []) entries.push({ url: `${siteUrl}/categories/${category.slug}` });
    for (const article of articles.data) {
      entries.push({ url: `${siteUrl}/articles/${article.slug}`, lastModified: article.publishedAt ?? undefined });
    }
  } catch {
    // If the API is down, a partial sitemap is better than a failed one.
  }
  return entries;
}
