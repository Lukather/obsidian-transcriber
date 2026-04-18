export const DEFAULT_FILING_MODEL = ''

export const DEFAULT_LOG_NOTE_PATH = 'Auto-Filing Log'

export const DEFAULT_MAX_LINES_TO_SCAN = 5

export const DEFAULT_INBOX_FOLDER_PATH = 'Inbox'

export interface FilingSettings {
    autoFilingEnabled: boolean
    filingModel: string
    logNotePath: string
    maxLinesToScan: number
}

export const DEFAULT_FILING_SETTINGS: FilingSettings = {
    autoFilingEnabled: false,
    filingModel: DEFAULT_FILING_MODEL,
    logNotePath: DEFAULT_LOG_NOTE_PATH,
    maxLinesToScan: DEFAULT_MAX_LINES_TO_SCAN
}

export interface FilingTags {
    folder?: string
    project?: string
    client?: string
    [key: string]: string | undefined
}

export interface FilingResult {
    destinationPath: string
    cleanedMarkdown: string
    tags: FilingTags
    status: 'success' | 'noTags' | 'llmFailed' | 'defaulted'
}

export interface LogEntry {
    timestamp: string
    filename: string
    sourcePath: string
    destinationPath: string
    triggerTags: string
    status: 'Success' | 'Created Folder' | 'Defaulted' | 'Error'
}
