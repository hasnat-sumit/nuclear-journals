"use client";

import { Button } from "@/components/ui/button";

// Keeps the site's navigation in place, so visitors can still reach static pages.
export default function SiteError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-24 sm:px-6">
      <h1 className="text-4xl font-semibold">Something went wrong</h1>
      <p className="text-lg leading-8 text-muted-foreground">
        We could not load this page. Please try again in a moment.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
