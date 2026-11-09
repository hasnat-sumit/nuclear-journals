import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArticleGridSkeleton, EmptyState } from "@/components/feedback-states";
import { ArticleGrid } from "@/components/site/article-cards";
import { Pagination } from "@/components/site/pagination";
import { getPublicData, getPublicList } from "@/lib/api";
import type { ArticleSummary, CategoryRef } from "@/lib/types";
import { CategoryIcon } from "@/lib/category-icons";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

const getCategory = (slug: string) =>
  getPublicData<CategoryRef & { description: string }>(`/categories/${encodeURIComponent(slug)}`);

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) return { title: "Category not found" };
  return { title: category.name, description: category.description };
}

async function CategoryContent({ params, searchParams }: Props) {
  const { slug } = await params;
  const { page } = await searchParams;
  const category = await getCategory(slug);
  if (!category) notFound();

  const pageNumber = /^\d+$/.test(page ?? "") ? page : "1";
  const results = await getPublicList<ArticleSummary>(
    `/categories/${encodeURIComponent(slug)}/articles?limit=12&page=${pageNumber}`,
  );
  return (
    <>
      <header className="flex items-start gap-5">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal-strong">
          <CategoryIcon slug={category.slug} className="size-7" />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold">{category.name}</h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">{category.description}</p>
        </div>
      </header>
      {results.data.length > 0 ? (
        <ArticleGrid articles={results.data} />
      ) : (
        <EmptyState title="No articles in this category yet" />
      )}
      <Pagination pagination={results.pagination} basePath={`/categories/${slug}`} />
    </>
  );
}

export default function CategoryPage(props: Props) {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6">
      <Suspense fallback={<ArticleGridSkeleton />}>
        <CategoryContent {...props} />
      </Suspense>
    </div>
  );
}
