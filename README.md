# Transcriber for Obsidian

Fork of the original Obsidian Transcriber plugin by Sébastien Dubois, with ongoing changes by Lorenzo Strambi.

An Obsidian plugin that transcribes images to Markdown using either local [Ollama](https://ollama.com/) vision models or an OpenAI-compatible endpoint.

Point it at any image in your vault and get structured Markdown back — headings, lists, tables, code blocks. You can run fully local with Ollama, or use a hosted provider when desired.

## What it does

- **Transcribe a single image** via the command palette or right-click context menu
- **Batch-transcribe an entire folder** of images (with optional subfolder inclusion)
- **Creates a `.md` file** alongside each image with the transcribed content
- **Install, select, and remove AI models** directly from the command palette — no terminal needed
- **Choose your provider**: Ollama or OpenAI-compatible API
- **Tune model parameters** for OpenAI: temperature, top-p, and max tokens
- **Progress tracking** for batch operations with per-file status
- **Configurable prompt** so you can tailor the transcription instructions

## Recommended models

The plugin recommends these vision models for transcription:

`maternion/LightOnOCR-2:1b`, `qwen3.5:2b`, `qwen3.5:4b`, `qwen3.5:9b`, `qwen3.5:27b`, `qwen3.5:35b`

Any other Ollama vision model can be installed directly from the settings or via the Ollama CLI.

## Prerequisites

- Either:
    - [Ollama](https://ollama.com/) installed and running locally, or
    - an Infomaniak/OpenAI-compatible API endpoint and API key
- Desktop Obsidian (this plugin is desktop-only)

## Getting started

This plugin is not yet approved by Obsidian so if you want to test it you need to create
a folde in the .obsidian/plugins called obsidian-transcriber and move the file downloaded
from the release in there then open Obsidian and follow the steps:

1. Open **Settings > Transcriber** and choose your provider
2. Configure provider settings and click **Test**
3. Select a model (for Ollama, you can also install/remove models from commands/settings)
4. Right-click any image in your vault and select **Transcribe image**

## Documentation

See the [user guide](docs/README.md) for detailed usage, configuration, and troubleshooting.

## Support

This fork is maintained by **Lorenzo Strambi**.

Original plugin created by [Sébastien Dubois](https://dsebastien.net).

<a href="https://www.buymeacoffee.com/dsebastien"><img src="src/assets/buy-me-a-coffee.png" alt="Buy me a coffee" width="175"></a>

## License

MIT
