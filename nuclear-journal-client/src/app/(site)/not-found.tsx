import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-24 sm:px-6">
      <h1 className="text-4xl font-semibold">Page not found</h1>
      <p className="text-lg leading-8 text-muted-foreground">This page may have moved, or it may no longer be published.</p>
      <Link href="/articles" className={buttonVariants()}>Browse articles</Link>
    </div>
  );
}
