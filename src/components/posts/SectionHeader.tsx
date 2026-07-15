import Link from "next/link";
import { PlusIcon } from "@/components/ui/Icons";

// Shared header for each section list page.
export function SectionHeader({
  title,
  description,
  href,
  eyebrow,
}: {
  title: string;
  description: string;
  href?: string;
  eyebrow?: string;
}) {
  return (
    <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
      <div className="max-w-xl">
        {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
        <h1 className="display-2 text-ink">{title}</h1>
        <p className="mt-4 text-ink-muted">{description}</p>
      </div>
      {href && (
        <Link href={href} className="btn-primary shrink-0">
          <PlusIcon className="h-4 w-4" />
          <span className="hidden sm:inline">New Post</span>
        </Link>
      )}
    </div>
  );
}
