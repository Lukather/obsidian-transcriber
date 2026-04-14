# Architecture

## Overview

Obsidian Transcriber is a desktop-focused plugin that transcribes images to Markdown using either Ollama or an OpenAI-compatible provider. It follows a layered architecture with clear separation of concerns.

## Layers

### Entry Point (`src/main.ts`)

Re-exports `TranscriberPlugin` as the default export for Obsidian.

### Plugin (`src/app/plugin.ts`)

`TranscriberPlugin` extends Obsidian's `Plugin`. Manages lifecycle (onload/onunload), initializes services, registers commands and events, adds the settings tab. Owns immutable settings via Immer.

### Services (`src/app/services/`)

- **OllamaService** — HTTP client for Ollama's REST API (`/api/tags`, `/api/chat`, `/api/pull`, `/api/delete`). Uses Obsidian's `requestUrl`. Accepts an optional `RequestFn` for testability.
- **OpenAiCompatibleService** — HTTP client for OpenAI-compatible endpoints (`/models`, `/chat/completions`) with bearer auth and tunable model parameters.
- **AiProviderService** — Shared provider interface used by orchestration.
- **TranscriptionService** — Orchestrates transcription. Reads images from the vault, calls the active provider service, writes Markdown output. Handles batch operations with concurrency limiting.

### Commands (`src/app/commands/`)

- **register-commands.ts** — Registers command palette commands
- **register-events.ts** — Registers context menu (file-menu) events for files and folders, and editor-menu events for image embeds
- **transcribe-image-command.ts** — `transcribe-current-image` command (checkCallback, active only on image files)
- **transcribe-note-images-command.ts** — `transcribe-note-images` command (checkCallback, active on `.md` files; batch-transcribes all embedded images)
- **transcribe-folder-images-command.ts** — `transcribe-folder-images` command (folder picker → image multi-select → batch transcribe)
- **install-model-command.ts** — `install-model` command with SuggestModal for downloading models from Ollama
- **select-model-command.ts** — `select-model` command with SuggestModal to pick from installed models
- **remove-model-command.ts** — `remove-model` command with SuggestModal to delete installed models

### Settings (`src/app/settings/`)

- **settings-tab.ts** — `TranscriberSettingTab` with provider selector (Ollama/OpenAI-compatible), provider-specific config, transcription settings, and support sections
- **settings-constants.ts** — UI label constants

### Domain (`src/app/domain/`)

- **constants.ts** — Image extensions, known models, defaults, concurrency limit
- **ollama-types.ts** — TypeScript interfaces for Ollama API
- **openai-types.ts** — TypeScript interfaces for OpenAI-compatible provider responses
- **schemas.ts** — Zod schemas for response validation
- **transcription-result.ts** — `TranscriptionResult` interface

### UI (`src/app/ui/`)

- **progress-notice.ts** — `ProgressNotice` wrapping Obsidian's `Notice` with in-place updates for batch progress
- **folder-suggest-modal.ts** — `FolderSuggestModal` (FuzzySuggestModal) for picking a vault folder
- **image-select-modal.ts** — `ImageSelectModal` (Modal) with checkbox list for selecting images to transcribe

### App Utilities (`src/app/utils/`)

- **note-images.ts** — Extracts image `TFile` references from a note's embeds via `metadataCache`

### Utilities (`src/utils/`)

- **base64.ts** — `arrayBufferToBase64` for image encoding
- **concurrency.ts** — `processWithConcurrency` promise pool
- **log.ts** — Logging utility

## Data Flow

1. User triggers transcription (command palette, file explorer context menu, or editor context menu)
2. TranscriptionService reads image binary from vault
3. Active provider service encodes image to base64 and sends it to either Ollama (`/api/chat`) or an OpenAI-compatible API (`/chat/completions`)
4. Provider returns Markdown text
5. TranscriptionService writes `.md` file alongside the source image
6. Notice shown to user with result
