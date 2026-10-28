import Link from "next/link";

export default function NotFound() {
  return (
    <div className="shell max-w-2xl pt-16 pb-10">
      <p className="font-mono text-xs tracking-wide text-ink-3 uppercase">404</p>
      <h1 className="mt-3 font-serif text-[clamp(2.4rem,5vw,4rem)] leading-[0.95] text-ink">
        This room isn&apos;t here.
      </h1>
      <p className="mt-5 text-[17px] leading-relaxed text-ink-2">
        The link may be mistyped, or the staged photo may have been removed.
      </p>
      <Link href="/" className="btn-primary mt-8 gap-6">
        Stage a room <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
