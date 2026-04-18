import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { TranscriptionService } from './transcription-service'
import type { AiProviderService } from './ai-provider-service'
import type { PluginSettings } from '../types/plugin-settings.intf'
import { DEFAULT_SETTINGS } from '../types/plugin-settings.intf'
import { TFile, TFolder } from 'obsidian'
import type { App } from 'obsidian'

function createMockFile(path: string, extension: string): TFile {
    const file = Object.create(TFile.prototype) as TFile & Record<string, unknown>
    file['path'] = path
    file['name'] = path.split('/').pop() ?? path
    file['extension'] = extension
    file['basename'] = path.split('/').pop()?.replace(`.${extension}`, '') ?? ''
    file['stat'] = { ctime: 12000, mtime: 12345, size: 9876 }
    return file
}

function createMockFolder(name: string, children: (TFile | TFolder)[]): TFolder {
    const folder = Object.create(TFolder.prototype) as TFolder & Record<string, unknown>
    folder['name'] = name
    folder['path'] = name
    folder['children'] = children
    return folder
}

describe('TranscriptionService', () => {
    let service: TranscriptionService
    let mockApp: App
    let mockProviderTranscribe: ReturnType<typeof mock>
    let settings: PluginSettings
    let mockGetAbstractFileByPath: ReturnType<typeof mock>
    let mockModify: ReturnType<typeof mock>
    let mockUpdateCacheEntry: ReturnType<typeof mock<(p: string, e: unknown) => Promise<void>>>

    beforeEach(() => {
        settings = { ...DEFAULT_SETTINGS, transcriptionCache: {} }

        mockGetAbstractFileByPath = mock(() => null)
        mockModify = mock(() => Promise.resolve())
        mockProviderTranscribe = mock(() => Promise.resolve('# Transcribed'))
        mockUpdateCacheEntry = mock(async () => undefined)

        mockApp = {
            vault: {
                readBinary: mock(() => Promise.resolve(new ArrayBuffer(10))),
                create: mock(() => Promise.resolve(createMockFile('out.md', 'md'))),
                modify: mockModify,
                getAbstractFileByPath: mockGetAbstractFileByPath
            }
        } as unknown as App

        const mockProvider: AiProviderService = {
            testConnection: async () => ({ ok: true, models: [] }),
            listModels: async () => [],
            transcribeImage: mockProviderTranscribe,
            classifyText: mock(() => Promise.resolve(''))
        }

        service = new TranscriptionService(
            mockApp,
            () => mockProvider,
            () => settings,
            mockUpdateCacheEntry
        )
    })

    describe('isImageFile', () => {
        test('returns true for image files', () => {
            expect(service.isImageFile(createMockFile('photo.png', 'png'))).toBe(true)
            expect(service.isImageFile(createMockFile('photo.jpg', 'jpg'))).toBe(true)
            expect(service.isImageFile(createMockFile('photo.jpeg', 'jpeg'))).toBe(true)
            expect(service.isImageFile(createMockFile('photo.webp', 'webp'))).toBe(true)
            expect(service.isImageFile(createMockFile('photo.gif', 'gif'))).toBe(true)
            expect(service.isImageFile(createMockFile('photo.bmp', 'bmp'))).toBe(true)
            expect(service.isImageFile(createMockFile('photo.avif', 'avif'))).toBe(true)
            expect(service.isImageFile(createMockFile('photo.svg', 'svg'))).toBe(true)
        })

        test('returns false for non-image files', () => {
            expect(service.isImageFile(createMockFile('doc.md', 'md'))).toBe(false)
            expect(service.isImageFile(createMockFile('data.json', 'json'))).toBe(false)
            expect(service.isImageFile(createMockFile('style.css', 'css'))).toBe(false)
        })
    })

    describe('getOutputPath', () => {
        test('replaces extension with .md', () => {
            const file = createMockFile('photos/image.png', 'png')
            expect(service.getOutputPath(file)).toBe('photos/image.md')
        })

        test('handles files with dots in name', () => {
            const file = createMockFile('photos/my.photo.jpg', 'jpg')
            expect(service.getOutputPath(file)).toBe('photos/my.photo.md')
        })
    })

    describe('transcribeFile', () => {
        test('creates markdown file from image', async () => {
            const file = createMockFile('photos/test.png', 'png')
            const result = await service.transcribeFile(file)

            expect(result.success).toBe(true)
            expect(result.sourceFile).toBe('photos/test.png')
            expect(result.outputFile).toBe('photos/test.md')
            expect(result.durationMs).toBeDefined()
            expect(result.skipped).toBeUndefined()
        })

        test('skips existing files when overwrite is disabled', async () => {
            mockGetAbstractFileByPath.mockReturnValueOnce({})
            settings.overwriteExisting = false

            const file = createMockFile('photos/test.png', 'png')
            const result = await service.transcribeFile(file)

            expect(result.success).toBe(true)
            expect(mockProviderTranscribe).not.toHaveBeenCalled()
        })

        test('overwrites existing files when enabled', async () => {
            const existingFile = createMockFile('photos/test.md', 'md')
            // When overwriteExisting is true, the first check is skipped entirely.
            // The only getAbstractFileByPath call happens after transcription to decide create vs modify.
            mockGetAbstractFileByPath.mockReturnValue(existingFile)
            settings.overwriteExisting = true
            settings.transcriptionCache = {}

            const file = createMockFile('photos/test.png', 'png')
            await service.transcribeFile(file)

            expect(mockModify).toHaveBeenCalled()
        })

        test('skips unchanged files when overwrite is enabled and fingerprint matches', async () => {
            const existingOutput = createMockFile('photos/test.md', 'md')
            settings.overwriteExisting = true
            settings.transcriptionCache['photos/test.png'] = {
                mtime: 12345,
                size: 9876,
                configSignature: JSON.stringify({
                    provider: settings.provider,
                    modelName: settings.modelName,
                    transcriptionPrompt: settings.transcriptionPrompt,
                    temperature: settings.temperature,
                    topP: settings.topP,
                    maxTokens: settings.maxTokens
                })
            }
            mockGetAbstractFileByPath.mockReturnValue(existingOutput)

            const file = createMockFile('photos/test.png', 'png')
            const result = await service.transcribeFile(file)

            expect(result.success).toBe(true)
            expect(result.skipped).toBe(true)
            expect(mockProviderTranscribe).not.toHaveBeenCalled()
        })

        test('retranscribes changed files when overwrite is enabled', async () => {
            const existingOutput = createMockFile('photos/test.md', 'md')
            settings.overwriteExisting = true
            settings.transcriptionCache['photos/test.png'] = {
                mtime: 11111,
                size: 22222,
                configSignature: 'old-signature'
            }
            mockGetAbstractFileByPath.mockReturnValue(existingOutput)

            const file = createMockFile('photos/test.png', 'png')
            await service.transcribeFile(file)

            expect(mockProviderTranscribe).toHaveBeenCalled()
            expect(mockUpdateCacheEntry).toHaveBeenCalled()
        })

        test('returns error on failure', async () => {
            mockProviderTranscribe.mockRejectedValueOnce(new Error('Model not found'))

            const file = createMockFile('photos/test.png', 'png')
            const result = await service.transcribeFile(file)

            expect(result.success).toBe(false)
            expect(result.error).toBe('Model not found')
        })
    })

    describe('getImageFilesInFolder', () => {
        test('returns image files in folder', () => {
            const folder = createMockFolder('photos', [
                createMockFile('photos/a.png', 'png'),
                createMockFile('photos/b.md', 'md'),
                createMockFile('photos/c.jpg', 'jpg')
            ])

            const images = service.getImageFilesInFolder(folder, false)
            expect(images.length).toBe(2)
        })

        test('includes subfolders when enabled', () => {
            const subfolder = createMockFolder('photos/sub', [
                createMockFile('photos/sub/nested.png', 'png')
            ])
            const folder = createMockFolder('photos', [
                createMockFile('photos/a.png', 'png'),
                subfolder
            ])

            const images = service.getImageFilesInFolder(folder, true)
            expect(images.length).toBe(2)
        })

        test('excludes subfolders when disabled', () => {
            const subfolder = createMockFolder('photos/sub', [
                createMockFile('photos/sub/nested.png', 'png')
            ])
            const folder = createMockFolder('photos', [
                createMockFile('photos/a.png', 'png'),
                subfolder
            ])

            const images = service.getImageFilesInFolder(folder, false)
            expect(images.length).toBe(1)
        })
    })
})
