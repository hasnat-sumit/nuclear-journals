"use client";

import { PageTitle, RoleGuard } from "@/components/dashboard/dashboard-shell";
import { ArticleForm } from "@/components/writer/article-form";

export default function NewArticlePage() {
  return (
    <RoleGuard role="writer">
      <PageTitle title="New article" description="Save a draft at any time. Submit when it is ready for the editors." />
      <ArticleForm />
    </RoleGuard>
  );
}
