import { z } from 'zod'

export const ollamaChatMessageSchema = z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string()
})

export const ollamaChatResponseSchema = z.object({
    model: z.string(),
    message: ollamaChatMessageSchema,
    done: z.boolean()
})

export const ollamaModelInfoSchema = z.object({
    name: z.string(),
    model: z.string(),
    modified_at: z.string(),
    size: z.number()
})

export const ollamaTagsResponseSchema = z.object({
    models: z.array(ollamaModelInfoSchema)
})

export const ollamaPullProgressSchema = z.object({
    status: z.string(),
    digest: z.string().optional(),
    total: z.number().optional(),
    completed: z.number().optional()
})

export const ollamaDeleteResponseSchema = z.object({
    status: z.string().optional(),
    error: z.string().optional()
})

export const openAiModelsResponseSchema = z.object({
    data: z.array(
        z.object({
            id: z.string(),
            object: z.string()
        })
    )
})

export const openAiChatCompletionsResponseSchema = z.object({
    id: z.string(),
    object: z.string(),
    model: z.string(),
    choices: z.array(
        z.object({
            index: z.number(),
            message: z.object({
                role: z.string(),
                content: z.string().nullable()
            }),
            finish_reason: z.string().nullable()
        })
    )
})
