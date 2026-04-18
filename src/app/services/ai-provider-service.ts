export interface ConnectionTestResult {
    ok: boolean
    error?: string
    models?: string[]
}

export interface AiProviderService {
    testConnection(): Promise<ConnectionTestResult>
    listModels(): Promise<string[]>
    transcribeImage(imageData: ArrayBuffer, mimeType: string, prompt: string): Promise<string>
    classifyText(prompt: string, model: string): Promise<string>
}
