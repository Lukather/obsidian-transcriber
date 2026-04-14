export interface OpenAiModelsResponse {
    data: Array<{
        id: string
        object: string
    }>
}

export interface OpenAiChatCompletionsResponse {
    id: string
    object: string
    model: string
    choices: Array<{
        index: number
        message: {
            role: string
            content: string | null
        }
        finish_reason: string | null
    }>
}
