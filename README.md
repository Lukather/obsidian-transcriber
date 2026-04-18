# Transcriber for Obsidian

Fork of the original Obsidian Transcriber plugin by Sébastien Dubois, with ongoing changes by Lorenzo Strambi.

An Obsidian plugin that transcribes images to Markdown using either local [Ollama](https://ollama.com/) vision models or an OpenAI-compatible endpoint.

Point it at any image in your vault and get structured Markdown back — headings, lists, tables, code blocks. You can run fully local with Ollama, or use a hosted provider when desired.

## What it does

- **Transcribe a single image** via the command palette or right-click context menu
- **Batch-transcribe an entire folder** of images (with optional subfolder inclusion)
- **Auto-file transcribed notes** into the right vault folder using LLM-based semantic classification
- **Creates a `.md` file** alongside each image with the transcribed content
- **Install, select, and remove AI models** directly from the command palette — no terminal needed
- **Choose your provider**: Ollama or OpenAI-compatible API
- **Tune model parameters** for OpenAI: temperature, top-p, and max tokens
- **Progress tracking** for batch operations with per-file status
- **Configurable prompt** so you can tailor the transcription instructions

## Auto-filing

When auto-filing is enabled, the plugin reads filing tags from the first lines of the transcription output and uses an LLM to determine the best destination folder in your vault.

**Tag format** — place these at the very top of the transcribed note (or instruct your transcription prompt to emit them):

```
#folder: EPAM/BH
#project: Sprint 2
```

The LLM receives all tags together with your vault's existing folder list and semantically resolves the target path. For example, if your vault already contains an `EPAM/BH` folder, the above tags produce `EPAM/BH/Sprint 2`. Any subfolder that doesn't exist yet is created automatically.

**Fallback**: if no tags are found or the LLM call fails, the file is moved to a configurable Inbox folder (default: `Inbox`).

**Tag stripping**: filing tag lines are removed from the note content after a successful classification.

**Filing log**: every filing action is appended to a configurable log note (default: `Auto-Filing Log`) in markdown table format.

### Auto-filing settings

| Setting            | Default                         | Description                                                         |
| ------------------ | ------------------------------- | ------------------------------------------------------------------- |
| Enable auto-filing | off                             | Master toggle                                                       |
| Inbox folder       | `Inbox`                         | Fallback destination when no tags are found or the LLM fails        |
| Filing model       | _(same as transcription model)_ | Model used for folder classification. Can be set independently.     |
| Filing log note    | `Auto-Filing Log`               | Path of the note where filing actions are logged                    |
| Max lines to scan  | `5`                             | How many lines from the top of the note are checked for filing tags |

## Recommended models

The plugin recommends these vision models for transcription:

`maternion/LightOnOCR-2:1b`, `qwen3.5:2b`, `qwen3.5:4b`, `qwen3.5:9b`, `qwen3.5:27b`, `qwen3.5:35b`

Any other Ollama vision model can be installed directly from the settings or via the Ollama CLI.

## Prerequisites

- Either:
    - [Ollama](https://ollama.com/) installed and running locally, or
    - an OpenAI-compatible API endpoint and API key
- Desktop Obsidian (this plugin is desktop-only)

## Getting started

This plugin is not yet approved by Obsidian. To install it manually:

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/Lukather/obsidian-transcriber/releases/latest)
2. Create a folder at `<vault>/.obsidian/plugins/obsidian-transcriber/` and place the three files inside
3. Open Obsidian, go to **Settings → Community plugins**, and enable **Transcriber**
4. Open **Settings → Transcriber** and choose your provider
5. Configure provider settings and click **Test**
6. Select a model (for Ollama, you can also install/remove models from the settings)
7. Right-click any image in your vault and select **Transcribe image**

## Documentation

See the [user guide](docs/README.md) for detailed usage, configuration, and troubleshooting.

## Support

This fork is maintained by **Lorenzo Strambi**.

Original plugin created by [Sébastien Dubois](https://dsebastien.net).

<a href="https://www.buymeacoffee.com/dsebastien"><img src="src/assets/buy-me-a-coffee.png" alt="Buy me a coffee" width="175"></a>

## License

MIT
