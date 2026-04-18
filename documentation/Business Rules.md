# Business Rules

This document defines the core business rules. These rules MUST be respected in all implementations unless explicitly approved otherwise.

---

## Documentation Guidelines

When a new business rule is mentioned:

1. Add it to this document immediately
2. Use a concise format (single line or brief paragraph)
3. Maintain precision - do not lose important details for brevity
4. Include rationale where it adds clarity

## Image Recognition

Supported image extensions: `png`, `jpg`, `jpeg`, `gif`, `bmp`, `webp`, `avif`, `svg`. Only files with these extensions are treated as transcribable images.

## Output Naming

Transcription output is a `.md` file with the same name and location as the source image (e.g., `photo.png` produces `photo.md` in the same folder).

**Exception**: When auto-filing is enabled AND the transcribed content contains filing tags, the output file is moved to the LLM-determined destination folder instead.

## Overwrite Behavior

When `overwriteExisting` is false (default), images that already have a corresponding `.md` file are silently skipped. When true, existing `.md` files are updated via `vault.modify()`.

## Auto-Filing

When `autoFilingEnabled` is true, tags found in the first N lines (configurable via `maxLinesToScan`) are sent to an LLM along with the vault's existing folder list. The LLM determines the best destination folder path using semantic matching (e.g. abbreviations, aliases).

- Tags supported: any `#key: value` pattern in the first N lines (e.g. `#client: BH`, `#folder: Sprint 2`, `#project: X`).
- All tags are passed together to the LLM as context; the LLM decides the full target path.
- Tag lines are stripped from the note content before saving.
- If filing destination conflicts with an existing file, a number is appended: `filename (1).md`, `filename (2).md`, etc.
- The original file is trashed after successful filing (`fileManager.trashFile()` to respect user preferences).
- Fallback: If no tags are found OR the LLM call fails, the file is moved to the configurable Inbox folder (default: `Inbox`).

## Auto-Filing LLM

The LLM used for folder classification is configured via `filingModel` (default: `''`, which falls back to the transcription model). It uses the same provider (Ollama or OpenAI) as the transcription model. The `classifyText(prompt, model)` method on `AiProviderService` performs a text-only chat call.

## Unchanged Image Skip

When `skipUnchangedImages` is true, unchanged images are skipped if their file fingerprint (`mtime` + `size`) and transcription config signature match the last successful transcription. This optimization applies to repeated runs and preserves output naming/location rules.

## Skip Unchanged Images Setting

`skipUnchangedImages` (default: true) controls whether to skip images that have not changed since last transcription. This setting is independent of `overwriteExisting` and takes precedence when enabled.

## Filing Log

When auto-filing is enabled, all filing actions are logged to a user-configurable note (default: `Auto-Filing Log`). The log uses markdown table format with columns: Timestamp, Filename, Source Path, Destination Path, Trigger, Status.

## Concurrency

Batch folder transcription processes at most 3 images concurrently (`MAX_CONCURRENT_TRANSCRIPTIONS`). Individual failures do not abort the batch; each result is tracked independently.

## Network

All network requests use Obsidian's `requestUrl` (not `fetch`) for CORS-free HTTP access. Exception: Ollama `/api/pull` uses native `fetch` because `requestUrl` does not support streaming responses (needed for pull progress). Ollama API endpoints used: `/api/tags` (list), `/api/chat` (transcribe), `/api/pull` (install), `/api/delete` (remove). OpenAI-compatible endpoints used: `/models` (list), `/chat/completions` (transcribe). All responses are validated with Zod schemas.

## Desktop Only

The plugin is `isDesktopOnly: true` because it requires a local Ollama server.
