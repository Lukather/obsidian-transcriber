export interface ConnectionTestResult {
    ok: boolean
    error?: string
    models?: string[]
}

export interface AiProviderService {
    testConnection(): Promise<ConnectionTestResult>
    listModels(): Promise<string[]>
    transcribeImage(imageData: ArrayBuffer, prompt: string): Promise<string>
}
