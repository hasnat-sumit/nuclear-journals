import { Search } from "lucide-react";
import Form from "next/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// A plain form, so search works before JavaScript has loaded.
export function SearchBar({ defaultValue, className }: { defaultValue?: string; className?: string }) {
  return (
    <Form action="/articles" role="search" className={cn("relative w-full sm:w-60", className)}>
      <Search aria-hidden="true" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        name="q"
        type="search"
        aria-label="Search articles"
        placeholder="Search articles..."
        defaultValue={defaultValue}
        className="h-9 rounded-full bg-card pl-9"
      />
    </Form>
  );
}
