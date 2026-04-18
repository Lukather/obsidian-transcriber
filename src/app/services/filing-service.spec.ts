import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { FilingService } from './filing-service'
import { DEFAULT_SETTINGS } from '../types/plugin-settings.intf'
import type { PluginSettings } from '../types/plugin-settings.intf'
import type { AiProviderService } from './ai-provider-service'
import { TFile, TFolder } from 'obsidian'
import type { App } from 'obsidian'

function createMockParent(path: string): TFolder {
    const folder = Object.create(TFolder.prototype) as TFolder & Record<string, unknown>
    folder['path'] = path
    folder['name'] = path.split('/').pop() ?? path
    folder['children'] = []
    return folder
}

function createMockFile(path: string, extension: string, parentPath?: string): TFile {
    const file = Object.create(TFile.prototype) as TFile & Record<string, unknown>
    file['path'] = path
    file['name'] = path.split('/').pop() ?? path
    file['extension'] = extension
    file['basename'] = path.split('/').pop()?.replace(`.${extension}`, '') ?? ''
    file['stat'] = { ctime: 0, mtime: 0, size: 0 }
    if (parentPath !== undefined) {
        file['parent'] = createMockParent(parentPath)
    } else {
        const parts = path.split('/')
        parts.pop()
        file['parent'] = parts.length > 0 ? createMockParent(parts.join('/')) : null
    }
    return file
}

describe('FilingService', () => {
    let service: FilingService
    let mockApp: App
    let settings: PluginSettings
    let mockGetAbstractFileByPath: ReturnType<typeof mock>
    let mockCreate: ReturnType<typeof mock>
    let mockModify: ReturnType<typeof mock>
    let mockCreateFolder: ReturnType<typeof mock>
    let mockRead: ReturnType<typeof mock>
    let mockTrashFile: ReturnType<typeof mock>
    let mockClassifyText: ReturnType<typeof mock>
    let mockGetAllLoadedFiles: ReturnType<typeof mock>

    beforeEach(() => {
        settings = {
            ...DEFAULT_SETTINGS,
            autoFilingEnabled: true,
            maxLinesToScan: 5,
            inboxFolderPath: 'Inbox',
            filingModel: 'llava:13b'
        }

        mockGetAbstractFileByPath = mock(() => null)
        mockCreate = mock(() => Promise.resolve(createMockFile('out.md', 'md')))
        mockModify = mock(() => Promise.resolve())
        mockCreateFolder = mock(() => Promise.resolve())
        mockRead = mock(() => Promise.resolve(''))
        mockTrashFile = mock(() => Promise.resolve())
        mockClassifyText = mock(() => Promise.resolve('EPAM/BH'))
        mockGetAllLoadedFiles = mock(() => [])

        mockApp = {
            vault: {
                getAbstractFileByPath: mockGetAbstractFileByPath,
                create: mockCreate,
                modify: mockModify,
                createFolder: mockCreateFolder,
                read: mockRead,
                getAllLoadedFiles: mockGetAllLoadedFiles
            },
            fileManager: {
                trashFile: mockTrashFile
            }
        } as unknown as App

        const mockProvider: AiProviderService = {
            testConnection: async () => ({ ok: true, models: [] }),
            listModels: async () => [],
            transcribeImage: mock(() => Promise.resolve('')),
            classifyText: mockClassifyText
        }

        service = new FilingService(
            mockApp,
            () => settings,
            () => mockProvider
        )
    })

    // ─── parseTags ────────────────────────────────────────────────────────────

    describe('parseTags', () => {
        test('parses a single tag', () => {
            const tags = service.parseTags('#folder: invoices/2024\nsome content', 5)
            expect(tags['folder']).toBe('invoices/2024')
        })

        test('parses multiple tags', () => {
            const md = '#client: Acme\n#project: Website\n#category: Design\nBody text'
            const tags = service.parseTags(md, 5)
            expect(tags['client']).toBe('Acme')
            expect(tags['project']).toBe('Website')
            expect(tags['category']).toBe('Design')
        })

        test('ignores tags beyond maxLines', () => {
            const md = 'line1\nline2\nline3\nline4\n#folder: late'
            const tags = service.parseTags(md, 4)
            expect(tags['folder']).toBeUndefined()
        })

        test('includes tag on last scanned line', () => {
            const md = 'line1\nline2\nline3\nline4\n#folder: here'
            const tags = service.parseTags(md, 5)
            expect(tags['folder']).toBe('here')
        })

        test('trims tag values', () => {
            const tags = service.parseTags('#folder:   spaced value  ', 5)
            expect(tags['folder']).toBe('spaced value')
        })

        test('returns empty object when no tags found', () => {
            const tags = service.parseTags('just plain text\nno tags here', 5)
            expect(Object.keys(tags)).toHaveLength(0)
        })

        test('ignores lines that are not tags', () => {
            const md = 'Normal text\n## Heading\n#folder: valid'
            const tags = service.parseTags(md, 5)
            expect(tags['folder']).toBe('valid')
        })
    })

    // ─── cleanMarkdown ────────────────────────────────────────────────────────

    describe('cleanMarkdown', () => {
        test('removes tag lines from scanned section', () => {
            const md = '#folder: invoices\nBody content\nMore content'
            const cleaned = service.cleanMarkdown(md, 5)
            expect(cleaned).not.toContain('#folder:')
            expect(cleaned).toContain('Body content')
        })

        test('removes multiple tag lines', () => {
            const md = '#client: Acme\n#project: Web\nActual content'
            const cleaned = service.cleanMarkdown(md, 5)
            expect(cleaned).not.toContain('#client:')
            expect(cleaned).not.toContain('#project:')
            expect(cleaned).toContain('Actual content')
        })

        test('preserves non-tag lines in scanned section', () => {
            const md = '## Heading\n#folder: path\nBody'
            const cleaned = service.cleanMarkdown(md, 5)
            expect(cleaned).toContain('## Heading')
            expect(cleaned).toContain('Body')
        })

        test('does not remove tags beyond maxLines', () => {
            const md = 'line1\nline2\nline3\nline4\nline5\n#folder: late'
            const cleaned = service.cleanMarkdown(md, 5)
            expect(cleaned).toContain('#folder: late')
        })

        test('returns identical content when no tags present', () => {
            const md = 'Just\nplain\ntext'
            expect(service.cleanMarkdown(md, 5)).toBe(md)
        })
    })

    // ─── parseLlmResponse ─────────────────────────────────────────────────────

    describe('parseLlmResponse', () => {
        test('returns clean path as-is', () => {
            expect(service.parseLlmResponse('EPAM/BH/Sprint 2')).toBe('EPAM/BH/Sprint 2')
        })

        test('takes first non-empty line when LLM adds explanation', () => {
            expect(service.parseLlmResponse('EPAM/BH\nBecause BH stands for Baker Hughes')).toBe(
                'EPAM/BH'
            )
        })

        test('strips backticks', () => {
            expect(service.parseLlmResponse('`EPAM/BH`')).toBe('EPAM/BH')
        })

        test('strips quotes', () => {
            expect(service.parseLlmResponse('"EPAM/BH"')).toBe('EPAM/BH')
        })

        test('strips leading/trailing slashes', () => {
            expect(service.parseLlmResponse('/EPAM/BH/')).toBe('EPAM/BH')
        })

        test('returns null for empty response', () => {
            expect(service.parseLlmResponse('')).toBeNull()
            expect(service.parseLlmResponse('   \n  ')).toBeNull()
        })

        test('returns null for response over 300 chars', () => {
            expect(service.parseLlmResponse('a'.repeat(301))).toBeNull()
        })

        test('trims surrounding whitespace', () => {
            expect(service.parseLlmResponse('  EPAM/BH  ')).toBe('EPAM/BH')
        })
    })

    // ─── resolveDestination ───────────────────────────────────────────────────

    describe('resolveDestination', () => {
        test('uses basePath/filename when folder exists', async () => {
            const folderMock = { path: 'invoices' }
            mockGetAbstractFileByPath.mockImplementation((p: string) => {
                if (p === 'invoices') return folderMock
                return null
            })

            const sourceFile = createMockFile('inbox/photo.png', 'png')
            const { path, createdFolders } = await service.resolveDestination(
                'invoices',
                'photo.md',
                sourceFile
            )

            expect(path).toBe('invoices/photo.md')
            expect(createdFolders).toBe(false)
        })

        test('creates missing folders and returns createdFolders: true', async () => {
            mockGetAbstractFileByPath.mockReturnValue(null)

            const sourceFile = createMockFile('inbox/photo.png', 'png')
            const { path, createdFolders } = await service.resolveDestination(
                'Clients/Acme',
                'invoice.md',
                sourceFile
            )

            expect(path).toBe('Clients/Acme/invoice.md')
            expect(createdFolders).toBe(true)
            expect(mockCreateFolder).toHaveBeenCalledTimes(2)
        })

        test('appends counter when destination file already exists', async () => {
            const existingFile = createMockFile('invoices/photo.md', 'md')
            const folderMock = { path: 'invoices' }
            mockGetAbstractFileByPath.mockImplementation((p: string) => {
                if (p === 'invoices') return folderMock
                if (p === 'invoices/photo.md') return existingFile
                return null
            })

            const sourceFile = createMockFile('inbox/photo.png', 'png')
            const { path } = await service.resolveDestination('invoices', 'photo.md', sourceFile)

            expect(path).toBe('invoices/photo (1).md')
        })

        test('increments counter until free slot found', async () => {
            const folderMock = { path: 'dest' }
            mockGetAbstractFileByPath.mockImplementation((p: string) => {
                if (p === 'dest') return folderMock
                if (p === 'dest/note.md') return createMockFile('dest/note.md', 'md')
                if (p === 'dest/note (1).md') return createMockFile('dest/note (1).md', 'md')
                return null
            })

            const sourceFile = createMockFile('inbox/note.png', 'png')
            const { path } = await service.resolveDestination('dest', 'note.md', sourceFile)

            expect(path).toBe('dest/note (2).md')
        })

        test('falls back to source parent when basePath is empty', async () => {
            mockGetAbstractFileByPath.mockReturnValue(null)

            const sourceFile = createMockFile('inbox/photo.png', 'png', 'inbox')
            const { path } = await service.resolveDestination('', 'photo.md', sourceFile)

            expect(path).toBe('inbox/photo.md')
        })
    })

    // ─── processAfterTranscription ────────────────────────────────────────────

    describe('processAfterTranscription', () => {
        test('returns null when autoFilingEnabled is false', async () => {
            settings.autoFilingEnabled = false
            const outputFile = createMockFile('inbox/photo.md', 'md', 'inbox')
            const sourceFile = createMockFile('inbox/photo.png', 'png', 'inbox')
            const result = await service.processAfterTranscription(outputFile, sourceFile)
            expect(result).toBeNull()
        })

        test('files to inbox when no tags found (no LLM call)', async () => {
            mockRead.mockResolvedValue('No tags here\nJust content')
            mockGetAbstractFileByPath.mockReturnValue(null)

            const outputFile = createMockFile('inbox/photo.md', 'md', 'inbox')
            const sourceFile = createMockFile('inbox/photo.png', 'png', 'inbox')
            const result = await service.processAfterTranscription(outputFile, sourceFile)

            expect(result).not.toBeNull()
            expect(result!.status).toBe('Defaulted')
            expect(result!.triggerTags).toBe('None')
            expect(mockClassifyText).not.toHaveBeenCalled()
        })

        test('calls LLM when tags are present and uses returned path', async () => {
            mockRead.mockResolvedValue('#client: BH\n#folder: Sprint 2\nContent body')
            mockClassifyText.mockResolvedValue('EPAM/BH/Sprint 2')
            mockGetAbstractFileByPath.mockReturnValue(null)

            const outputFile = createMockFile('inbox/photo.md', 'md', 'inbox')
            const sourceFile = createMockFile('inbox/photo.png', 'png', 'inbox')
            const result = await service.processAfterTranscription(outputFile, sourceFile)

            expect(mockClassifyText).toHaveBeenCalledTimes(1)
            expect(result).not.toBeNull()
            expect(result!.destinationPath).toBe('EPAM/BH/Sprint 2/photo.md')
            expect(result!.status).toBe('Created Folder')
        })

        test('cleans tags from markdown when filing succeeds', async () => {
            mockRead.mockResolvedValue('#client: BH\n#folder: Sprint 2\nContent body')
            mockClassifyText.mockResolvedValue('EPAM/BH/Sprint 2')
            mockGetAbstractFileByPath.mockReturnValue(null)

            const outputFile = createMockFile('inbox/photo.md', 'md', 'inbox')
            const sourceFile = createMockFile('inbox/photo.png', 'png', 'inbox')
            await service.processAfterTranscription(outputFile, sourceFile)

            const createdContent = (mockCreate.mock.calls[0] as [string, string])[1] ?? ''
            expect(createdContent).not.toContain('#client:')
            expect(createdContent).not.toContain('#folder:')
            expect(createdContent).toContain('Content body')
        })

        test('does not clean markdown when defaulted to inbox', async () => {
            mockRead.mockResolvedValue('Plain content\nNo tags')
            mockGetAbstractFileByPath.mockReturnValue(null)

            const outputFile = createMockFile('inbox/photo.md', 'md', 'inbox')
            const sourceFile = createMockFile('inbox/photo.png', 'png', 'inbox')
            await service.processAfterTranscription(outputFile, sourceFile)

            const createdContent = (mockCreate.mock.calls[0] as [string, string])[1] ?? ''
            expect(createdContent).toBe('Plain content\nNo tags')
        })

        test('falls back to inbox when LLM call fails', async () => {
            mockRead.mockResolvedValue('#client: BH\nContent')
            mockClassifyText.mockRejectedValue(new Error('LLM unavailable'))
            mockGetAbstractFileByPath.mockReturnValue(null)

            const outputFile = createMockFile('inbox/photo.md', 'md', 'inbox')
            const sourceFile = createMockFile('inbox/photo.png', 'png', 'inbox')
            const result = await service.processAfterTranscription(outputFile, sourceFile)

            expect(result).not.toBeNull()
            expect(result!.destinationPath).toBe('Inbox/photo.md')
            expect(result!.status).toBe('Defaulted')
        })

        test('falls back to inbox when LLM returns unparseable response', async () => {
            mockRead.mockResolvedValue('#client: BH\nContent')
            mockClassifyText.mockResolvedValue('')
            mockGetAbstractFileByPath.mockReturnValue(null)

            const outputFile = createMockFile('inbox/photo.md', 'md', 'inbox')
            const sourceFile = createMockFile('inbox/photo.png', 'png', 'inbox')
            const result = await service.processAfterTranscription(outputFile, sourceFile)

            expect(result!.destinationPath).toBe('Inbox/photo.md')
        })

        test('trashes source output file after successful move', async () => {
            mockRead.mockResolvedValue('#client: BH\nContent')
            mockClassifyText.mockResolvedValue('EPAM/BH')
            mockGetAbstractFileByPath.mockReturnValue(null)

            const outputFile = createMockFile('inbox/photo.md', 'md', 'inbox')
            const sourceFile = createMockFile('inbox/photo.png', 'png', 'inbox')
            await service.processAfterTranscription(outputFile, sourceFile)

            expect(mockTrashFile).toHaveBeenCalledWith(outputFile)
        })

        test('does not trash file when destination equals source path', async () => {
            mockRead.mockResolvedValue('#folder: inbox\nContent')
            mockClassifyText.mockResolvedValue('inbox')
            const folderMock = { path: 'inbox' }
            mockGetAbstractFileByPath.mockImplementation((p: string) => {
                if (p === 'inbox') return folderMock
                return null
            })

            // outputFile is already at inbox/photo.md, LLM returns inbox → same path
            const outputFile = createMockFile('inbox/photo.md', 'md', 'inbox')
            const sourceFile = createMockFile('inbox/photo.png', 'png', 'inbox')
            await service.processAfterTranscription(outputFile, sourceFile)

            expect(mockTrashFile).not.toHaveBeenCalled()
        })

        test('returns null and does not throw on unexpected error', async () => {
            mockRead.mockRejectedValue(new Error('Read failed'))
            const outputFile = createMockFile('inbox/photo.md', 'md', 'inbox')
            const sourceFile = createMockFile('inbox/photo.png', 'png', 'inbox')
            const result = await service.processAfterTranscription(outputFile, sourceFile)
            expect(result).toBeNull()
        })

        test('log entry contains correct tag metadata', async () => {
            mockRead.mockResolvedValue('#client: Acme\n#folder: Web\nContent')
            mockClassifyText.mockResolvedValue('Clients/Acme/Web')
            mockGetAbstractFileByPath.mockReturnValue(null)

            const outputFile = createMockFile('inbox/receipt.md', 'md', 'inbox')
            const sourceFile = createMockFile('inbox/receipt.png', 'png', 'inbox')
            const result = await service.processAfterTranscription(outputFile, sourceFile)

            expect(result).not.toBeNull()
            expect(result!.filename).toBe('receipt.md')
            expect(result!.sourcePath).toBe('inbox/receipt.png')
            expect(result!.triggerTags).toContain('client:Acme')
            expect(result!.triggerTags).toContain('folder:Web')
        })

        test('LLM receives vault folder list and tags in prompt', async () => {
            const mockFolder = Object.create(TFolder.prototype) as TFolder & Record<string, unknown>
            mockFolder['path'] = 'EPAM/BH'
            mockFolder['name'] = 'BH'
            mockFolder['children'] = []
            mockGetAllLoadedFiles.mockReturnValue([mockFolder])

            mockRead.mockResolvedValue('#client: BH\nContent')
            mockClassifyText.mockResolvedValue('EPAM/BH')
            mockGetAbstractFileByPath.mockReturnValue(null)

            const outputFile = createMockFile('inbox/photo.md', 'md', 'inbox')
            const sourceFile = createMockFile('inbox/photo.png', 'png', 'inbox')
            await service.processAfterTranscription(outputFile, sourceFile)

            const promptArg = (mockClassifyText.mock.calls[0] as [string, string])[0] ?? ''
            expect(promptArg).toContain('EPAM/BH')
            expect(promptArg).toContain('#client: BH')
        })
    })
})
