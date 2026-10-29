# ADR-0010: Word Images

- Status: Accepted
- Date: 2026-10-27

## Context

The association between a word and an image helps with memorization. The user wants to see an image for a word during repetition (e.g., an apartment for "flat") and has selected the option "I choose myself": the image is picked by the user, not the system. Display it together with the answer, so it does not give away the answer until the attempt to recall.

## Solution

- **One image per word**, table `vocabulary.word_images` (bytes in `bytea`, metadata and attribution). It is deleted together with the word and account, and is included in the export of personal data (data URL).
- **Sources:** searching for freely licensed images or uploading your own (JPEG, PNG, WebP, GIF up to 5 MB).
- **Search is pluggable**, `IMAGE_SEARCH_PROVIDER = none | wikimedia | openverse`, default is `none`:
  - `wikimedia` — Wikimedia Commons API: free, no key required, >100 million files, User-Agent according to Wikimedia rules. Only raster files, no SVG.
  - `openverse` — Openverse (Wikimedia, Flickr and others, has adult content filter). During testing, the public API responded with 504 after a minute, so it is not the primary option.
- **Polysemy** is resolved by the user: the search starts with the word, but the query can be refined ("apartment" instead of "flat").
- **Privacy and security:**
  - Only the search phrase is sent outward; images are downloaded by the API, the browser does not access external sites (the user's IP is not disclosed, CSP is not expanded);
  - Downloading is only from Wikimedia/Openverse media hosts, with a timeout and size limit;
  - Everything that is saved or displayed is re-encoded by `sharp` into WebP ≤ 640 px without metadata (EXIF/GPS), with protection against "pixel bombs" (`limitInputPixels`). Files that cannot be decoded as images are rejected (422), SVG is not accepted at all;
  - Attribution links are accepted only `http(s)`, HTML from metadata on Commons is converted into text.
- **Licenses:** The name, author, license, and source link are displayed under the image from the search — this is required by CC BY / BY-SA. The uploaded image is signed as "Your image."
- Upload proceeds with the raw body (`Content-Type: image/*`) with a separate limit of 5 MB only for these types; the overall API body limit remains unchanged.

## Alternatives

- **Local image generation (Stable Diffusion).** Exactly matching the meaning of the word and private, but ~7 GB models and overall video memory with qwen3 on 8 GB. Can be added later as another source.
- **Automatic selection without user involvement.** For ambiguous and abstract words, the first image is often unsuccessful.
- **Storing links instead of files.** Images would disappear along with the source, and the browser would access external hosts.
- **Unsplash/Pexels/Pixabay.** API keys and your display terms are needed.

## Consequences

- Migration `0002_word-images`; `image` field in `Word` and `ReviewCard` (only metadata, bytes — separate request with `?v=updatedAt` for cache).
- Dependency `sharp` in API (already present in lockfile via Next.js; LGPL-3.0 for libvips).
- Wikimedia Commons does not filter adult content; search is initiated by the user (tech-debt).
- Images take up space in PostgreSQL: ~30–60 KB per word.
