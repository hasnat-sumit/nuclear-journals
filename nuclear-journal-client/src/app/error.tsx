"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="mx-auto flex max-w-xl flex-1 flex-col items-start justify-center gap-4 px-4 py-24 sm:px-6">
      <h1 className="text-4xl font-semibold">Something went wrong</h1>
      <p className="text-lg leading-8 text-muted-foreground">
        We could not load this page. Please try again in a moment.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
