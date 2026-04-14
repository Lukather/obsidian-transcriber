import {
    DEFAULT_MODEL,
    DEFAULT_INFOMANIAK_URL,
    DEFAULT_MAX_TOKENS,
    DEFAULT_PROVIDER,
    DEFAULT_TEMPERATURE,
    DEFAULT_OLLAMA_URL,
    DEFAULT_TOP_P,
    DEFAULT_TRANSCRIPTION_PROMPT
} from '../domain/constants'

export type AiProvider = 'ollama' | 'infomaniak'

export interface TranscriptionCacheEntry {
    mtime: number
    size: number
    configSignature: string
}

export interface PluginSettings {
    provider: AiProvider
    ollamaUrl: string
    infomaniakBaseUrl: string
    infomaniakApiKey: string
    modelName: string
    transcriptionPrompt: string
    temperature: number
    topP: number
    maxTokens: number
    includeSubfolders: boolean
    overwriteExisting: boolean
    transcriptionCache: Record<string, TranscriptionCacheEntry>
}

export const DEFAULT_SETTINGS: PluginSettings = {
    provider: DEFAULT_PROVIDER,
    ollamaUrl: DEFAULT_OLLAMA_URL,
    infomaniakBaseUrl: DEFAULT_INFOMANIAK_URL,
    infomaniakApiKey: '',
    modelName: DEFAULT_MODEL,
    transcriptionPrompt: DEFAULT_TRANSCRIPTION_PROMPT,
    temperature: DEFAULT_TEMPERATURE,
    topP: DEFAULT_TOP_P,
    maxTokens: DEFAULT_MAX_TOKENS,
    includeSubfolders: false,
    overwriteExisting: false,
    transcriptionCache: {}
}
