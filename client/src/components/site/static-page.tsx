import type { ReactNode } from "react";

export function StaticPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-14 sm:px-6">
      <h1 className="text-4xl leading-tight font-semibold">{title}</h1>
      <p className="text-xl leading-8 text-muted-foreground">{intro}</p>
      <div className="article-body">{children}</div>
    </div>
  );
}
