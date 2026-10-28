# 0002. Put the image model behind one interface, and use Claude for the text

- Status: accepted (the provider comparison numbers are still to be measured)
- Date: 2026-10-27

## Context

Heya needs two kinds of AI work:

1. **Edit a photo:** add furniture to a room without changing the room (rule R2). Several hosted image models can
   edit a photo from instructions, and they change quickly in quality, price and speed.
2. **Read photos and write text:** list the furniture in a staged photo, and write a listing description from the
   photos and the agent's facts.

The app must also run with no keys at all, so students, CI and the smoke test can use it for free.

## Decision

- **Image editing** goes through one small interface, `ImageEditor.stage(photo, style) -> bytes`, with three
  implementations, chosen by `IMAGE_PROVIDER`:
  - `openai`: the Images edit endpoint, model `gpt-image-2` (`OPENAI_IMAGE_MODEL`), with `input_fidelity="high"` so
    more of the original photo is kept.
  - `gemini`: `generate_content` with image output, model `gemini-3.1-flash-image` (`GEMINI_IMAGE_MODEL`).
  - `fake` (the default): draws simple furniture blocks; no key, no cost.

  Every provider gets the same prompt (`staging_prompt`), so their results can be compared fairly.
- **Text** uses Claude, `claude-opus-5-5` (`CLAUDE_MODEL`), through the Messages API with structured output parsed
  into Pydantic models (`FurnitureList`, `Listing`). Effort is `low` for the furniture list and `medium` for the
  listing. Requests opt into server-side fallbacks (`fallbacks: "default"`): if Claude declines a request, the API
  retries it on another model in the same call. A refusal or empty answer becomes a 502 with a plain message.
  `WRITER_PROVIDER=fake` returns fixed text.
- **Rule R2** gets a check of our own (`structure.py`): it measures how many of the room's strong edges, in the top
  60% of the frame, survive staging. A score under `STRUCTURE_THRESHOLD` (0.55) flags the photo for review. The
  threshold is a starting point; it gets tuned on real stagings from both providers.
- **Tests never call a provider.** Each SDK client is replaced by a stub that returns a response in that provider's
  own format, built with the SDK's response types from `tests/fixtures/`.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| One interface, OpenAI and Gemini behind it (chosen) | Compare on real photos; switch with one variable; teaches the pattern | Two SDKs to keep current |
| One provider only | Less code | Locked in; no comparison for the series |
| Self-hosted image model on a GPU | No per-image fee | GPUs arrive in part 3; too much for part 1 |

## Consequences

- Switching providers is a config change, so the comparison can run on the same photos.
- Model names change often. They are settings, not code, and the defaults must be checked against each provider's
  model list when this is deployed.
- Still to measure and record here: per provider, the structure score on a set of real room photos, p95 time to a
  staged photo, and price per photo.
