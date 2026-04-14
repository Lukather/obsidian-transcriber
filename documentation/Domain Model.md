# Domain Model

## PluginSettings

- `provider: 'ollama' | 'infomaniak'` — Active transcription provider (default: `ollama`)
- `ollamaUrl: string` — Ollama server URL (default: `http://localhost:11434`)
- `infomaniakBaseUrl: string` — OpenAI-compatible Infomaniak endpoint
- `infomaniakApiKey: string` — Bearer API key
- `modelName: string` — Vision model name for the active provider (default: `glm-ocr:latest`)
- `transcriptionPrompt: string` — Prompt sent with each image
- `temperature: number` — Completion temperature for Infomaniak/OpenAI-style requests
- `topP: number` — Nucleus sampling parameter
- `maxTokens: number` — Maximum completion tokens
- `includeSubfolders: boolean` — Process subfolders in batch operations (default: false)
- `overwriteExisting: boolean` — Overwrite existing `.md` files (default: false)

## TranscriptionResult

- `sourceFile: string` — Path of the source image
- `outputFile: string` — Path of the output `.md` file
- `success: boolean`
- `error?: string` — Error message if failed
- `durationMs?: number` — Processing time

## Ollama API Types

- `OllamaChatRequest` — Chat completion request with model, messages (including base64 images), stream flag
- `OllamaChatResponse` — Response with model, message content, done flag
- `OllamaTagsResponse` — List of available models from `/api/tags`
- `OllamaModelInfo` — Individual model metadata (name, size, modified_at)
- `OllamaPullProgress` — Streaming progress during model pull (status, digest, total, completed)
- `OllamaDeleteResponse` — Response from `/api/delete` (status, error)

## ConnectionTestResult

- `ok: boolean` — Whether connection succeeded
- `error?: string` — Error message if failed
- `models?: string[]` — Available model names if succeeded

## OpenAI-Compatible API Types

- `OpenAiModelsResponse` — Available model list from `/models`
- `OpenAiChatCompletionsResponse` — Transcription response from `/chat/completions`
