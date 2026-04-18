import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { FilingLogger } from './filing-logger'
import type { LogEntry } from '../types/filing-settings.intf'
import { TFile } from 'obsidian'
import type { App } from 'obsidian'

const LOG_NOTE_PATH = 'Auto-Filing Log'

const LOG_HEADER =
    '| Timestamp | Filename | Source Path | Destination Path | Trigger | Status |\n' +
    '|------------|----------|-------------|------------------|----------|--------|'

function createMockLogFile(path: string): TFile {
    const file = Object.create(TFile.prototype) as TFile & Record<string, unknown>
    file['path'] = path
    file['name'] = path.split('/').pop() ?? path
    file['extension'] = 'md'
    return file
}

function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
    return {
        timestamp: '2026-04-18T10:00:00.000Z',
        filename: 'photo.md',
        sourcePath: 'inbox/photo.png',
        destinationPath: 'invoices/photo.md',
        triggerTags: 'folder:invoices',
        status: 'Success',
        ...overrides
    }
}

describe('FilingLogger', () => {
    let logger: FilingLogger
    let mockApp: App
    let mockGetAbstractFileByPath: ReturnType<typeof mock>
    let mockRead: ReturnType<typeof mock>
    let mockCreate: ReturnType<typeof mock>
    let mockModify: ReturnType<typeof mock>

    beforeEach(() => {
        mockGetAbstractFileByPath = mock(() => null)
        mockRead = mock(() => Promise.resolve(''))
        mockCreate = mock(() => Promise.resolve(createMockLogFile(LOG_NOTE_PATH)))
        mockModify = mock(() => Promise.resolve())

        mockApp = {
            vault: {
                getAbstractFileByPath: mockGetAbstractFileByPath,
                read: mockRead,
                create: mockCreate,
                modify: mockModify
            }
        } as unknown as App

        logger = new FilingLogger(mockApp, () => LOG_NOTE_PATH)
    })

    // ─── logEntry ─────────────────────────────────────────────────────────────

    describe('logEntry', () => {
        test('creates log note when it does not exist', async () => {
            mockGetAbstractFileByPath.mockReturnValue(null)
            mockCreate.mockImplementation((path: string, content: string) => {
                mockRead.mockResolvedValue(content)
                return Promise.resolve(createMockLogFile(path))
            })

            await logger.logEntry(makeEntry())

            expect(mockCreate).toHaveBeenCalledWith(
                LOG_NOTE_PATH,
                expect.stringContaining('# Auto-Filing Log')
            )
        })

        test('appends row to existing log note', async () => {
            const logFile = createMockLogFile(LOG_NOTE_PATH)
            mockGetAbstractFileByPath.mockReturnValue(logFile)
            const existingContent = `# Auto-Filing Log\n\n${LOG_HEADER}`
            mockRead.mockResolvedValue(existingContent)

            await logger.logEntry(makeEntry())

            const modifyCall = (mockModify.mock.calls[0] as [TFile, string]) ?? []
            const newContent = modifyCall[1] ?? ''
            expect(newContent).toContain('photo.md')
            expect(newContent).toContain('inbox/photo.png')
            expect(newContent).toContain('invoices/photo.md')
            expect(newContent).toContain('folder:invoices')
            expect(newContent).toContain('Success')
        })

        test('adds header when log note exists but has no header', async () => {
            const logFile = createMockLogFile(LOG_NOTE_PATH)
            mockGetAbstractFileByPath.mockReturnValue(logFile)
            mockRead
                .mockResolvedValueOnce('# Auto-Filing Log')
                .mockResolvedValue(`# Auto-Filing Log\n\n${LOG_HEADER}`)

            await logger.logEntry(makeEntry())

            // First modify call adds the header
            const firstModifyContent = ((mockModify.mock.calls[0] ?? []) as [TFile, string])[1]
            expect(firstModifyContent).toContain('| Timestamp |')
        })

        test('escapes pipe characters in field values', async () => {
            const logFile = createMockLogFile(LOG_NOTE_PATH)
            mockGetAbstractFileByPath.mockReturnValue(logFile)
            mockRead.mockResolvedValue(`# Auto-Filing Log\n\n${LOG_HEADER}`)

            await logger.logEntry(makeEntry({ filename: 'file|name.md' }))

            const modifyCall = (mockModify.mock.calls[0] as [TFile, string]) ?? []
            const content = modifyCall[1] ?? ''
            expect(content).toContain('file\\|name.md')
        })

        test('escapes backslashes in field values', async () => {
            const logFile = createMockLogFile(LOG_NOTE_PATH)
            mockGetAbstractFileByPath.mockReturnValue(logFile)
            mockRead.mockResolvedValue(`# Auto-Filing Log\n\n${LOG_HEADER}`)

            await logger.logEntry(makeEntry({ sourcePath: 'path\\to\\file.png' }))

            const modifyCall = (mockModify.mock.calls[0] as [TFile, string]) ?? []
            const content = modifyCall[1] ?? ''
            expect(content).toContain('path\\\\to\\\\file.png')
        })

        test('replaces newlines with spaces in field values', async () => {
            const logFile = createMockLogFile(LOG_NOTE_PATH)
            mockGetAbstractFileByPath.mockReturnValue(logFile)
            mockRead.mockResolvedValue(`# Auto-Filing Log\n\n${LOG_HEADER}`)

            await logger.logEntry(makeEntry({ triggerTags: 'tag1\ntag2' }))

            const modifyCall = (mockModify.mock.calls[0] as [TFile, string]) ?? []
            const content = modifyCall[1] ?? ''
            // No raw newlines inside a table cell
            const rowLine = content.split('\n').find((l) => l.includes('photo.md')) ?? ''
            expect(rowLine).not.toContain('\n')
        })
    })

    // ─── getAllEntries ────────────────────────────────────────────────────────

    describe('getAllEntries', () => {
        test('returns empty array when log note does not exist', async () => {
            mockGetAbstractFileByPath.mockReturnValue(null)
            const entries = await logger.getAllEntries()
            expect(entries).toEqual([])
        })

        test('returns empty array when log note has only headers', async () => {
            const logFile = createMockLogFile(LOG_NOTE_PATH)
            mockGetAbstractFileByPath.mockReturnValue(logFile)
            mockRead.mockResolvedValue(`# Auto-Filing Log\n\n${LOG_HEADER}`)

            const entries = await logger.getAllEntries()
            expect(entries).toHaveLength(0)
        })

        test('parses a single logged row', async () => {
            const logFile = createMockLogFile(LOG_NOTE_PATH)
            mockGetAbstractFileByPath.mockReturnValue(logFile)

            const row =
                '| 2026-04-18T10:00:00.000Z | photo.md | inbox/photo.png | invoices/photo.md | folder:invoices | Success |'
            mockRead.mockResolvedValue(`# Auto-Filing Log\n\n${LOG_HEADER}\n${row}`)

            const entries = await logger.getAllEntries()
            expect(entries).toHaveLength(1)
            const entry = entries[0]!
            expect(entry.timestamp).toBe('2026-04-18T10:00:00.000Z')
            expect(entry.filename).toBe('photo.md')
            expect(entry.sourcePath).toBe('inbox/photo.png')
            expect(entry.destinationPath).toBe('invoices/photo.md')
            expect(entry.triggerTags).toBe('folder:invoices')
            expect(entry.status).toBe('Success')
        })

        test('parses multiple rows', async () => {
            const logFile = createMockLogFile(LOG_NOTE_PATH)
            mockGetAbstractFileByPath.mockReturnValue(logFile)

            const row1 =
                '| 2026-04-18T10:00:00.000Z | a.md | src/a.png | dest/a.md | folder:dest | Success |'
            const row2 =
                '| 2026-04-18T11:00:00.000Z | b.md | src/b.png | dest/b.md | client:Acme | Created Folder |'
            mockRead.mockResolvedValue(`# Auto-Filing Log\n\n${LOG_HEADER}\n${row1}\n${row2}`)

            const entries = await logger.getAllEntries()
            expect(entries).toHaveLength(2)
            expect(entries[0]!.filename).toBe('a.md')
            expect(entries[1]!.status).toBe('Created Folder')
        })

        test('returns empty array on read error', async () => {
            const logFile = createMockLogFile(LOG_NOTE_PATH)
            mockGetAbstractFileByPath.mockReturnValue(logFile)
            mockRead.mockRejectedValue(new Error('Read failed'))

            const entries = await logger.getAllEntries()
            expect(entries).toEqual([])
        })
    })

    // ─── clearLog ─────────────────────────────────────────────────────────────

    describe('clearLog', () => {
        test('resets log note to header only', async () => {
            const logFile = createMockLogFile(LOG_NOTE_PATH)
            mockGetAbstractFileByPath.mockReturnValue(logFile)
            mockRead.mockResolvedValue(`# Auto-Filing Log\n\n${LOG_HEADER}\n| row1 | ... |`)

            await logger.clearLog()

            const modifyCall = (mockModify.mock.calls[0] as [TFile, string]) ?? []
            const content = modifyCall[1] ?? ''
            expect(content).toBe(`# Auto-Filing Log\n\n${LOG_HEADER}`)
        })

        test('creates log note when it does not exist', async () => {
            mockGetAbstractFileByPath.mockReturnValue(null)
            mockCreate.mockImplementation((path: string, content: string) => {
                mockRead.mockResolvedValue(content)
                return Promise.resolve(createMockLogFile(path))
            })

            await logger.clearLog()

            expect(mockCreate).toHaveBeenCalledWith(
                LOG_NOTE_PATH,
                expect.stringContaining('# Auto-Filing Log')
            )
        })
    })
})
