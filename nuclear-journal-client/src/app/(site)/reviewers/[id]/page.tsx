import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArticleGridSkeleton } from "@/components/feedback-states";
import { ProfileLayout } from "@/components/site/profile-layout";
import { getPublicData } from "@/lib/api";
import type { ArticleSummary, PublicProfile } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };
type ReviewerPage = PublicProfile & { articles: ArticleSummary[] };

const getReviewer = (id: string) => getPublicData<ReviewerPage>(`/reviewers/${encodeURIComponent(id)}`);
const isObjectId = (id: string) => /^[a-f\d]{24}$/i.test(id);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const reviewer = isObjectId(id) ? await getReviewer(id) : null;
  return reviewer ? { title: reviewer.name, description: reviewer.bio } : { title: "Page not found" };
}

async function ReviewerContent({ params }: Props) {
  const { id } = await params;
  if (!isObjectId(id)) notFound();
  // The API returns 404 unless this person chose public recognition.
  const reviewer = await getReviewer(id);
  if (!reviewer) notFound();

  return <ProfileLayout profile={reviewer} role="reviewer" articles={reviewer.articles} articlesLabel="Articles reviewed" emptyText="No credited reviews yet" />;
}

export default function ReviewerPublicPage({ params }: Props) {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-10 sm:px-6">
      <Suspense fallback={<ArticleGridSkeleton count={3} />}>
        <ReviewerContent params={params} />
      </Suspense>
    </div>
  );
}
