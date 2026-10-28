import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      // The logic the UI rests on. Pages and the studio are checked end to end in a browser.
      include: [
        "src/lib/**",
        "src/components/compare-slider.tsx",
        "src/components/examples-band.tsx",
      ],
      exclude: ["src/lib/config.ts", "src/lib/stagings.ts", "src/lib/types.ts"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
