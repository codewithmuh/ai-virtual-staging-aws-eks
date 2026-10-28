import Link from "next/link";

const REPO = "https://github.com/codewithmuh/ai-virtual-staging-aws-eks";

/** The mark: a floor plan with a door, in the colour of a hanko seal. Same drawing as app/icon.svg. */
export function Mark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="7" fill="var(--color-shu)" />
      <path
        d="M13.5 23H9V9h14v14h-4.5"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 23v-5a5 5 0 0 1 5 5"
        fill="none"
        stroke="#fff"
        strokeWidth="1.4"
        opacity=".75"
      />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="shell flex items-center justify-between py-5">
      <Link href="/" className="flex items-center gap-2.5" aria-label="Heya, home">
        <Mark />
        <span className="font-serif text-[1.65rem] leading-none text-ink">Heya</span>
        <span lang="ja" className="pt-1 text-xs tracking-[0.2em] text-ink-3">
          部屋
        </span>
      </Link>
      <nav className="flex items-center gap-6 text-[13px] text-ink-2">
        <Link href="/#how" className="hidden transition-colors hover:text-ink sm:inline">
          How it works
        </Link>
        <a href={REPO} className="transition-colors hover:text-ink">
          GitHub <span aria-hidden>↗</span>
        </a>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="shell mt-24">
      <div className="flex flex-col gap-3 border-t border-line py-8 text-[13px] text-ink-3 sm:flex-row sm:justify-between">
        <p>
          Heya is part 1 of{" "}
          <a href={REPO} className="link text-ink-2">
            AI on EKS
          </a>
          : five production AI apps on Amazon EKS, built in public.
        </p>
        <p>Learning only, no commercial use · © 2026 Muhammad Rashid</p>
      </div>
    </footer>
  );
}
