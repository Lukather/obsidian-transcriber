import { Notice, TFile, TFolder } from 'obsidian'
import type { App } from 'obsidian'
import type { PluginSettings } from '../types/plugin-settings.intf'
import type { FilingTags, LogEntry } from '../types/filing-settings.intf'
import type { AiProviderService } from './ai-provider-service'
import { log } from '../../utils/log'

export class FilingService {
    private readonly app: App
    private readonly getSettings: () => PluginSettings
    private readonly getProvider: () => AiProviderService

    constructor(app: App, getSettings: () => PluginSettings, getProvider: () => AiProviderService) {
        this.app = app
        this.getSettings = getSettings
        this.getProvider = getProvider
    }

    parseTags(markdown: string, maxLines: number): FilingTags {
        const tags: FilingTags = {}
        const lines = markdown.split('\n').slice(0, maxLines)

        for (const line of lines) {
            const match = line.match(/^#(\w+):\s*(.+)$/)
            if (match && match[1] && match[2]) {
                tags[match[1]] = match[2].trim()
            }
        }

        return tags
    }

    cleanMarkdown(markdown: string, maxLines: number): string {
        const lines = markdown.split('\n')
        const linesToCheck = Math.min(maxLines, lines.length)
        const cleanedLines: string[] = []

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i] ?? ''
            if (i < linesToCheck && /^#(\w+):/.test(line)) {
                continue
            }
            cleanedLines.push(line)
        }

        return cleanedLines.join('\n')
    }

    async resolveDestination(
        basePath: string,
        filename: string,
        sourceFile: TFile
    ): Promise<{ path: string; createdFolders: boolean }> {
        const sourceParent = sourceFile.parent?.path ?? ''
        let destinationPath = basePath ? `${basePath}/${filename}` : `${sourceParent}/${filename}`
        let createdFolders = false

        if (basePath) {
            let folder = this.app.vault.getAbstractFileByPath(basePath)

            if (!folder) {
                const parts = basePath.split('/')
                let currentPath = ''

                for (const part of parts) {
                    if (!part) continue
                    currentPath = currentPath ? `${currentPath}/${part}` : part
                    folder = this.app.vault.getAbstractFileByPath(currentPath)
                    if (!folder) {
                        await this.app.vault.createFolder(currentPath)
                        createdFolders = true
                    }
                }
            }
        }

        if (this.app.vault.getAbstractFileByPath(destinationPath)) {
            const baseName = filename.replace('.md', '')
            const ext = '.md'
            let counter = 1
            let newPath: string

            do {
                newPath = basePath
                    ? `${basePath}/${baseName} (${counter})${ext}`
                    : `${sourceParent}/${baseName} (${counter})${ext}`
                counter++
            } while (this.app.vault.getAbstractFileByPath(newPath))

            destinationPath = newPath
        }

        return { path: destinationPath, createdFolders }
    }

    private getVaultFolders(): string[] {
        return this.app.vault
            .getAllLoadedFiles()
            .filter((f): f is TFolder => f instanceof TFolder)
            .map((f) => f.path)
            .filter((p) => p !== '/')
            .sort()
    }

    private buildLlmPrompt(tags: FilingTags, folders: string[]): string {
        const folderList =
            folders.length > 0 ? folders.join('\n') : '(no folders exist yet in the vault)'

        const tagList = Object.entries(tags)
            .map(([k, v]) => `#${k}: ${String(v)}`)
            .join('\n')

        return [
            'You are an Obsidian vault file organization assistant.',
            '',
            'Available folders in the vault:',
            folderList,
            '',
            'Tags extracted from the note:',
            tagList,
            '',
            'Determine the best folder path for this file.',
            'Rules:',
            '1. Match tag values semantically to existing folders (e.g. abbreviations, partial names, common aliases).',
            '2. If a subfolder from a tag should be appended under an existing one, include it.',
            '3. Return ONLY the folder path (example: EPAM/BH/Sprint 2), with no explanation.',
            '4. No leading or trailing slashes. No filename. No .md extension.'
        ].join('\n')
    }

    parseLlmResponse(response: string): string | null {
        const firstLine = response
            .split('\n')
            .map((l) => l.trim())
            .find((l) => l.length > 0)

        if (!firstLine) return null

        const cleaned = firstLine
            .replace(/^[`'"]+|[`'"]+$/g, '') // strip backticks/quotes
            .replace(/^\/|\/$/g, '') // strip leading/trailing slashes
            .trim()

        if (cleaned.length === 0 || cleaned.length > 300) return null

        return cleaned
    }

    private async resolvePathWithLlm(tags: FilingTags): Promise<string> {
        const settings = this.getSettings()

        try {
            const folders = this.getVaultFolders()
            const prompt = this.buildLlmPrompt(tags, folders)
            const modelToUse = settings.filingModel || settings.modelName
            const raw = await this.getProvider().classifyText(prompt, modelToUse)
            const path = this.parseLlmResponse(raw)

            if (path) {
                log(`LLM classified filing path: ${path}`, 'debug')
                return path
            }

            log('LLM returned unparseable response, falling back to inbox', 'warn')
        } catch (error) {
            log(`LLM classification failed: ${String(error)}, falling back to inbox`, 'warn')
        }

        return settings.inboxFolderPath
    }

    async processAfterTranscription(
        outputFile: TFile,
        sourceFile: TFile
    ): Promise<LogEntry | null> {
        const settings = this.getSettings()

        if (!settings.autoFilingEnabled) {
            return null
        }

        try {
            const markdown = await this.app.vault.read(outputFile)
            const filename = outputFile.name
            const tags = this.parseTags(markdown, settings.maxLinesToScan)

            let targetPath: string
            let isDefaulted: boolean

            if (Object.keys(tags).length === 0) {
                targetPath = settings.inboxFolderPath
                isDefaulted = true
                const preview = markdown.split('\n').slice(0, settings.maxLinesToScan).join(' | ')
                log(
                    `No tags found in first ${settings.maxLinesToScan} lines — filing to inbox. Lines scanned: "${preview}"`,
                    'warn'
                )
            } else {
                targetPath = await this.resolvePathWithLlm(tags)
                isDefaulted = targetPath === settings.inboxFolderPath
            }

            const cleanedMarkdown = isDefaulted
                ? markdown
                : this.cleanMarkdown(markdown, settings.maxLinesToScan)

            const { path: destinationPath, createdFolders } = await this.resolveDestination(
                targetPath,
                filename,
                sourceFile
            )

            const destFile = this.app.vault.getAbstractFileByPath(destinationPath)
            if (destFile instanceof TFile) {
                await this.app.vault.modify(destFile, cleanedMarkdown)
            } else {
                await this.app.vault.create(destinationPath, cleanedMarkdown)
            }

            if (outputFile.path !== destinationPath) {
                await this.app.fileManager.trashFile(outputFile)
            }

            const triggerTagsStr = isDefaulted
                ? 'None'
                : Object.entries(tags)
                      .map(([k, v]) => `${k}:${String(v)}`)
                      .join(', ')

            const status: LogEntry['status'] = isDefaulted
                ? 'Defaulted'
                : createdFolders
                  ? 'Created Folder'
                  : 'Success'

            return {
                timestamp: new Date().toISOString(),
                filename,
                sourcePath: sourceFile.path,
                destinationPath,
                triggerTags: triggerTagsStr,
                status
            }
        } catch (error) {
            log(`Error in processAfterTranscription: ${String(error)}`, 'error')
            new Notice(
                `Auto-filing error: ${error instanceof Error ? error.message : String(error)}`
            )
            return null
        }
    }
}
