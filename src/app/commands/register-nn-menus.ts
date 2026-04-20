import { Notice, TFile, TFolder, type App } from 'obsidian'
import type { TranscriberPlugin } from '../plugin'
import { log } from '../../utils/log'
import { transcribeFileWithNotice, transcribeFolderWithProgress } from './transcription-handlers'

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
