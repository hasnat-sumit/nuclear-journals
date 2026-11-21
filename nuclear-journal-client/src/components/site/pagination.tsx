import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { Pagination as PaginationData } from "@/lib/types";

export function Pagination({
  pagination,
  basePath,
  params = {},
}: {
  pagination: PaginationData;
  basePath: string;
  params?: Record<string, string | undefined>;
}) {
  const { page, totalPages } = pagination;
  if (totalPages <= 1) return null;

  const hrefFor = (target: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) query.set(key, value);
    }
    query.set("page", String(target));
    return `${basePath}?${query.toString()}`;
  };

  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-between gap-4">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" className={buttonVariants({ variant: "outline" })}>
          Previous
        </Link>
      ) : (
        <span />
      )}
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} rel="next" className={buttonVariants({ variant: "outline" })}>
          Next
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
