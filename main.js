const { Plugin, Notice, PluginSettingTab, Setting, requestUrl, moment, normalizePath } = require('obsidian');

const DEFAULT_SETTINGS = {
  provider: 'claude',
  claudeApiKey: '',
  openaiApiKey: '',
  geminiApiKey: '',
  claudeModel: 'claude-3-haiku-20240307',
  openaiModel: 'gpt-3.5-turbo',
  geminiModel: 'gemini-pro',
  availableModels: {
    claude: [],
    openai: [],
    gemini: []
  },
  autoAppend: true,
  temperature: 0.9,
  wordHistoryLimit: 100,
  wordHistory: {},
  languages: [
    { name: 'English', difficulty: 'Fluent', enabled: true },
  ]
};

module.exports = class WOTDPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new WOTDSettingsTab(this.app, this));
    this._fetchingWords = false;

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

    this.registerEvent(this.app.workspace.on("file-open", async (file) => {
      if (this.settings.autoAppend && file && this.isDailyNoteFile(file)) {
        if (this._fetchingWords) {
          return;
        }

        const content = await this.app.vault.read(file);
        if (!content.includes("> [!QUOTE] Vocabulary")) {
          this._fetchingWords = true;
          try {
            const markdownText = await this.fetchAllWordsOfTheDay();
            if (markdownText) {
              await this.appendToDailyNote(file, markdownText);
            }
          } finally {
            this._fetchingWords = false;
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

  addWordToHistory(language, word) {
    if (!this.settings.wordHistory) {
      this.settings.wordHistory = {};
    }

    if (!this.settings.wordHistory[language]) {
      this.settings.wordHistory[language] = [];
    }

    if (!this.settings.wordHistory[language].includes(word.toLowerCase())) {
      this.settings.wordHistory[language].push(word.toLowerCase());

      const limit = this.settings.wordHistoryLimit || 100;
      if (this.settings.wordHistory[language].length > limit) {
        this.settings.wordHistory[language] = this.settings.wordHistory[language].slice(-limit);
      }
    }
  }

  getWordHistory(language) {
    if (!this.settings.wordHistory || !this.settings.wordHistory[language]) {
      return [];
    }
    return this.settings.wordHistory[language];
  }

  async fetchClaudeModels() {
    try {
      const response = await requestUrl({
        url: 'https://api.anthropic.com/v1/models',
        method: 'GET',
        headers: {
          'x-api-key': this.settings.claudeApiKey,
          'anthropic-version': '2023-06-01'
        }
      });

      const models = response.json.data
        .map(model => model.id)
        .filter(id => id.includes('claude'));

      this.settings.availableModels.claude = models;
      await this.saveSettings();
      return models;
    } catch (error) {
      console.error('Failed to fetch Claude models:', error);
      new Notice('Failed to fetch Claude models. Using default.');
      return ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229'];
    }
  }

  async fetchOpenAIModels() {
    try {
      const response = await requestUrl({
        url: 'https://api.openai.com/v1/models',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.settings.openaiApiKey}`
        }
      });

      const models = response.json.data
        .map(model => model.id)
        .filter(id => id.includes('gpt'))
        .sort();

      this.settings.availableModels.openai = models;
      await this.saveSettings();
      return models;
    } catch (error) {
      console.error('Failed to fetch OpenAI models:', error);
      new Notice('Failed to fetch OpenAI models. Using default.');
      return ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'];
    }
  }

  async fetchGeminiModels() {
    try {
      const response = await requestUrl({
        url: `https://generativelanguage.googleapis.com/v1beta/models?key=${this.settings.geminiApiKey}`,
        method: 'GET'
      });

      const models = response.json.models
        .filter(model => model.supportedGenerationMethods?.includes('generateContent'))
        .map(model => model.name.replace('models/', ''));

      this.settings.availableModels.gemini = models;
      await this.saveSettings();
      return models;
    } catch (error) {
      console.error('Failed to fetch Gemini models:', error);
      new Notice('Failed to fetch Gemini models. Using default.');
      return ['gemini-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'];
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

      words.forEach(wordData => {
        this.addWordToHistory(wordData.language, wordData.word);
      });
      await this.saveSettings();

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
          model: this.settings.claudeModel || 'claude-3-haiku-20240307',
          max_tokens: 1000,
          temperature: this.settings.temperature || 0.9,
          messages: [{
            role: 'user',
            content: prompt
          }]
        })
      });

      const responseData = response.json;
      const content = responseData?.content?.[0]?.text;

      if (!content) {
        throw new Error('Invalid API response structure from Claude');
      }

      let words;
      try {
        words = JSON.parse(content);
      } catch (parseError) {
        console.error('Failed to parse Claude response as JSON:', parseError);
        console.error('Response content:', content);
        throw new Error('Received invalid JSON from Claude API');
      }

      if (!Array.isArray(words)) {
        throw new Error('Claude API response is not an array');
      }

      return words;
    } catch (error) {
      console.error('Claude API error:', error);
      new Notice('Failed to fetch words from Claude API. Please try again.');
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
          model: this.settings.openaiModel || 'gpt-3.5-turbo',
          messages: [{
            role: 'user',
            content: prompt
          }],
          max_tokens: 1000,
          temperature: this.settings.temperature || 0.9
        })
      });

      const responseData = response.json;
      const content = responseData?.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('Invalid API response structure from OpenAI');
      }

      let words;
      try {
        words = JSON.parse(content);
      } catch (parseError) {
        console.error('Failed to parse OpenAI response as JSON:', parseError);
        console.error('Response content:', content);
        throw new Error('Received invalid JSON from OpenAI API');
      }

      if (!Array.isArray(words)) {
        throw new Error('OpenAI API response is not an array');
      }

      return words;
    } catch (error) {
      console.error('OpenAI API error:', error);
      new Notice('Failed to fetch words from OpenAI API. Please try again.');
      throw error;
    }
  }

  async fetchWordsFromGemini(languages) {
    const prompt = this.buildPrompt(languages);

    try {
      const model = this.settings.geminiModel || 'gemini-pro';
      const response = await requestUrl({
        url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.settings.geminiApiKey}`,
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
            temperature: this.settings.temperature || 0.9,
            maxOutputTokens: 1000
          }
        })
      });

      const responseData = response.json;
      const content = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!content) {
        throw new Error('Invalid API response structure from Gemini');
      }

      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('No JSON array found in Gemini response:', content);
        throw new Error('Could not find JSON array in Gemini response');
      }

      let words;
      try {
        words = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error('Failed to parse Gemini response as JSON:', parseError);
        console.error('Matched content:', jsonMatch[0]);
        throw new Error('Received invalid JSON from Gemini API');
      }

      if (!Array.isArray(words)) {
        throw new Error('Gemini API response is not an array');
      }

      return words;
    } catch (error) {
      console.error('Gemini API error:', error);
      new Notice('Failed to fetch words from Gemini API. Please try again.');
      throw error;
    }
  }

  buildPrompt(languages) {
    const languageRequests = languages.map(lang => {
      const history = this.getWordHistory(lang.name);
      let request = `- ${lang.name} (${lang.difficulty} level)`;

      if (history.length > 0) {
        const recentWords = history.slice(-20).join(', ');
        request += `\n  Previously used words to AVOID: ${recentWords}`;
      }

      return request;
    }).join('\n');

    const variations = [
      {
        intro: 'Generate a word of the day for each of the following languages and difficulty levels:',
        task: 'For each language, provide:\n1. A word appropriate for the specified difficulty level\n2. A clear, concise definition\n3. An example sentence using the word',
        emphasis: 'IMPORTANT: Do NOT use any of the previously used words listed above. Generate completely new and different words.'
      },
      {
        intro: 'Please provide a vocabulary word for each language below with the specified proficiency level:',
        task: 'For each language, include:\n1. An appropriate word matching the difficulty level\n2. A concise definition\n3. A practical example sentence',
        emphasis: 'CRITICAL: Avoid all previously used words mentioned above. Choose fresh, unique vocabulary.'
      },
      {
        intro: 'Create daily vocabulary entries for these languages at the given difficulty levels:',
        task: 'Each entry should contain:\n1. A word suited to the specified difficulty\n2. A straightforward definition\n3. An illustrative example sentence',
        emphasis: 'NOTE: The words listed above have been used before. Select completely different vocabulary items.'
      },
      {
        intro: 'Supply a new vocabulary word for each of these language/difficulty combinations:',
        task: 'Provide for each:\n1. A word matching the difficulty specification\n2. A clear definition\n3. A contextual example sentence',
        emphasis: 'ESSENTIAL: Do not reuse any words from the previously used list above. Pick entirely new words.'
      }
    ];

    const variation = variations[Math.floor(Math.random() * variations.length)];

    return `${variation.intro}
${languageRequests}

${variation.task}

${variation.emphasis}

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

class WOTDSettingsTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('AI provider')
      .setDesc('Select which AI service to use for generating words')
      .addDropdown(dropdown => dropdown
        .addOption('claude', 'Claude (Anthropic)')
        .addOption('openai', 'ChatGPT (OpenAI)')
        .addOption('gemini', 'Gemini (Google)')
        .setValue(this.plugin.settings.provider)
        .onChange(async (value) => {
          this.plugin.settings.provider = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );

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

      const models = this.plugin.settings.availableModels.claude.length > 0
        ? this.plugin.settings.availableModels.claude
        : ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229'];

      new Setting(containerEl)
        .setName('Claude model')
        .setDesc('Select which Claude model to use')
        .addDropdown(dropdown => {
          models.forEach(model => dropdown.addOption(model, model));
          dropdown.setValue(this.plugin.settings.claudeModel || 'claude-3-haiku-20240307');
          dropdown.onChange(async (value) => {
            this.plugin.settings.claudeModel = value;
            await this.plugin.saveSettings();
          });
        })
        .addButton(button => button
          .setButtonText('Refresh Models')
          .setDisabled(false)
          .onClick(async () => {
            button.setDisabled(true);
            button.setButtonText('Fetching...');
            try {
              await this.plugin.fetchClaudeModels();
              new Notice('Claude models updated!');
              this.display();
            } catch (error) {
              button.setDisabled(false);
              button.setButtonText('Refresh Models');
            }
          })
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

      const models = this.plugin.settings.availableModels.openai.length > 0
        ? this.plugin.settings.availableModels.openai
        : ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'];

      new Setting(containerEl)
        .setName('OpenAI model')
        .setDesc('Select which OpenAI model to use')
        .addDropdown(dropdown => {
          models.forEach(model => dropdown.addOption(model, model));
          dropdown.setValue(this.plugin.settings.openaiModel || 'gpt-3.5-turbo');
          dropdown.onChange(async (value) => {
            this.plugin.settings.openaiModel = value;
            await this.plugin.saveSettings();
          });
        })
        .addButton(button => button
          .setButtonText('Refresh Models')
          .setDisabled(false)
          .onClick(async () => {
            button.setDisabled(true);
            button.setButtonText('Fetching...');
            try {
              await this.plugin.fetchOpenAIModels();
              new Notice('OpenAI models updated!');
              this.display();
            } catch (error) {
              button.setDisabled(false);
              button.setButtonText('Refresh Models');
            }
          })
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

      const models = this.plugin.settings.availableModels.gemini.length > 0
        ? this.plugin.settings.availableModels.gemini
        : ['gemini-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'];

      new Setting(containerEl)
        .setName('Gemini model')
        .setDesc('Select which Gemini model to use')
        .addDropdown(dropdown => {
          models.forEach(model => dropdown.addOption(model, model));
          dropdown.setValue(this.plugin.settings.geminiModel || 'gemini-pro');
          dropdown.onChange(async (value) => {
            this.plugin.settings.geminiModel = value;
            await this.plugin.saveSettings();
          });
        })
        .addButton(button => button
          .setButtonText('Refresh Models')
          .setDisabled(false)
          .onClick(async () => {
            button.setDisabled(true);
            button.setButtonText('Fetching...');
            try {
              await this.plugin.fetchGeminiModels();
              new Notice('Gemini models updated!');
              this.display();
            } catch (error) {
              button.setDisabled(false);
              button.setButtonText('Refresh Models');
            }
          })
        );
    }

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

    new Setting(containerEl)
      .setName('Temperature')
      .setDesc('Controls creativity vs consistency (0.7-1.0). Higher = more varied/creative words, Lower = more predictable')
      .addSlider(slider => slider
        .setLimits(0.7, 1.0, 0.05)
        .setValue(this.plugin.settings.temperature || 0.9)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.temperature = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('Word history limit')
      .setDesc('Maximum number of previously used words to track per language (to avoid repetition)')
      .addText(text => text
        .setPlaceholder('100')
        .setValue(String(this.plugin.settings.wordHistoryLimit || 100))
        .onChange(async (value) => {
          const numValue = parseInt(value);
          if (!isNaN(numValue) && numValue > 0) {
            this.plugin.settings.wordHistoryLimit = numValue;
            await this.plugin.saveSettings();
          }
        })
      );

    new Setting(containerEl).setName('Languages').setHeading();
    containerEl.createEl('p', {
      text: 'Configure the languages you want to learn. You can add, remove, and set difficulty levels.',
      cls: 'setting-item-description'
    });

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
            this.display();
          })
        );
    });

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
            this.display();
            new Notice(`Added ${languageName}`);
          }
        })
      );

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

    new Setting(containerEl).setName('Model information').setHeading();
    const modelInfo = containerEl.createDiv('setting-item-description');
    modelInfo.createEl('p', {
      text: 'Model selection is now configurable above for each provider. Use the "Refresh Models" button to fetch the latest available models from each API.'
    });
  }
}