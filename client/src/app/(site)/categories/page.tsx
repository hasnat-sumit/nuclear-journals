import type { Metadata } from "next";
import { Suspense } from "react";
import { ArticleGridSkeleton, EmptyState } from "@/components/feedback-states";
import { CategoryCard } from "@/components/site/article-cards";
import { getPublicData } from "@/lib/api";
import type { Category } from "@/lib/types";

export const metadata: Metadata = {
  title: "Categories",
  description: "Explore Nuclear Journal articles by subject.",
};

async function CategoryList() {
  const categories = (await getPublicData<Category[]>("/categories")) ?? [];
  if (categories.length === 0) return <EmptyState title="No categories yet" />;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((category) => (
        <CategoryCard key={category.id} category={category} />
      ))}
    </div>
  );
}

export default function CategoriesPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6">
      <h1 className="text-4xl font-semibold">Categories</h1>
      <Suspense fallback={<ArticleGridSkeleton />}>
        <CategoryList />
      </Suspense>
    </div>
  );
}
