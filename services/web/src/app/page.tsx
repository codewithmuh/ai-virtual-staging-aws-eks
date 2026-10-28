import { connection } from "next/server";
import { Suspense } from "react";

import { ExamplesBand } from "@/components/examples-band";
import { Studio } from "@/components/studio";
import { EXAMPLES } from "@/content/examples";
import { publicApiUrl } from "@/lib/config";

const RULES = [
  {
    id: "R1",
    title: "Always labelled",
    text: "Every staged photo carries a “Virtually staged” label and is shown next to its original.",
  },
  {
    id: "R2",
    title: "Furniture only",
    text: "Walls, windows, doors, floors and views stay as they are. A structure check compares the room before and after, and flags photos where something moved.",
  },
  {
    id: "R3",
    title: "No location data",
    text: "Photos are re-encoded from their pixels before they're staged or shared, which removes GPS and every other kind of metadata.",
  },
  {
    id: "R4",
    title: "A cap on AI spend",
    text: "Each browser, each network address and the whole site have a daily limit, so one busy day can't run up the bill.",
  },
];

export default function Home() {
  const hasExamples = EXAMPLES.length > 0;
  const headline = (
    <div className="shell grid items-end gap-x-12 gap-y-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <h1 className="font-serif text-[clamp(2.6rem,5.4vw,4.75rem)] leading-[0.92] tracking-[-0.015em] text-ink">
        Furnish an empty room <em className="block text-ink-3">in seconds.</em>
      </h1>
      <div>
        <p className="text-[15px] leading-relaxed text-ink-2 sm:text-[17px]">
          Upload a photo, pick a style, and see the room furnished. Heya adds furniture and decor
          only, and labels every photo it stages.
        </p>
        {hasExamples && (
          <a href="#studio" className="link mt-3 inline-block text-[15px]">
            Try it on your room <span aria-hidden>↓</span>
          </a>
        )}
      </div>
    </div>
  );

  return (
    <>
      {hasExamples ? (
        // The headline and the examples are one hero, pinned while the rooms play.
        <ExamplesBand examples={EXAMPLES}>{headline}</ExamplesBand>
      ) : (
        <section className="pt-8 pb-10 lg:pt-14 lg:pb-12">{headline}</section>
      )}

      <div id="studio" className="scroll-mt-6">
        {hasExamples && <h2 className="shell section-title mt-16 mb-8">Now try your room</h2>}
        <Suspense fallback={<StudioPlaceholder />}>
          <StudioAtRequestTime />
        </Suspense>
      </div>

      <section id="how" className="shell mt-28 scroll-mt-8">
        <div className="grid gap-12 border-t border-line pt-14 lg:grid-cols-[minmax(0,1fr)_2fr]">
          <div>
            <h2 className="section-title">Honest by design</h2>
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-ink-2">
              Virtual staging helps sell a home only if buyers can trust the photos. These four
              rules are enforced by the app, not left to good intentions.
            </p>
          </div>
          <dl className="grid gap-x-12 gap-y-10 sm:grid-cols-2">
            {RULES.map((r) => (
              <div key={r.id}>
                <dt className="flex items-baseline gap-3 font-medium text-ink">
                  <span className="font-mono text-xs text-shu">{r.id}</span>
                  {r.title}
                </dt>
                <dd className="mt-2 pl-[2.1rem] text-[15px] leading-relaxed text-ink-2">
                  {r.text}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}

/** The API's address is read per request, so the same image runs locally and in AWS. */
async function StudioAtRequestTime() {
  await connection();
  return <Studio apiUrl={publicApiUrl()} />;
}

function StudioPlaceholder() {
  return (
    <div className="shell grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_340px]" aria-hidden>
      <div className="aspect-[3/2] w-full bg-paper-2" />
      <div className="h-96" />
    </div>
  );
}
