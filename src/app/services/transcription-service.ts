import { TFile, TFolder } from 'obsidian'
import type { App } from 'obsidian'
import {
    IMAGE_EXTENSIONS,
    IMAGE_MIME_TYPES,
    MAX_CONCURRENT_TRANSCRIPTIONS
} from '../domain/constants'
import type { TranscriptionResult } from '../domain/transcription-result'
import type { PluginSettings } from '../types/plugin-settings.intf'
import type { TranscriptionCacheEntry } from '../types/plugin-settings.intf'
import type { AiProviderService } from './ai-provider-service'
import { processWithConcurrency } from '../../utils/concurrency'
import { log } from '../../utils/log'

export class TranscriptionService {
    private readonly app: App
    private readonly getProvider: () => AiProviderService
    private readonly getSettings: () => PluginSettings
    private readonly updateCacheEntry: (
        sourcePath: string,
        entry: TranscriptionCacheEntry
    ) => Promise<void>

    constructor(
        app: App,
        getProvider: () => AiProviderService,
        getSettings: () => PluginSettings,
        updateCacheEntry: (sourcePath: string, entry: TranscriptionCacheEntry) => Promise<void>
    ) {
        this.app = app
        this.getProvider = getProvider
        this.getSettings = getSettings
        this.updateCacheEntry = updateCacheEntry
    }

    isImageFile(file: TFile): boolean {
        const ext = file.extension.toLowerCase()
        return (IMAGE_EXTENSIONS as readonly string[]).includes(ext)
    }

    getOutputPath(imageFile: TFile): string {
        const pathWithoutExt = imageFile.path.slice(0, -(imageFile.extension.length + 1))
        return `${pathWithoutExt}.md`
    }

    async transcribeFile(file: TFile): Promise<TranscriptionResult> {
        const outputPath = this.getOutputPath(file)
        const startTime = Date.now()

        try {
            const settings = this.getSettings()
            const cacheKey = file.path
            const fingerprint = {
                mtime: file.stat.mtime,
                size: file.stat.size,
                configSignature: this.createConfigSignature(settings)
            }

            if (!settings.overwriteExisting) {
                const existingFile = this.app.vault.getAbstractFileByPath(outputPath)
                if (existingFile) {
                    return {
                        sourceFile: file.path,
                        outputFile: outputPath,
                        success: true,
                        durationMs: Date.now() - startTime
                    }
                }
            }

            const existingOutput = this.app.vault.getAbstractFileByPath(outputPath)
            const cached = settings.transcriptionCache[cacheKey]
            if (
                settings.overwriteExisting &&
                existingOutput instanceof TFile &&
                cached &&
                cached.mtime === fingerprint.mtime &&
                cached.size === fingerprint.size &&
                cached.configSignature === fingerprint.configSignature
            ) {
                log(`Skipping unchanged image: ${file.path}`, 'debug')
                return {
                    sourceFile: file.path,
                    outputFile: outputPath,
                    success: true,
                    skipped: true,
                    durationMs: Date.now() - startTime
                }
            }

            log(`Transcribing: ${file.path}`, 'debug')

            const imageData = await this.app.vault.readBinary(file)
            const ext = file.extension.toLowerCase()
            const mimeType = IMAGE_MIME_TYPES[ext] ?? 'application/octet-stream'
            const markdown = await this.getProvider().transcribeImage(
                imageData,
                mimeType,
                settings.transcriptionPrompt
            )

            const existingFile = this.app.vault.getAbstractFileByPath(outputPath)
            if (existingFile instanceof TFile) {
                await this.app.vault.modify(existingFile, markdown)
            } else {
                await this.app.vault.create(outputPath, markdown)
            }

            await this.updateCacheEntry(cacheKey, fingerprint)

            const durationMs = Date.now() - startTime
            log(`Transcribed ${file.path} in ${durationMs}ms`, 'debug')

            return {
                sourceFile: file.path,
                outputFile: outputPath,
                success: true,
                durationMs
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            log(`Failed to transcribe ${file.path}: ${message}`, 'error')

            return {
                sourceFile: file.path,
                outputFile: outputPath,
                success: false,
                error: message,
                durationMs: Date.now() - startTime
            }
        }
    }

    getImageFilesInFolder(folder: TFolder, includeSubfolders: boolean): TFile[] {
        const images: TFile[] = []

        for (const child of folder.children) {
            if (child instanceof TFile && this.isImageFile(child)) {
                images.push(child)
            } else if (includeSubfolders && child instanceof TFolder) {
                images.push(...this.getImageFilesInFolder(child, true))
            }
        }

        return images
    }

    async transcribeFolder(
        folder: TFolder,
        includeSubfolders: boolean,
        onProgress?: (current: number, total: number, fileName: string) => void
    ): Promise<TranscriptionResult[]> {
        const imageFiles = this.getImageFilesInFolder(folder, includeSubfolders)

        if (imageFiles.length === 0) {
            return []
        }

        let completed = 0
        return processWithConcurrency(
            imageFiles,
            MAX_CONCURRENT_TRANSCRIPTIONS,
            async (file: TFile) => {
                completed++
                onProgress?.(completed, imageFiles.length, file.name)
                return this.transcribeFile(file)
            }
        )
    }

    private createConfigSignature(settings: PluginSettings): string {
        return JSON.stringify({
            provider: settings.provider,
            modelName: settings.modelName,
            transcriptionPrompt: settings.transcriptionPrompt,
            temperature: settings.temperature,
            topP: settings.topP,
            maxTokens: settings.maxTokens
        })
    }
}
