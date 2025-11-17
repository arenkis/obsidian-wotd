const { Plugin, Notice, PluginSettingTab, Setting, requestUrl, moment, normalizePath } = require('obsidian');

const DEFAULT_SETTINGS = {
  provider: 'claude',
  claudeApiKey: '',
  openaiApiKey: '',
  geminiApiKey: '',
  autoAppend: true,
  languages: [
    { name: 'English', difficulty: 'Fluent', enabled: true },
  ]
};

module.exports = class WOTDPlugin extends Plugin {
  async onload() {
    
    await this.loadSettings();
    
    // Add settings tab
    this.addSettingTab(new WOTDSettingsTab(this.app, this));

    // Add command for fetching Words of the Day
    this.addCommand({
      id: 'word-of-the-day-fetch',
      name: 'Fetch words for all languages',
      callback: async () => {
        const markdownText = await this.fetchAllWordsOfTheDay();
        if (markdownText) {
          await this.appendWordsToDailyNote(markdownText);
        }
      }
    });

    // Auto-add to daily notes when files are opened
    this.registerEvent(this.app.workspace.on("file-open", async (file) => {
      if (this.settings.autoAppend && file && this.isDailyNoteFile(file)) {
        const content = await this.app.vault.read(file);
        // Check if words already exist
        if (!content.includes("> [!QUOTE] Vocabulary")) {
          const markdownText = await this.fetchAllWordsOfTheDay();
          if (markdownText) {
            await this.appendToDailyNote(file, markdownText);
          }
        }
      }
    }));
  }

  async onunload() {
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  getActiveApiKey() {
    switch(this.settings.provider) {
      case 'claude':
        return this.settings.claudeApiKey;
      case 'openai':
        return this.settings.openaiApiKey;
      case 'gemini':
        return this.settings.geminiApiKey;
      default:
        return null;
    }
  }

  async fetchAllWordsOfTheDay() {
    const apiKey = this.getActiveApiKey();
    
    if (!apiKey) {
      new Notice(`Please configure your ${this.settings.provider} API key in settings`);
      return null;
    }

    const enabledLanguages = this.settings.languages.filter(lang => lang.enabled);
    
    if (enabledLanguages.length === 0) {
      new Notice('No languages enabled. Please configure in settings.');
      return null;
    }

    try {
      const words = await this.fetchWordsFromAI(enabledLanguages);
      
      if (!words || words.length === 0) {
        return null;
      }

      // Build the markdown
      let markdown = `> [!QUOTE] Vocabulary\n> `;
      
      words.forEach((wordData, index) => {
        markdown += `\n> **${wordData.language}:**\n`;
        markdown += `> **${wordData.word}**\n> \n`;
        markdown += `> *Definition:* ${wordData.definition}\n> \n`;
        markdown += `> *Example:* ${wordData.example}`;
        
        if (index < words.length - 1) {
          markdown += '\n> ';
        }
      });

      return markdown;
    } catch (error) {
      console.error('Error fetching words:', error);
      new Notice('Error fetching words. Check console for details.');
      return null;
    }
  }

  async fetchWordsFromAI(languages) {
    switch(this.settings.provider) {
      case 'claude':
        return await this.fetchWordsFromClaude(languages);
      case 'openai':
        return await this.fetchWordsFromOpenAI(languages);
      case 'gemini':
        return await this.fetchWordsFromGemini(languages);
      default:
        throw new Error('Invalid AI provider selected');
    }
  }

  async fetchWordsFromClaude(languages) {
    const prompt = this.buildPrompt(languages);
    
    try {
      const response = await requestUrl({
        url: 'https://api.anthropic.com/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.settings.claudeApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: prompt
          }]
        })
      });

      const responseData = response.json;
      const content = responseData.content[0].text;
      
      // Parse the JSON response
      const words = JSON.parse(content);
      return words;
    } catch (error) {
      console.error('Claude API error:', error);
      new Notice('Failed to fetch words from Claude API');
      throw error;
    }
  }

  async fetchWordsFromOpenAI(languages) {
    const prompt = this.buildPrompt(languages);
    
    try {
      const response = await requestUrl({
        url: 'https://api.openai.com/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.settings.openaiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{
            role: 'user',
            content: prompt
          }],
          max_tokens: 1000,
          temperature: 0.7
        })
      });

      const responseData = response.json;
      const content = responseData.choices[0].message.content;
      
      // Parse the JSON response
      const words = JSON.parse(content);
      return words;
    } catch (error) {
      console.error('OpenAI API error:', error);
      new Notice('Failed to fetch words from OpenAI API');
      throw error;
    }
  }

  async fetchWordsFromGemini(languages) {
    const prompt = this.buildPrompt(languages);
    
    try {
      const response = await requestUrl({
        url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.settings.geminiApiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000
          }
        })
      });

      const responseData = response.json;
      const content = responseData.candidates[0].content.parts[0].text;
      
      // Parse the JSON response - Gemini sometimes adds markdown formatting
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const words = JSON.parse(jsonMatch[0]);
        return words;
      } else {
        throw new Error('Could not parse Gemini response');
      }
    } catch (error) {
      console.error('Gemini API error:', error);
      new Notice('Failed to fetch words from Gemini API');
      throw error;
    }
  }

  buildPrompt(languages) {
    const languageRequests = languages.map(lang => 
      `- ${lang.name} (${lang.difficulty} level)`
    ).join('\n');

    return `Generate a word of the day for each of the following languages and difficulty levels:
${languageRequests}

For each language, provide:
1. A word appropriate for the specified difficulty level
2. A clear, concise definition
3. An example sentence using the word

Difficulty guidelines:
- Beginner: Common everyday words, simple meanings
- Intermediate: Less common but useful words, moderate complexity
- Advanced: Sophisticated vocabulary, nuanced meanings
- Fluent: Rare, literary, or highly specialized words

Return ONLY a JSON array with this exact structure (no additional text, no markdown formatting):
[
  {
    "language": "Language Name",
    "word": "the word",
    "definition": "clear definition",
    "example": "example sentence using the word"
  }
]

Make sure the words are interesting, useful, and appropriate for language learners at the specified level. Vary the types of words (nouns, verbs, adjectives, etc.) for variety.`;
  }

  async appendToDailyNote(file, markdownText) {
    try {
      const content = await this.app.vault.read(file);
      
      // Avoid duplicate content
      if (content.includes("> [!QUOTE] Vocabulary")) {
        return;
      }
      
      const updatedContent = `${content}\n\n${markdownText}`;
      await this.app.vault.process(file, (data) => {
        return updatedContent;
      });
      new Notice('Words of the Day added to daily note');
    } catch (error) {
      console.error("Error appending to daily note:", error);
      new Notice('Error adding words to daily note');
    }
  }

  async appendWordsToDailyNote(markdownText) {
    // Get today's daily note
    const dailyNotesConfig = this.app.internalPlugins.plugins["daily-notes"]?.instance?.options;
    if (!dailyNotesConfig) {
      new Notice("Daily Notes plugin is not configured.");
      return;
    }

    const dailyNoteFolder = dailyNotesConfig.folder || "Journal";
    const dateFormat = dailyNotesConfig.format || "YYYY-MM-DD";
    const today = moment().format(dateFormat);
    const expectedPath = normalizePath(`${dailyNoteFolder}/${today}.md`);
    
    let file = this.app.vault.getAbstractFileByPath(expectedPath);
    
    if (!file) {
      // Create the daily note if it doesn't exist
      try {
        file = await this.app.vault.create(expectedPath, '');
      } catch (error) {
        new Notice('Could not create daily note');
        return;
      }
    }
    
    await this.appendToDailyNote(file, markdownText);
  }

  isDailyNoteFile(file) {
    const dailyNotesConfig = this.app.internalPlugins.plugins["daily-notes"]?.instance?.options;
    if (!dailyNotesConfig) {
      return false;
    }

    const dailyNoteFolder = dailyNotesConfig.folder || "Journal";
    const dateFormat = dailyNotesConfig.format || "YYYY-MM-DD";
    const today = moment().format(dateFormat);

    const expectedPath = normalizePath(`${dailyNoteFolder}/${today}.md`);
    const isDailyNote = file.path === expectedPath;

    return isDailyNote;
  }
}

// Settings Tab
class WOTDSettingsTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    // AI Provider Selection
    new Setting(containerEl)
      .setName('AI provider')
      .setDesc('Select which AI service to use for generating words')
      .addDropdown(dropdown => dropdown
        .addOption('claude', 'Claude (Anthropic)')
        .addOption('openai', 'OpenAI (ChatGPT)')
        .addOption('gemini', 'Google Gemini')
        .setValue(this.plugin.settings.provider)
        .onChange(async (value) => {
          this.plugin.settings.provider = value;
          await this.plugin.saveSettings();
          this.display(); // Refresh to show relevant API key field
        })
      );

    // API Key Settings (show only the relevant one)
    if (this.plugin.settings.provider === 'claude') {
      new Setting(containerEl)
        .setName('Claude API key')
        .setDesc('Enter your Anthropic Claude API key')
        .addText(text => text
          .setPlaceholder('sk-ant-...')
          .setValue(this.plugin.settings.claudeApiKey)
          .onChange(async (value) => {
            this.plugin.settings.claudeApiKey = value;
            await this.plugin.saveSettings();
          })
          .inputEl.type = 'password'
        );
    } else if (this.plugin.settings.provider === 'openai') {
      new Setting(containerEl)
        .setName('OpenAI API key')
        .setDesc('Enter your OpenAI API key')
        .addText(text => text
          .setPlaceholder('sk-...')
          .setValue(this.plugin.settings.openaiApiKey)
          .onChange(async (value) => {
            this.plugin.settings.openaiApiKey = value;
            await this.plugin.saveSettings();
          })
          .inputEl.type = 'password'
        );
    } else if (this.plugin.settings.provider === 'gemini') {
      new Setting(containerEl)
        .setName('Google Gemini API key')
        .setDesc('Enter your Google Gemini API key')
        .addText(text => text
          .setPlaceholder('AIza...')
          .setValue(this.plugin.settings.geminiApiKey)
          .onChange(async (value) => {
            this.plugin.settings.geminiApiKey = value;
            await this.plugin.saveSettings();
          })
          .inputEl.type = 'password'
        );
    }

    // Auto-append Setting
    new Setting(containerEl)
      .setName('Auto-append to daily notes')
      .setDesc('Automatically add words of the day to daily notes when they are created or opened')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoAppend)
        .onChange(async (value) => {
          this.plugin.settings.autoAppend = value;
          await this.plugin.saveSettings();
        })
      );

    // Languages Section
    new Setting(containerEl).setName('Languages').setHeading();
    containerEl.createEl('p', {
      text: 'Configure the languages you want to learn. You can add, remove, and set difficulty levels.',
      cls: 'setting-item-description'
    });

    // Display existing languages
    this.plugin.settings.languages.forEach((lang, index) => {
      const langSetting = new Setting(containerEl)
        .setName(lang.name)
        .addToggle(toggle => toggle
          .setValue(lang.enabled)
          .onChange(async (value) => {
            this.plugin.settings.languages[index].enabled = value;
            await this.plugin.saveSettings();
          })
        )
        .addDropdown(dropdown => dropdown
          .addOption('Beginner', 'Beginner')
          .addOption('Intermediate', 'Intermediate')
          .addOption('Advanced', 'Advanced')
          .addOption('Fluent', 'Fluent')
          .setValue(lang.difficulty)
          .onChange(async (value) => {
            this.plugin.settings.languages[index].difficulty = value;
            await this.plugin.saveSettings();
          })
        )
        .addButton(button => button
          .setButtonText('Remove')
          .onClick(async () => {
            this.plugin.settings.languages.splice(index, 1);
            await this.plugin.saveSettings();
            this.display(); // Refresh the settings display
          })
        );
    });

    // Add new language
    new Setting(containerEl)
      .setName('Add language')
      .setDesc('Add a new language to learn')
      .addText(text => {
        text.setPlaceholder('Language name (e.g., French)');
        this.newLanguageInput = text;
      })
      .addButton(button => button
        .setButtonText('Add')
        .onClick(async () => {
          const languageName = this.newLanguageInput.getValue().trim();
          if (languageName) {
            // Check if language already exists
            const exists = this.plugin.settings.languages.some(
              lang => lang.name.toLowerCase() === languageName.toLowerCase()
            );
            
            if (exists) {
              new Notice('This language already exists');
              return;
            }

            this.plugin.settings.languages.push({
              name: languageName,
              difficulty: 'Intermediate',
              enabled: true
            });
            
            await this.plugin.saveSettings();
            this.newLanguageInput.setValue('');
            this.display(); // Refresh the settings display
            new Notice(`Added ${languageName}`);
          }
        })
      );

    // Instructions
    new Setting(containerEl).setName('Instructions').setHeading();
    const instructionsDiv = containerEl.createDiv('setting-item-description');
    const instructionsList = instructionsDiv.createEl('ul');

    const apiInstructionItem = instructionsList.createEl('li');
    apiInstructionItem.appendText('Get your ');

    if (this.plugin.settings.provider === 'claude') {
      apiInstructionItem.appendText('Claude API key from ');
      apiInstructionItem.createEl('a', {
        text: 'Anthropic Console',
        href: 'https://console.anthropic.com/'
      });
    } else if (this.plugin.settings.provider === 'openai') {
      apiInstructionItem.appendText('OpenAI API key from ');
      apiInstructionItem.createEl('a', {
        text: 'OpenAI Platform',
        href: 'https://platform.openai.com/api-keys'
      });
    } else if (this.plugin.settings.provider === 'gemini') {
      apiInstructionItem.appendText('Gemini API key from ');
      apiInstructionItem.createEl('a', {
        text: 'Google AI Studio',
        href: 'https://makersuite.google.com/app/apikey'
      });
    }

    instructionsList.createEl('li', { text: 'Toggle languages on/off using the switches' });
    instructionsList.createEl('li', { text: 'Set appropriate difficulty levels for each language' });
    instructionsList.createEl('li', { text: 'Words will automatically be added to your daily notes' });
    instructionsList.createEl('li', { text: 'Use Command Palette: "Word of the Day: Fetch words for all languages"' });

    // Model information
    new Setting(containerEl).setName('Model information').setHeading();
    const modelInfo = containerEl.createDiv('setting-item-description');
    const modelList = modelInfo.createEl('ul');

    const claudeItem = modelList.createEl('li');
    claudeItem.createEl('strong', { text: 'Claude:' });
    claudeItem.appendText(' Uses Claude 3 Haiku (fast & cost-effective)');

    const openaiItem = modelList.createEl('li');
    openaiItem.createEl('strong', { text: 'OpenAI:' });
    openaiItem.appendText(' Uses GPT-3.5 Turbo (balanced performance)');

    const geminiItem = modelList.createEl('li');
    geminiItem.createEl('strong', { text: 'Gemini:' });
    geminiItem.appendText(' Uses Gemini Pro (Google\'s latest model)');
  }
}