import { ExternalLink, GraduationCap } from "lucide-react";
import type { ReactNode } from "react";
import { socialLabel } from "@/lib/social";
import { RatingControl } from "@/components/site/article-actions";
import { ArticleGrid } from "@/components/site/article-cards";
import { ArticleArt } from "@/components/site/artwork";
import { Avatar } from "@/components/site/author-profile";
import { EmptyState } from "@/components/feedback-states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ArticleSummary, PublicProfile } from "@/lib/types";

const TAB_TRIGGER = "h-10 flex-none rounded-none px-1 text-sm data-active:text-primary after:bg-brand-teal";

export function ProfileLayout({
  profile,
  role,
  articles,
  articlesLabel,
  emptyText,
  extraAbout,
}: {
  profile: PublicProfile;
  role: "writer" | "reviewer";
  articles: ArticleSummary[];
  articlesLabel: string;
  emptyText: string;
  extraAbout?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="relative isolate h-36 overflow-hidden bg-primary sm:h-48">
          <div className="absolute inset-y-0 right-0 -z-10 w-full sm:w-1/2">
            <ArticleArt seed={`profile-${profile.id}`} variant="plant" />
          </div>
          <div className="absolute inset-0 -z-10 bg-linear-to-r from-primary from-40% to-primary/10" />
        </div>
        <div className="flex flex-col gap-4 px-5 pb-6 sm:flex-row sm:items-end sm:gap-6 sm:px-8">
          <Avatar name={profile.name} image={profile.image} size="lg" className="-mt-14 shadow-sm" />
          <div className="flex flex-1 flex-col gap-2 sm:pb-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold">{profile.name}</h1>
              <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
                {role === "writer" ? "Writer" : "Reviewer"}
              </span>
            </div>
            {profile.expertise.length > 0 ? (
              <p className="text-sm text-muted-foreground">{profile.expertise.slice(0, 3).join(" · ")}</p>
            ) : null}
            {profile.socialLinks.length > 0 ? (
              <ul aria-label="Social media" className="flex flex-wrap gap-2">
                {profile.socialLinks.map((link) => (
                  <li key={`${link.platform}-${link.url}`}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium text-primary hover:border-primary hover:bg-primary/5"
                    >
                      <ExternalLink aria-hidden="true" className="size-3" />
                      {socialLabel(link.platform)}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            <RatingControl targetType={role} targetId={profile.id} initial={profile.rating} label={`Rate this ${role}`} />
          </div>
        </div>
      </div>

      <Tabs defaultValue="articles">
        <TabsList variant="line" className="h-auto w-full justify-start gap-6 border-b">
          <TabsTrigger value="articles" className={TAB_TRIGGER}>
            {articlesLabel} ({articles.length})
          </TabsTrigger>
          <TabsTrigger value="about" className={TAB_TRIGGER}>About</TabsTrigger>
        </TabsList>
        <TabsContent value="articles" className="pt-6">
          {articles.length > 0 ? <ArticleGrid articles={articles} /> : <EmptyState title={emptyText} />}
        </TabsContent>
        <TabsContent value="about" className="pt-6">
          <div className="flex max-w-3xl flex-col gap-6 rounded-xl border bg-card p-6">
            <p className="text-base leading-7 text-foreground">{profile.bio || "No biography yet."}</p>
            {profile.expertise.length > 0 ? (
              <div className="flex flex-col gap-3">
                <h2 className="text-base font-semibold">Expertise</h2>
                <ul className="flex flex-wrap gap-2">
                  {profile.expertise.map((item) => (
                    <li key={item} className="rounded-full bg-primary/8 px-3 py-1 text-sm font-medium text-primary">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {profile.education.length > 0 ? (
              <div className="flex flex-col gap-3">
                <h2 className="text-base font-semibold">Education</h2>
                <ul className="flex flex-col gap-3">
                  {[...profile.education]
                    .sort((a, b) => (b.passingYear ?? 0) - (a.passingYear ?? 0))
                    .map((item) => (
                      <li key={`${item.university}-${item.subject}-${item.passingYear}`} className="flex gap-3">
                        <GraduationCap aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-teal" />
                        <div>
                          <p className="font-medium">{item.subject}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.university}
                            {item.passingYear ? ` · ${item.passingYear}` : ""}
                          </p>
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
            {extraAbout}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
