"use client";

import { useEffect, useState } from "react";

/** Seconds since `since` (a performance.now() timestamp), ticking every tenth of a second. */
export function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(since);
  useEffect(() => {
    const timer = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(timer);
  }, []);
  return <span className="tabular-nums">{((now - since) / 1000).toFixed(1)} s</span>;
}
