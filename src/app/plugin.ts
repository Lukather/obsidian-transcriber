import { Plugin, Notice } from 'obsidian'
import { DEFAULT_SETTINGS } from './types/plugin-settings.intf'
import type { PluginSettings } from './types/plugin-settings.intf'
import { TranscriberSettingTab } from './settings/settings-tab'
import { OllamaService } from './services/ollama-service'
import { OpenAiCompatibleService } from './services/openai-service'
import { TranscriptionService } from './services/transcription-service'
import { FilingService } from './services/filing-service'
import { FilingLogger } from './services/filing-logger'
import { registerCommands } from './commands/register-commands'
import { registerEvents } from './commands/register-events'
import { log } from '../utils/log'
import { produce } from 'immer'
import type { Draft } from 'immer'
import type { AiProviderService } from './services/ai-provider-service'
import type { TranscriptionCacheEntry } from './types/plugin-settings.intf'

export class TranscriberPlugin extends Plugin {
    settings: PluginSettings = { ...DEFAULT_SETTINGS }
    ollamaService!: OllamaService
    openAiService!: OpenAiCompatibleService
    transcriptionService!: TranscriptionService
    filingService!: FilingService
    filingLogger!: FilingLogger

    override async onload(): Promise<void> {
        log('Initializing', 'debug')
        await this.loadSettings()

        this.ollamaService = new OllamaService(this.settings.ollamaUrl, this.settings.modelName)
        this.openAiService = new OpenAiCompatibleService(
            this.settings.openAiBaseUrl,
            this.settings.openAiApiKey,
            this.settings.modelName,
            this.settings.temperature,
            this.settings.topP,
            this.settings.maxTokens
        )

        this.transcriptionService = new TranscriptionService(
            this.app,
            () => this.getActiveProvider(),
            () => this.settings,
            async (sourcePath: string, entry: TranscriptionCacheEntry) => {
                this.settings = produce(this.settings, (draft: Draft<PluginSettings>) => {
                    draft.transcriptionCache[sourcePath] = entry
                })
                await this.saveSettings()
            }
        )

        // Initialize filing services
        this.filingService = new FilingService(
            this.app,
            () => this.settings,
            () => this.getActiveProvider()
        )
        this.filingLogger = new FilingLogger(this.app, () => this.settings.logNotePath)

        registerCommands(this)
        registerEvents(this)

        this.addSettingTab(new TranscriberSettingTab(this.app, this))
    }

    override onunload(): void {
        // Cleanup handled by Obsidian's register* helpers
    }

    async loadSettings(): Promise<void> {
        log('Loading settings', 'debug')
        const loaded = (await this.loadData()) as Partial<PluginSettings> | null

        if (!loaded) {
            log('Using default settings', 'debug')
            this.settings = { ...DEFAULT_SETTINGS }
            return
        }

        this.settings = produce(DEFAULT_SETTINGS, (draft: Draft<PluginSettings>) => {
            if (loaded.ollamaUrl !== undefined) draft.ollamaUrl = loaded.ollamaUrl
            if (loaded.provider !== undefined) draft.provider = loaded.provider
            if (loaded.openAiBaseUrl !== undefined) draft.openAiBaseUrl = loaded.openAiBaseUrl
            if (loaded.openAiApiKey !== undefined) draft.openAiApiKey = loaded.openAiApiKey
            if (loaded.modelName !== undefined) draft.modelName = loaded.modelName
            if (loaded.transcriptionPrompt !== undefined)
                draft.transcriptionPrompt = loaded.transcriptionPrompt
            if (loaded.temperature !== undefined) draft.temperature = loaded.temperature
            if (loaded.topP !== undefined) draft.topP = loaded.topP
            if (loaded.maxTokens !== undefined) draft.maxTokens = loaded.maxTokens
            if (loaded.includeSubfolders !== undefined)
                draft.includeSubfolders = loaded.includeSubfolders
            if (loaded.overwriteExisting !== undefined)
                draft.overwriteExisting = loaded.overwriteExisting
            if (loaded.skipUnchangedImages !== undefined)
                draft.skipUnchangedImages = loaded.skipUnchangedImages
            if (loaded.transcriptionCache !== undefined)
                draft.transcriptionCache = loaded.transcriptionCache
            // Auto-filing settings
            if (loaded.autoFilingEnabled !== undefined)
                draft.autoFilingEnabled = loaded.autoFilingEnabled
            if (loaded.inboxFolderPath !== undefined) draft.inboxFolderPath = loaded.inboxFolderPath
            if (loaded.filingModel !== undefined) draft.filingModel = loaded.filingModel
            if (loaded.logNotePath !== undefined) draft.logNotePath = loaded.logNotePath
            if (loaded.maxLinesToScan !== undefined) draft.maxLinesToScan = loaded.maxLinesToScan
        })

        log('Settings loaded', 'debug', this.settings)
    }

    async saveSettings(): Promise<void> {
        log('Saving settings', 'debug', this.settings)
        await this.saveData(this.settings)
        this.ollamaService.updateConfig(this.settings.ollamaUrl, this.settings.modelName)
        this.openAiService.updateConfig(
            this.settings.openAiBaseUrl,
            this.settings.openAiApiKey,
            this.settings.modelName,
            this.settings.temperature,
            this.settings.topP,
            this.settings.maxTokens
        )
        log('Settings saved', 'debug')
    }

    showFilingNotice(filename: string, destinationPath: string): void {
        new Notice(`Filed: ${filename} → ${destinationPath}`, 5000)
    }

    getActiveProvider(): AiProviderService {
        return this.settings.provider === 'openai' ? this.openAiService : this.ollamaService
    }
}
