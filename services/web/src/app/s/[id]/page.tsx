import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CompareSlider } from "@/components/compare-slider";
import { FurnitureRows } from "@/components/furniture-rows";
import { StructureNote } from "@/components/structure-note";
import { getStaging } from "@/lib/stagings";
import { styleName } from "@/lib/styles";

export async function generateMetadata({ params }: PageProps<"/s/[id]">): Promise<Metadata> {
  const staging = await getStaging((await params).id);
  if (!staging) return { title: "Room not found" };
  const title = `A room staged in ${styleName(staging.style)}`;
  const description = "Drag to see it before and after. Virtually staged with Heya.";
  return {
    title,
    description,
    // The image link expires after an hour; link previews fetch it when the link is shared.
    openGraph: { title, description, images: [staging.staged_url] },
    robots: { index: false },
  };
}

/** The share page: what a buyer sees. Rule R1: the staged photo always comes with its original. */
export default function SharePage({ params }: PageProps<"/s/[id]">) {
  return (
    <div className="shell">
      <Suspense fallback={<SharedRoomPlaceholder />}>
        <SharedRoom params={params} />
      </Suspense>
    </div>
  );
}

async function SharedRoom({ params }: { params: PageProps<"/s/[id]">["params"] }) {
  const staging = await getStaging((await params).id);
  if (!staging) notFound();
  const date = new Date(staging.created_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="text-center">
      <div className="pt-6 pb-8 lg:pt-10">
        <p className="font-mono text-xs tracking-wide text-ink-3 uppercase">
          Virtually staged · {styleName(staging.style)} · {date}
        </p>
        <h1 className="mt-3 font-serif text-[clamp(2.4rem,5vw,4rem)] leading-[0.95] text-balance text-ink">
          Drag to see the room <em className="text-ink-3">before and after.</em>
        </h1>
      </div>

      <CompareSlider
        before={staging.original_url}
        after={staging.staged_url}
        alt="The room"
        reveal
      />

      <div className="mx-auto mt-6 flex max-w-xl flex-col items-center gap-3">
        <p className="text-[15px] leading-relaxed text-ink-2">
          The furniture and decor were added by AI and don&apos;t come with the home.
        </p>
        <div className="text-left">
          <StructureNote check={staging.structure} />
        </div>
        <Link href="/" className="btn-primary mt-4 gap-6">
          Stage your own room <span aria-hidden>→</span>
        </Link>
      </div>

      {staging.furniture && staging.furniture.length > 0 && (
        <section className="mx-auto mt-20 max-w-xl text-left">
          <h2 className="section-title text-center">Shop this look</h2>
          <div className="mt-8">
            <FurnitureRows items={staging.furniture} />
          </div>
        </section>
      )}
    </div>
  );
}

function SharedRoomPlaceholder() {
  return (
    <div aria-hidden>
      <div className="flex flex-col items-center pt-6 pb-8 lg:pt-10">
        <div className="h-3 w-56 bg-paper-2" />
        <div className="mt-4 h-14 w-3/4 max-w-2xl bg-paper-2" />
      </div>
      <div className="mx-auto aspect-[3/2] w-full max-w-[calc(74svh*1.5)] bg-paper-2" />
    </div>
  );
}
