import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { InfomaniakService } from './infomaniak-service'
import type { RequestFn } from './infomaniak-service'
import type { RequestUrlResponse } from 'obsidian'

describe('InfomaniakService', () => {
    let service: InfomaniakService
    let mockRequest: ReturnType<typeof mock<RequestFn>>

    beforeEach(() => {
        mockRequest = mock<RequestFn>()
        service = new InfomaniakService(
            'https://api.infomaniak.com/2/ai/YOUR_PROJECT_ID/openai/v1',
            'secret-key',
            'vision-model',
            0.2,
            1,
            4096,
            mockRequest
        )
    })

    test('lists models from OpenAI-compatible endpoint', async () => {
        mockRequest.mockResolvedValue({
            status: 200,
            json: {
                data: [
                    { id: 'vision-model', object: 'model' },
                    { id: 'ocr-model', object: 'model' }
                ]
            }
        } as unknown as RequestUrlResponse)

        const models = await service.listModels()
        expect(models).toEqual(['vision-model', 'ocr-model'])
    })

    test('returns content from chat completions', async () => {
        mockRequest.mockResolvedValue({
            status: 200,
            json: {
                id: 'chatcmpl-1',
                object: 'chat.completion',
                model: 'vision-model',
                choices: [
                    {
                        index: 0,
                        message: {
                            role: 'assistant',
                            content: '# Transcribed'
                        },
                        finish_reason: 'stop'
                    }
                ]
            }
        } as unknown as RequestUrlResponse)

        const result = await service.transcribeImage(
            new TextEncoder().encode('img').buffer,
            'prompt'
        )
        expect(result).toBe('# Transcribed')

        const callArgs = mockRequest.mock.calls[0]![0] as {
            url: string
            headers: Record<string, string>
        }
        expect(callArgs.url).toContain('/chat/completions')
        expect(callArgs.headers['Authorization']).toBe('Bearer secret-key')
    })

    test('fails fast when API key is missing', async () => {
        service.updateConfig(
            'https://api.infomaniak.com/2/ai/YOUR_PROJECT_ID/openai/v1',
            '',
            'vision-model',
            0.2,
            1,
            4096
        )

        try {
            await service.listModels()
            expect.unreachable('Should have thrown')
        } catch (error) {
            expect((error as Error).message).toContain('API key is required')
        }
    })
})
