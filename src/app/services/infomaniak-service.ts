import { requestUrl } from 'obsidian'
import type { RequestUrlParam, RequestUrlResponse } from 'obsidian'
import { arrayBufferToBase64 } from '../../utils/base64'
import { log } from '../../utils/log'
import { openAiChatCompletionsResponseSchema, openAiModelsResponseSchema } from '../domain/schemas'
import type { OpenAiChatCompletionsResponse, OpenAiModelsResponse } from '../domain/openai-types'
import type { AiProviderService, ConnectionTestResult } from './ai-provider-service'

export type RequestFn = (request: RequestUrlParam | string) => Promise<RequestUrlResponse>

export class InfomaniakService implements AiProviderService {
    private baseUrl: string
    private apiKey: string
    private modelName: string
    private temperature: number
    private topP: number
    private maxTokens: number
    private readonly requestFn: RequestFn

    constructor(
        baseUrl: string,
        apiKey: string,
        modelName: string,
        temperature: number,
        topP: number,
        maxTokens: number,
        requestFn?: RequestFn
    ) {
        this.baseUrl = baseUrl
        this.apiKey = apiKey
        this.modelName = modelName
        this.temperature = temperature
        this.topP = topP
        this.maxTokens = maxTokens
        this.requestFn = requestFn ?? requestUrl
    }

    updateConfig(
        baseUrl: string,
        apiKey: string,
        modelName: string,
        temperature: number,
        topP: number,
        maxTokens: number
    ): void {
        this.baseUrl = baseUrl
        this.apiKey = apiKey
        this.modelName = modelName
        this.temperature = temperature
        this.topP = topP
        this.maxTokens = maxTokens
    }

    async testConnection(): Promise<ConnectionTestResult> {
        try {
            const models = await this.listModels()
            return { ok: true, models }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            return { ok: false, error: message }
        }
    }

    async listModels(): Promise<string[]> {
        this.ensureAuth()
        const response = await this.requestFn({
            url: `${this.baseUrl}/models`,
            method: 'GET',
            headers: this.getAuthHeaders(),
            throw: false
        })

        if (response.status !== 200) {
            throw new Error(`Infomaniak server returned ${response.status}: ${response.text}`)
        }

        const data: unknown = response.json
        const parsed: OpenAiModelsResponse = openAiModelsResponseSchema.parse(data)
        return parsed.data.map((m) => m.id)
    }

    async transcribeImage(imageData: ArrayBuffer, prompt: string): Promise<string> {
        this.ensureAuth()
        const base64Image = arrayBufferToBase64(imageData)
        const body = {
            model: this.modelName,
            temperature: this.temperature,
            top_p: this.topP,
            max_tokens: this.maxTokens,
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        {
                            type: 'image_url',
                            image_url: { url: `data:image/png;base64,${base64Image}` }
                        }
                    ]
                }
            ]
        }

        log(
            `Sending transcription request to ${this.baseUrl}/chat/completions (model: ${this.modelName})`,
            'debug'
        )

        const response = await this.requestFn({
            url: `${this.baseUrl}/chat/completions`,
            method: 'POST',
            headers: this.getAuthHeaders(),
            contentType: 'application/json',
            body: JSON.stringify(body),
            throw: false
        })

        if (response.status !== 200) {
            throw new Error(`Infomaniak returned ${response.status}: ${response.text}`)
        }

        const data: unknown = response.json
        const parsed: OpenAiChatCompletionsResponse =
            openAiChatCompletionsResponseSchema.parse(data)
        const firstChoice = parsed.choices[0]
        const content = firstChoice?.message.content?.trim()
        if (!content) {
            throw new Error('Infomaniak response did not include transcription content')
        }
        return content
    }

    private getAuthHeaders(): Record<string, string> {
        return {
            Authorization: `Bearer ${this.apiKey}`
        }
    }

    private ensureAuth(): void {
        if (!this.apiKey.trim()) {
            throw new Error('Infomaniak API key is required')
        }
    }
}
