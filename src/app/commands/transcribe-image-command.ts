import { Notice, TFile } from 'obsidian'
import type { TranscriberPlugin } from '../plugin'

export function createTranscribeImageCommand(plugin: TranscriberPlugin): {
    id: string
    name: string
    checkCallback: (checking: boolean) => boolean | void
} {
    return {
        id: 'transcribe-current-image',
        name: 'Transcribe current image',
        checkCallback(checking: boolean): boolean | void {
            const activeFile = plugin.app.workspace.getActiveFile()

            if (!activeFile || !plugin.transcriptionService.isImageFile(activeFile)) {
                return false
            }

            if (checking) {
                return true
            }

            void (async () => {
                new Notice(`Transcribing ${activeFile.name}...`)
                const result = await plugin.transcriptionService.transcribeFile(activeFile)

                if (result.success) {
                    if (!plugin.settings.autoFilingEnabled) {
                        new Notice(`Transcribed ${activeFile.name} successfully`)
                    } else {
                        const outputFile = plugin.app.vault.getAbstractFileByPath(result.outputFile)
                        if (!(outputFile instanceof TFile)) {
                            new Notice(
                                `Transcribed ${activeFile.name} (auto-filing: output file not found at ${result.outputFile})`
                            )
                        } else {
                            const logEntry = await plugin.filingService.processAfterTranscription(
                                outputFile,
                                activeFile
                            )
                            if (logEntry) {
                                await plugin.filingLogger.logEntry(logEntry)
                                plugin.showFilingNotice(activeFile.name, logEntry.destinationPath)
                            } else {
                                new Notice(
                                    `Transcribed ${activeFile.name} (auto-filing did not run — check the developer console)`
                                )
                            }
                        }
                    }
                } else {
                    new Notice(`Failed to transcribe ${activeFile.name}: ${result.error}`)
                }
            })()
        }
    }
}
