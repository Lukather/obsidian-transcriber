import { Notice, TFile, TFolder, type App } from 'obsidian'
import type { TranscriberPlugin } from '../plugin'
import { ProgressNotice } from '../ui/progress-notice'
import { log } from '../../utils/log'

// Type for Notebook Navigator API menus context
type NnFileMenuContext = {
    addItem: (callback: (item: NnMenuItem) => void) => void
    file: TFile
    selection: {
        mode: 'single' | 'multiple'
        files: TFile[]
    }
}

type NnFolderMenuContext = {
    addItem: (callback: (item: NnMenuItem) => void) => void
    folder: TFolder
}

type NnMenuItem = {
    setTitle: (title: string) => NnMenuItem
    setIcon: (icon: string) => NnMenuItem
    onClick: (callback: () => void) => NnMenuItem
}

type NnMenusAPI = {
    registerFileMenu: (callback: (context: NnFileMenuContext) => void) => () => void
    registerFolderMenu: (callback: (context: NnFolderMenuContext) => void) => () => void
}

type NnAPI = {
    menus: NnMenusAPI
    getVersion: () => string
}

// Minimum API version required for file/folder menus
const MIN_API_VERSION = '1.2.0'
const [MIN_MAJOR, MIN_MINOR] = MIN_API_VERSION.split('.').map(Number) as [number, number]

/**
 * Helper to check if Notebook Navigator API is available and meets version requirements
 */
function getNnApi(
    app: App | { plugins: { plugins: Record<string, { api?: unknown }> } }
): NnAPI | null {
    const plugin = (app as unknown as { plugins: { plugins: Record<string, { api?: unknown }> } })
        .plugins.plugins['notebook-navigator']
    if (!plugin?.api) {
        return null
    }

    const api = plugin.api as NnAPI

    // Check if menus object exists
    if (!api.menus) {
        return null
    }

    // Check API version if available
    const version = api.getVersion?.()
    if (version) {
        const [major, minor] = version.split('.').map(Number) as [
            number | undefined,
            number | undefined
        ]

        const actualMajor = major ?? 0
        const actualMinor = minor ?? 0

        if (actualMajor < MIN_MAJOR || (actualMajor === MIN_MAJOR && actualMinor < MIN_MINOR)) {
            return null
        }
    }

    return api
}

/**
 * Transcribe a single file and show notice
 */
async function transcribeFileWithNotice(plugin: TranscriberPlugin, file: TFile): Promise<void> {
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
 * Transcribe all images in a folder with progress
 */
async function transcribeFolderWithProgress(
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

/**
 * Register Notebook Navigator menu items for obsidian-transcriber
 * Returns cleanup function to unregister menus, or null if NN is not available
 */
export function registerNnMenus(plugin: TranscriberPlugin): (() => void) | null {
    const nn = getNnApi(plugin.app)
    if (!nn) {
        return null
    }

    const cleanupFns: Array<() => void> = []

    // Register file menu item
    const disposeFile = nn.menus.registerFileMenu(({ addItem, file, selection }) => {
        // Only show for single file selection
        if (selection.mode !== 'single') {
            return
        }

        // Only show for image files
        if (!plugin.transcriptionService.isImageFile(file)) {
            return
        }

        addItem((item) => {
            item.setTitle('Transcribe image')
                .setIcon('file-text')
                .onClick(() => {
                    transcribeFileWithNotice(plugin, file).catch((err) => {
                        log(
                            `Unexpected error during transcription: ${err instanceof Error ? err.message : String(err)}`,
                            'error'
                        )
                        new Notice(
                            `Transcription error: ${err instanceof Error ? err.message : 'Unknown error'}`
                        )
                    })
                })
        })
    })
    cleanupFns.push(disposeFile)

    // Register folder menu item
    const disposeFolder = nn.menus.registerFolderMenu(({ addItem, folder }) => {
        addItem((item) => {
            item.setTitle('Transcribe all images in folder')
                .setIcon('files')
                .onClick(() => {
                    transcribeFolderWithProgress(plugin, folder).catch((err) => {
                        log(
                            `Unexpected error during folder transcription: ${err instanceof Error ? err.message : String(err)}`,
                            'error'
                        )
                        new Notice(
                            `Transcription error: ${err instanceof Error ? err.message : 'Unknown error'}`
                        )
                    })
                })
        })
    })
    cleanupFns.push(disposeFolder)

    // Return cleanup function
    return () => {
        for (const cleanup of cleanupFns) {
            cleanup()
        }
    }
}
