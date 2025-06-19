# Multilingual Word of the Day

Fetches and embeds the Word of the Day in **English**, **Spanish**, and **Portuguese** into your Obsidian vault—either on demand or automatically in each new daily note.

---

## Features

- **On-demand:** Run the “Fetch Words of the Day (English, Spanish, Portuguese)” command from the Command Palette.  
- **Auto-append:** Whenever a new daily note is created, the plugin automatically injects the three words (with definitions/translations) under a blockquote.  
- **Clean formatting:** Outputs in an Obsidian-friendly blockquote with language headings.

---

## Requirements

- **Obsidian** v0.12.0 or later  
- **Daily Notes** core plugin enabled (optional, for auto-append)

---

## Installation

1. Clone or download this repo into your vault’s plugins folder, e.g.: <your-vault>/.obsidian/plugins/wotd/
2. In Obsidian, open **Settings → Community plugins → Disabled plugins**, find **Multilingual Word of the Day**, and click **Enable**.  
3. (Optional) Ensure the **Daily Notes** core plugin is enabled under **Settings → Core plugins** if you want automatic insertion.

---

## Usage

### Fetch manually

1. Press <kbd>Ctrl</kbd>+<kbd>P</kbd> (or <kbd>Cmd</kbd>+<kbd>P</kbd>).
2. Type **Fetch Words of the Day** and hit <kbd>Enter</kbd>.
3. The plugin will fetch and append:

> [!QUOTE] Vocabulary  
>  
> **English:**  
> > **serendipity**  
> > “the occurrence and development of events by chance in a happy or beneficial way.”  
>  
> **Spanish:**  
> > **albricias**  
> > Translation: “joy or surprise at someone’s good fortune.”  
>  
> **Portuguese:**  
> > **saudade**  
> > Translation: “a feeling of longing, melancholy, or nostalgia.”

### Auto-append on new daily notes

Whenever you create a new daily note (by default in your configured Daily Notes folder with your chosen date format), the plugin runs automatically and appends the same blockquote to the bottom of the note.

---

## Configuration

_No user-configurable options at the moment._  
All proxy URLs and target endpoints are hard-coded inside the plugin. You can edit:
- `fetchEnglishWordOfTheDay` → proxy and Merriam-Webster URL  
- `fetchSpanishWordOfTheDay` → proxy and LexisRex Spanish URL  
- `fetchPortugueseWordOfTheDay` → proxy and LexisRex Portuguese URL  

---

## Development

1. Make your changes in `main.js`.  
2. Reload Obsidian (or use **Reload plugins** in Community plugins settings).  
3. Check the console (`Ctrl`+`Shift`+`I`) for logging:  
- On load: `Loading Word of the Day Plugin`  
- On unload: `Unloading Word of the Day Plugin`

---

## Changelog

- **v0.1.4**  
- Initial release with English, Spanish & Portuguese support.  

---

## License

MIT © arenkis  
(See [LICENSE](LICENSE) for details.)
