import { Notice, TFile, TFolder } from 'obsidian'
import type { TranscriberPlugin } from '../plugin'
import { ProgressNotice } from '../ui/progress-notice'

/**
 * Transcribe a single file and show appropriate notice based on auto-filing settings.
 * Handles both regular transcription and auto-filing flow.
 */
export async function transcribeFileWithNotice(
    plugin: TranscriberPlugin,
    file: TFile
): Promise<void> {
    const progress = new ProgressNotice(`Transcribing ${file.name}...`)
    try {
        const result = await plugin.transcriptionService.transcribeFile(file)
        progress.hide()
        if (result.success) {
            if (!plugin.settings.autoFilingEnabled) {
                new Notice(`Transcribed ${file.name} successfully`)
            } else {
                const outputFile = plugin.app.vault.getAbstractFileByPath(result.outputFile)
                if (!(outputFile instanceof TFile)) {
                    new Notice(
                        `Transcribed ${file.name} (auto-filing: output file not found at ${result.outputFile})`
                    )
                } else {
                    const logEntry = await plugin.filingService.processAfterTranscription(
                        outputFile,
                        file
                    )
                    if (logEntry) {
                        await plugin.filingLogger.logEntry(logEntry)
                        plugin.showFilingNotice(file.name, logEntry.destinationPath)
                    } else {
                        new Notice(
                            `Transcribed ${file.name} (auto-filing did not run — check the developer console)`
                        )
                    }
                }
            }
        } else {
            new Notice(`Failed to transcribe ${file.name}: ${result.error}`)
        }
    } catch (err) {
        progress.hide()
        throw err
    }
}

/**
 * Transcribe all images in a folder with progress notification.
 * Displays summary notice with counts of transcribed, skipped, and failed images.
 */
export async function transcribeFolderWithProgress(
    plugin: TranscriberPlugin,
    folder: TFolder
): Promise<void> {
    const settings = plugin.settings
    const progress = new ProgressNotice(`Scanning ${folder.name} for images...`)

    const results = await plugin.transcriptionService.transcribeFolder(
        folder,
        settings.includeSubfolders,
        (current, total, fileName) => {
            progress.update(`Transcribing (${current}/${total}): ${fileName}`)
        }
    )

    progress.hide()

    const succeeded = results.filter((r) => r.success).length
    const skipped = results.filter((r) => r.skipped).length
    const transcribed = succeeded - skipped
    const failed = results.filter((r) => !r.success).length

    if (results.length === 0) {
        new Notice(`No images found in ${folder.name}`)
    } else if (failed === 0 && skipped === 0) {
        new Notice(`Transcribed ${transcribed} image${transcribed !== 1 ? 's' : ''} successfully`)
    } else if (failed === 0) {
        new Notice(
            `Transcribed ${transcribed}, skipped ${skipped} unchanged image${skipped !== 1 ? 's' : ''}`
        )
    } else {
        new Notice(
            `Transcribed ${transcribed}, skipped ${skipped}, ${failed} failed image${failed !== 1 ? 's' : ''}`
        )
    }
}
