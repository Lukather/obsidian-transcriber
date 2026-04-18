import { TFile } from 'obsidian'
import type { App } from 'obsidian'
import type { LogEntry } from '../types/filing-settings.intf'
import { log } from '../../utils/log'

export class FilingLogger {
    private readonly app: App
    private readonly getLogNotePath: () => string

    private static readonly LOG_HEADER =
        '| Timestamp | Filename | Source Path | Destination Path | Trigger | Status |\n' +
        '|------------|----------|-------------|------------------|----------|--------|'

    constructor(app: App, getLogNotePath: () => string) {
        this.app = app
        this.getLogNotePath = getLogNotePath
    }

    private async ensureLogNoteExists(): Promise<TFile> {
        const logPathStr = this.getLogNotePath()
        let logFile = this.app.vault.getAbstractFileByPath(logPathStr)

        if (!logFile) {
            const file = await this.app.vault.create(
                logPathStr,
                `# Auto-Filing Log\n\n` + FilingLogger.LOG_HEADER
            )
            log(`Created filing log note at: ${logPathStr}`, 'debug')
            if (!(file instanceof TFile)) {
                throw new Error('Failed to create log file')
            }
            return file
        }

        if (!(logFile instanceof TFile)) {
            throw new Error(`Log path ${logPathStr} exists but is not a file`)
        }

        const contentStr = await this.app.vault.read(logFile)
        if (!contentStr.includes(FilingLogger.LOG_HEADER)) {
            await this.app.vault.modify(logFile, `${contentStr}\n\n${FilingLogger.LOG_HEADER}`)
        }

        return logFile
    }

    private formatLogRow(entry: LogEntry): string {
        const timestamp = entry.timestamp ?? ''
        const filename = this.escapeMarkdown(entry.filename ?? '')
        const sourcePath = this.escapeMarkdown(entry.sourcePath ?? '')
        const destinationPath = this.escapeMarkdown(entry.destinationPath ?? '')
        const trigger = this.escapeMarkdown(entry.triggerTags ?? '')
        const status = entry.status ?? ''

        return `| ${timestamp} | ${filename} | ${sourcePath} | ${destinationPath} | ${trigger} | ${status} |`
    }

    private escapeMarkdown(text: string): string {
        return text
            .replace(/\\/g, '\\\\')
            .replace(/\|/g, '\\|')
            .replace(/\n/g, ' ')
            .replace(/\r/g, ' ')
    }

    async logEntry(entry: LogEntry): Promise<void> {
        try {
            const logFile = await this.ensureLogNoteExists()
            const currentContentStr = await this.app.vault.read(logFile)

            const newRowStr = this.formatLogRow(entry)
            const newContentStr = currentContentStr + '\n' + newRowStr

            await this.app.vault.modify(logFile, newContentStr)
            log('Logged filing entry', 'debug')
        } catch (error) {
            log(`Failed to log filing entry: ${String(error)}`, 'error')
            throw error
        }
    }

    async getAllEntries(): Promise<LogEntry[]> {
        try {
            const logPathStr = this.getLogNotePath()
            const logFile = this.app.vault.getAbstractFileByPath(logPathStr)

            if (!logFile || !(logFile instanceof TFile)) {
                return []
            }

            const contentStr = await this.app.vault.read(logFile)
            const lines = contentStr.split('\n')
            const entries: LogEntry[] = []

            let headerFound = false
            for (const line of lines) {
                if (line.includes('| Timestamp |')) {
                    headerFound = true
                    continue
                }
                if (
                    headerFound &&
                    line.startsWith('|') &&
                    line.includes('|') &&
                    !/^\|[-| ]+\|$/.test(line)
                ) {
                    const parsed = this.parseLogRow(line)
                    if (parsed) {
                        entries.push(parsed)
                    }
                }
            }

            return entries
        } catch (error) {
            log(`Failed to read filing log: ${String(error)}`, 'error')
            return []
        }
    }

    private parseLogRow(row: string): LogEntry | null {
        const cells = row.split('|').map((c) => c.trim())

        if (cells.length < 6) {
            return null
        }

        return {
            timestamp: cells[1] ?? '',
            filename: cells[2] ?? '',
            sourcePath: cells[3] ?? '',
            destinationPath: cells[4] ?? '',
            triggerTags: cells[5] ?? '',
            status: (cells[6] as 'Success' | 'Created Folder' | 'Defaulted' | 'Error') ?? 'Error'
        }
    }

    async clearLog(): Promise<void> {
        try {
            const logFile = await this.ensureLogNoteExists()
            const headerStr = `# Auto-Filing Log\n\n${FilingLogger.LOG_HEADER}`
            await this.app.vault.modify(logFile, headerStr)
            log('Filing log cleared', 'debug')
        } catch (error) {
            log(`Failed to clear filing log: ${String(error)}`, 'error')
            throw error
        }
    }
}
