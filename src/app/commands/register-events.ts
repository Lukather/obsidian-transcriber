import { Notice, TFile, TFolder } from 'obsidian'
import type { Editor, MarkdownFileInfo } from 'obsidian'
import type { TranscriberPlugin } from '../plugin'
import { log } from '../../utils/log'
import { transcribeFileWithNotice, transcribeFolderWithProgress } from './transcription-handlers'

const IMAGE_EMBED_WIKILINK = /!\[\[([^\]]+)\]\]/
const IMAGE_EMBED_MARKDOWN = /!\[(?:[^\]]*)\]\(([^)]+)\)/

function resolveImageEmbedOnLine(
    plugin: TranscriberPlugin,
    line: string,
    sourcePath: string
): TFile | null {
    const wikiMatch = IMAGE_EMBED_WIKILINK.exec(line)
    const mdMatch = IMAGE_EMBED_MARKDOWN.exec(line)
    const linkPath = wikiMatch?.[1] ?? mdMatch?.[1]
    if (!linkPath) return null

    const resolved = plugin.app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath)
    if (!resolved) return null
    if (!plugin.transcriptionService.isImageFile(resolved)) return null
    return resolved
}

export function registerEvents(plugin: TranscriberPlugin): void {
    plugin.registerEvent(
        plugin.app.workspace.on('file-menu', (menu, file) => {
            if (file instanceof TFile && plugin.transcriptionService.isImageFile(file)) {
                menu.addItem((item) => {
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
            }

            if (file instanceof TFolder) {
                menu.addItem((item) => {
                    item.setTitle('Transcribe all images in folder')
                        .setIcon('files')
                        .onClick(() => {
                            transcribeFolderWithProgress(plugin, file).catch((err) => {
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
            }
        })
    )

    plugin.registerEvent(
        plugin.app.workspace.on('editor-menu', (menu, editor: Editor, info: MarkdownFileInfo) => {
            const sourceFile = info.file
            if (!sourceFile) return

            const cursor = editor.getCursor()
            const line = editor.getLine(cursor.line)
            const imageFile = resolveImageEmbedOnLine(plugin, line, sourceFile.path)

            if (imageFile) {
                menu.addItem((item) => {
                    item.setTitle('Transcribe this image')
                        .setIcon('file-text')
                        .onClick(() => {
                            transcribeFileWithNotice(plugin, imageFile).catch((err) => {
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
            }
        })
    )
}
