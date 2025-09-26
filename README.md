# AI-Powered Word of the Day

Generate personalized vocabulary words in any language using AI models (Claude, OpenAI, or Google Gemini). Automatically embeds words with definitions and example sentences into your Obsidian daily notes.

---

## Features

- **Multi-language support:** Add unlimited languages with customizable difficulty levels (Beginner, Intermediate, Advanced, Fluent)
- **Multiple AI providers:** Choose between Claude (Anthropic), OpenAI (ChatGPT), or Google Gemini
- **Smart difficulty scaling:** Get words appropriate to your proficiency level in each language
- **Auto-append:** Automatically adds vocabulary to new daily notes
- **Manual command:** Fetch words on-demand via Command Palette
- **Clean formatting:** Outputs in beautiful Obsidian callout blocks with definitions and example sentences
- **Duplicate prevention:** Won't add words if they already exist in the note

---

## Requirements

- **Obsidian** v0.12.0 or later  
- **Daily Notes** core plugin enabled (for auto-append functionality)
- **API Key** from your chosen AI provider (Claude, OpenAI, or Google Gemini)

---

## Installation

1. Clone or download this repo into your vault's plugins folder: 
   ```
   <your-vault>/.obsidian/plugins/wotd/
   ```
2. In Obsidian, open **Settings → Community plugins → Browse** and enable **AI Word of the Day**
3. Configure your API key and languages in the plugin settings

---

## Setup

### 1. Get an API Key

Choose your preferred AI provider and get an API key:

- **Claude**: [Anthropic Console](https://console.anthropic.com/)
- **OpenAI**: [OpenAI Platform](https://platform.openai.com/api-keys)
- **Google Gemini**: [Google AI Studio](https://makersuite.google.com/app/apikey)

### 2. Configure Settings

1. Go to **Settings → AI Word of the Day**
2. Select your AI provider from the dropdown
3. Enter your API key
4. Add/remove languages as needed
5. Set difficulty levels for each language

---

## Usage

### Automatic Mode
Words are automatically added when you:
- Create a new daily note
- Open today's daily note (if words haven't been added yet)

### Manual Mode
1. Press `Ctrl/Cmd + P` to open Command Palette
2. Type **"Word of the Day: Fetch words for all languages"**
3. Press Enter

### Example Output

> [!QUOTE] Vocabulary
> 
> **English:**
> **serendipity**
> 
> *Definition:* The occurrence of finding valuable or pleasant things by accident
> 
> *Example:* It was pure serendipity that I found this charming café while getting lost in the old town.
> 
> **Spanish:**
> **sobremesa**
> 
> *Definition:* The time spent lingering at the table after a meal, talking with family or friends
> 
> *Example:* La sobremesa del domingo duró tres horas mientras compartíamos historias y risas.
> 
> **Portuguese:**
> **desenrascar**
> 
> *Definition:* To improvise a solution to get out of trouble; to MacGyver
> 
> *Example:* Tivemos que desenrascar uma solução quando o carro quebrou no meio do nada.

---

## Configuration Options

### AI Provider Settings
- **Claude (Anthropic)**: Uses Claude 3 Haiku - fast and cost-effective
- **OpenAI**: Uses GPT-3.5 Turbo - balanced performance
- **Google Gemini**: Uses Gemini Pro - free tier available

### Language Settings
- **Add unlimited languages**: Support for any language the AI models can handle
- **Difficulty levels**: 
  - *Beginner*: Common everyday words, simple meanings
  - *Intermediate*: Less common but useful words, moderate complexity
  - *Advanced*: Sophisticated vocabulary, nuanced meanings
  - *Fluent*: Rare, literary, or highly specialized words
- **Toggle on/off**: Temporarily disable languages without removing them

---

## Tips

- **Cost optimization**: Claude Haiku and GPT-3.5 Turbo are the most cost-effective options
- **Free option**: Google Gemini offers a free tier perfect for personal use
- **Language variety**: Mix different difficulty levels across languages based on your proficiency
- **Daily practice**: Review previous days' words by searching for "Vocabulary" in your vault

---

## Development

### File Structure
```
wotd/
├── main.js         # Main plugin code
├── manifest.json   # Plugin manifest
├── styles.css      # Plugin styles (if needed)
└── README.md       # This file
```

### Building from Source
1. Clone the repository
2. Run `npm install` to install dependencies
3. Make your changes
4. Reload Obsidian or use the "Reload app without saving" command

---

## Troubleshooting

**Words not appearing automatically:**
- Ensure Daily Notes plugin is enabled
- Check that your daily note matches the configured format/folder
- Verify your API key is correctly entered

**API errors:**
- Verify your API key is valid and has credits
- Check your internet connection
- Try switching to a different AI provider

**Duplicate words:**
- The plugin checks for existing vocabulary blocks
- Delete the "> [!QUOTE] Vocabulary" section to regenerate

---

## Changelog

- **v2.0.0** - Complete rewrite with AI integration
  - Added support for Claude, OpenAI, and Google Gemini
  - Unlimited language support with difficulty levels
  - Improved settings interface
  - Better error handling and notifications

- **v1.0.0** - Initial release
  - Web scraping for English, Spanish, Portuguese
  - Auto-append to daily notes

---

## Privacy & Security

- API keys are stored locally in your vault
- No data is sent to any servers except the chosen AI provider
- All API calls are made directly from your device
- Consider API costs when configuring multiple languages

---

## Support

If you encounter issues or have feature requests:
1. Check the [Issues](https://github.com/yourusername/wotd-obsidian/issues) page
2. Create a new issue with detailed information
3. Include console logs if experiencing errors (Ctrl/Cmd + Shift + I)

---

## License

MIT © arenkis  
See [LICENSE](LICENSE) for details.

---

## Acknowledgments

- Built with ❤️ for polyglots and vocabulary enthusiasts