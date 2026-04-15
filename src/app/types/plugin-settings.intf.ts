import {
    DEFAULT_MODEL,
    DEFAULT_OPENAI_URL,
    DEFAULT_MAX_TOKENS,
    DEFAULT_PROVIDER,
    DEFAULT_TEMPERATURE,
    DEFAULT_OLLAMA_URL,
    DEFAULT_TOP_P,
    DEFAULT_TRANSCRIPTION_PROMPT
} from '../domain/constants'

export type AiProvider = 'ollama' | 'openai'

export interface TranscriptionCacheEntry {
    mtime: number
    size: number
    configSignature: string
}

export interface PluginSettings {
    provider: AiProvider
    ollamaUrl: string
    openAiBaseUrl: string
    openAiApiKey: string
    modelName: string
    transcriptionPrompt: string
    temperature: number
    topP: number
    maxTokens: number
    includeSubfolders: boolean
    overwriteExisting: boolean
    skipUnchangedImages: boolean
    transcriptionCache: Record<string, TranscriptionCacheEntry>
}

export const DEFAULT_SETTINGS: PluginSettings = {
    provider: DEFAULT_PROVIDER,
    ollamaUrl: DEFAULT_OLLAMA_URL,
    openAiBaseUrl: DEFAULT_OPENAI_URL,
    openAiApiKey: '',
    modelName: DEFAULT_MODEL,
    transcriptionPrompt: DEFAULT_TRANSCRIPTION_PROMPT,
    temperature: DEFAULT_TEMPERATURE,
    topP: DEFAULT_TOP_P,
    maxTokens: DEFAULT_MAX_TOKENS,
    includeSubfolders: false,
    overwriteExisting: false,
    skipUnchangedImages: true,
    transcriptionCache: {}
}
