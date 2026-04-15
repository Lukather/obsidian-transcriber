import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { OpenAiCompatibleService } from './openai-service'
import type { RequestFn } from './openai-service'
import type { RequestUrlResponse } from 'obsidian'

describe('OpenAiCompatibleService', () => {
    let service: OpenAiCompatibleService
    let mockRequest: ReturnType<typeof mock<RequestFn>>

    beforeEach(() => {
        mockRequest = mock<RequestFn>()
        service = new OpenAiCompatibleService(
            'https://api.openai.com/v1',
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
            'image/png',
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

    test('uses provided mimeType in image data URL', async () => {
        mockRequest.mockResolvedValue({
            status: 200,
            json: {
                id: 'chatcmpl-2',
                object: 'chat.completion',
                model: 'vision-model',
                choices: [
                    {
                        index: 0,
                        message: { role: 'assistant', content: '# Result' },
                        finish_reason: 'stop'
                    }
                ]
            }
        } as unknown as RequestUrlResponse)

        await service.transcribeImage(
            new TextEncoder().encode('img').buffer,
            'image/webp',
            'prompt'
        )

        const callArgs = mockRequest.mock.calls[0]![0] as { body: string }
        const body = JSON.parse(callArgs.body) as {
            messages: Array<{ content: Array<{ type: string; image_url?: { url: string } }> }>
        }
        const imageContent = body.messages[0]?.content[1]
        expect(imageContent?.image_url?.url).toMatch(/^data:image\/webp;base64,/)
    })

    test('fails fast when API key is missing', async () => {
        service.updateConfig('https://api.openai.com/v1', '', 'vision-model', 0.2, 1, 4096)

        try {
            await service.listModels()
            expect.unreachable('Should have thrown')
        } catch (error) {
            expect((error as Error).message).toContain('API key is required')
        }
    })
})
