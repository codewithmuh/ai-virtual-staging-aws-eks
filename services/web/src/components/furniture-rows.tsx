import type { FurnitureItem } from "@/lib/types";

const shopping = (query: string) =>
  `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`;

/** The pieces in a staged photo, as a numbered list with a search link for each. */
export function FurnitureRows({ items }: { items: FurnitureItem[] }) {
  if (items.length === 0) {
    return <p className="py-4 text-sm text-ink-3">No furniture found in this photo.</p>;
  }
  return (
    <ol className="divide-y divide-line border-y border-line">
      {items.map((item, i) => (
        <li key={`${item.name}-${i}`} className="flex items-baseline gap-4 py-3.5">
          <span className="w-6 shrink-0 font-mono text-xs text-ink-4 tabular-nums">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] text-ink first-letter:uppercase">{item.name}</span>
            <span className="block text-[13px] text-ink-3 first-letter:uppercase">
              {item.category} · {item.color} {item.material}
            </span>
          </span>
          <a
            href={shopping(item.search_query)}
            target="_blank"
            rel="noopener noreferrer"
            className="link shrink-0 text-[13px]"
          >
            Find similar
            <span className="sr-only"> (opens a shopping search)</span>
            <span aria-hidden> ↗</span>
          </a>
        </li>
      ))}
    </ol>
  );
}
