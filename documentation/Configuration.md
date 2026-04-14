# Configuration

All settings are persisted via Obsidian's `loadData()`/`saveData()`.

## Provider Selection

| Setting  | Default          | Description                             |
| -------- | ---------------- | --------------------------------------- |
| Provider | `ollama`         | Select `ollama` or `infomaniak` backend |
| Model    | `glm-ocr:latest` | Model used by the active provider       |

## Ollama Configuration

| Setting              | Default                  | Description                                                     |
| -------------------- | ------------------------ | --------------------------------------------------------------- |
| Server URL           | `http://localhost:11434` | Ollama server address                                           |
| Test connection      | —                        | Verifies Ollama is reachable and refreshes installed model list |
| Vision model         | `glm-ocr:latest`         | Dropdown populated dynamically from installed Ollama models     |
| Recommended models   | —                        | Install buttons for recommended models not yet installed        |
| Install custom model | —                        | Enter any Ollama model name to download and install it          |

Recommended models: `maternion/LightOnOCR-2:1b`, `qwen3.5:2b`, `qwen3.5:4b`, `qwen3.5:9b`, `qwen3.5:27b`, `qwen3.5:35b`

Models can be installed directly from settings. Installed models are auto-detected via Ollama's `/api/tags` endpoint. Pull progress uses streaming `/api/pull` via native `fetch`.

## Infomaniak Configuration (OpenAI-compatible)

| Setting      | Default                                                     | Description                                          |
| ------------ | ----------------------------------------------------------- | ---------------------------------------------------- |
| API endpoint | `https://api.infomaniak.com/2/ai/YOUR_PROJECT_ID/openai/v1` | OpenAI-compatible base URL                           |
| API key      | ``                                                          | Bearer token used for auth                           |
| Test         | —                                                           | Verifies endpoint/key and refreshes available models |
| Model        | `glm-ocr:latest`                                            | Dropdown populated from `/models`                    |
| Temperature  | `0.2`                                                       | Controls randomness (0..2)                           |
| Top P        | `1`                                                         | Nucleus sampling probability (0..1)                  |
| Max tokens   | `4096`                                                      | Maximum completion tokens returned by model          |

## Transcription Settings

| Setting              | Default           | Description                                              |
| -------------------- | ----------------- | -------------------------------------------------------- |
| Transcription prompt | (detailed prompt) | Instructions sent to the vision model with each image    |
| Include subfolders   | `false`           | Process images in subfolders during folder transcription |
| Overwrite existing   | `false`           | Re-transcribe images that already have a `.md` file      |

When **Overwrite existing** is enabled, the plugin still skips unchanged images (same file fingerprint and same transcription config) to speed up repeated batch runs.

## Constants

| Constant                      | Value                                     | Description                          |
| ----------------------------- | ----------------------------------------- | ------------------------------------ |
| MAX_CONCURRENT_TRANSCRIPTIONS | 3                                         | Max parallel transcription requests  |
| Supported image formats       | png, jpg, jpeg, gif, bmp, webp, avif, svg | File extensions recognized as images |
