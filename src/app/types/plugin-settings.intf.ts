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
import {
    DEFAULT_FILING_MODEL,
    DEFAULT_INBOX_FOLDER_PATH,
    DEFAULT_LOG_NOTE_PATH,
    DEFAULT_MAX_LINES_TO_SCAN
} from './filing-settings.intf'

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
    // Auto-filing settings
    autoFilingEnabled: boolean
    inboxFolderPath: string
    filingModel: string
    logNotePath: string
    maxLinesToScan: number
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
    transcriptionCache: {},
    // Auto-filing settings
    autoFilingEnabled: false,
    inboxFolderPath: DEFAULT_INBOX_FOLDER_PATH,
    filingModel: DEFAULT_FILING_MODEL,
    logNotePath: DEFAULT_LOG_NOTE_PATH,
    maxLinesToScan: DEFAULT_MAX_LINES_TO_SCAN
}
