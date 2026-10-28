const PROVIDERS: Record<string, string> = {
  openai: "OpenAI",
  gemini: "Gemini",
  fake: "the fake model (no AI)",
};

/** The image model that staged a photo, as people know it. */
export function providerName(provider: string): string {
  return PROVIDERS[provider] ?? provider;
}

export function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
