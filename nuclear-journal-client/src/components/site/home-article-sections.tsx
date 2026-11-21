import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, LoadingSkeleton } from "@/components/feedback-states";
import { ArticleGrid, CategoryList, CompactArticle, FeaturedArticle } from "@/components/site/article-cards";
import { getPublicData, getPublicList } from "@/lib/api";
import type { ArticleSummary, Category } from "@/lib/types";

function SectionHeading({ id, title, href, linkLabel }: { id: string; title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 id={id} className="text-2xl font-semibold">{title}</h2>
      {href ? (
        <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-brand-teal-strong hover:underline">
          {linkLabel ?? "View all"} <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      ) : null}
    </div>
  );
}

async function HomeCategories() {
  const categories = (await getPublicData<Category[]>("/categories")) ?? [];
  if (categories.length === 0) return <p className="text-sm text-muted-foreground">Categories will appear here soon.</p>;
  const ordered = [...categories].sort((a, b) => b.articleCount - a.articleCount).slice(0, 7);
  return <CategoryList categories={ordered} />;
}

export async function HomeArticleSections() {
  const [featured, latest] = await Promise.all([
    getPublicList<ArticleSummary>("/articles?featured=true&limit=1"),
    getPublicList<ArticleSummary>("/articles?limit=10"),
  ]);
  const lead = featured.data[0] ?? latest.data[0];
  const remaining = latest.data.filter((article) => article.id !== lead?.id);
  const compact = remaining.slice(0, 3);
  const latestArticles = remaining.slice(3, 9);

  return (
    <div className="flex flex-col gap-14">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="featured-heading" className="flex min-w-0 flex-col gap-6">
          <SectionHeading id="featured-heading" title="Featured articles" href="/articles" />
          {!lead ? (
            <EmptyState title="The first articles are on their way" description="Our editors are preparing the first published pieces." />
          ) : (
            <div className="grid gap-8 md:grid-cols-[1.15fr_1fr]">
              <FeaturedArticle article={lead} />
              {compact.length > 0 ? (
                <div className="flex flex-col gap-6">
                  {compact.map((article) => <CompactArticle key={article.id} article={article} />)}
                </div>
              ) : null}
            </div>
          )}
        </section>

        <aside aria-labelledby="categories-heading" className="flex h-fit flex-col gap-3 rounded-xl border bg-card p-5">
          <h2 id="categories-heading" className="text-lg font-semibold">Browse by category</h2>
          <Suspense fallback={<LoadingSkeleton rows={5} />}><HomeCategories /></Suspense>
          <Link href="/categories" className="inline-flex items-center gap-1 pt-1 text-sm font-medium text-brand-teal-strong hover:underline">
            All categories <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </aside>
      </div>

      {latestArticles.length > 0 ? (
        <section aria-labelledby="latest-heading" className="flex w-full flex-col gap-6">
          <SectionHeading id="latest-heading" title="Latest articles" href="/articles" />
          <ArticleGrid articles={latestArticles} />
        </section>
      ) : null}
    </div>
  );
}
