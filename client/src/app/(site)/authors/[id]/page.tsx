import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArticleGridSkeleton } from "@/components/feedback-states";
import { ProfileLayout } from "@/components/site/profile-layout";
import { getPublicData, getPublicList } from "@/lib/api";
import type { ArticleSummary, PublicProfile } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

const getAuthor = (id: string) => getPublicData<PublicProfile>(`/authors/${encodeURIComponent(id)}`);
const isObjectId = (id: string) => /^[a-f\d]{24}$/i.test(id);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const author = isObjectId(id) ? await getAuthor(id) : null;
  return author ? { title: author.name, description: author.bio } : { title: "Author not found" };
}

async function AuthorContent({ params }: Props) {
  const { id } = await params;
  if (!isObjectId(id)) notFound();
  const author = await getAuthor(id);
  if (!author) notFound();
  const articles = await getPublicList<ArticleSummary>(`/authors/${id}/articles?limit=30`);

  return <ProfileLayout profile={author} role="writer" articles={articles.data} articlesLabel="Articles" emptyText="No published articles yet" />;
}

export default function AuthorPage({ params }: Props) {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-10 sm:px-6">
      <Suspense fallback={<ArticleGridSkeleton count={3} />}>
        <AuthorContent params={params} />
      </Suspense>
    </div>
  );
}
