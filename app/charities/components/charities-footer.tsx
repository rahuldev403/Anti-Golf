import Link from "next/link";

export function CharitiesFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-10 border-t border-border/60 pt-5 text-xs text-muted-foreground">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p>
          {year} Golf For Good. Verified charity profiles for transparent
          giving.
        </p>
        <div className="flex items-center gap-4">
          <Link href="/" className="transition hover:text-foreground">
            Home
          </Link>
          <Link href="/charities" className="transition hover:text-foreground">
            Charities
          </Link>
          <Link href="/dashboard" className="transition hover:text-foreground">
            Dashboard
          </Link>
        </div>
      </div>
    </footer>
  );
}
