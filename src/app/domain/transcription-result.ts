export interface TranscriptionResult {
    sourceFile: string
    outputFile: string
    success: boolean
    skipped?: boolean
    error?: string
    durationMs?: number
}
