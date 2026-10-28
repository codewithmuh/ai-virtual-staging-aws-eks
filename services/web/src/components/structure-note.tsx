import type { StructureCheck } from "@/lib/types";

/** The rule R2 check, in words: did the walls, windows and doors stay where they were? */
export function StructureNote({ check }: { check: StructureCheck }) {
  const kept = Math.round(check.score * 100);
  if (check.flagged) {
    return (
      <p className="flex items-start gap-2.5 text-sm text-amber">
        <Dot className="bg-amber" />
        <span>
          <strong className="font-medium">Check this photo before using it.</strong> Only {kept}% of
          the room&apos;s edges are unchanged, so a wall, window or door may have moved.
        </span>
      </p>
    );
  }
  return (
    <p className="flex items-start gap-2.5 text-sm text-ink-2">
      <Dot className="bg-moss" />
      <span>
        <span className="font-medium text-moss">Room unchanged.</span> {kept}% of the room&apos;s
        edges match the original: furniture was added, nothing was moved.
      </span>
    </p>
  );
}

function Dot({ className }: { className: string }) {
  return <span aria-hidden className={`mt-[7px] size-1.5 shrink-0 rounded-full ${className}`} />;
}
