const { Plugin, Notice } = require('obsidian');

module.exports = class WOTDPlugin extends Plugin {
  async onload() {
    console.log('Loading Word of the Day Plugin');

    // Add a command for fetching Words of the Day
    this.addCommand({
      id: 'fetch-wotd',
      name: 'Fetch Words of the Day (English, Spanish, Portuguese)',
      callback: async () => {
        const markdownText = await this.fetchAllWordsOfTheDay();
        if (markdownText) {
          await this.appendWordsToDailyNote(markdownText);
        }
      }
    });

    this.registerEvent(this.app.vault.on("create", async (file) => {
      if (this.isDailyNoteFile(file)) {
        const markdownText = await this.fetchAllWordsOfTheDay();
        if (markdownText) {
          await this.appendToDailyNote(file, markdownText);
        }
      } else {
      }
    }));    
  }

  async onunload() {
    console.log('Unloading Word of the Day Plugin');
  }

  async fetchAllWordsOfTheDay() {
    const englishWotd = await this.fetchEnglishWordOfTheDay();
    const spanishWotd = await this.fetchSpanishWordOfTheDay();
    const portugueseWotd = await this.fetchPortugueseWordOfTheDay();

    return `> [!QUOTE] Vocabulary
  >  
  > **English:**  
  > ${this.formatWordOfTheDay(englishWotd)}  
  >  
  > **Spanish:**  
  > ${this.formatWordOfTheDay(spanishWotd)}  
  >  
  > **Portuguese:**  
  > ${this.formatWordOfTheDay(portugueseWotd)}`;
  }

  // Helper function to ensure proper formatting
  formatWordOfTheDay(wordData) {
      if (typeof wordData === "string") {
          return wordData.split("\n").map(line => `> ${line}`).join("\n");
      }
      return `> ${wordData}`; // Fallback in case it's not a string
  }


  // Fetch the English Word of the Day
  async fetchEnglishWordOfTheDay() {
    const proxyUrl = 'https://corsproxy.io/?url=';
    const targetUrl = 'https://www.merriam-webster.com/word-of-the-day/';
    const fullUrl = proxyUrl + encodeURIComponent(targetUrl);

    try {
      const response = await fetch(fullUrl);
      const html = await response.text();

      const wordMatch = html.match(/<span class="wotd-example-label">(.*?)<\/span>\s*in Context/);
      const word = wordMatch ? wordMatch[1].trim() : 'No word found';

      const definitionMatch = html.match(/<h2>What It Means<\/h2>\s*<p>(.*?)<\/p>/);
      const definition = definitionMatch ? definitionMatch[1].replace(/<.*?>/g, '').trim() : 'No definition found';

      return `**${word}**\n\n${definition}`;
    } catch (error) {
      console.error('Error fetching English Word of the Day:', error);
      return 'Error fetching English Word of the Day';
    }
  }

  // Fetch the Spanish Word of the Day from SpanishDict
  async fetchSpanishWordOfTheDay() {
    const proxyUrl = 'https://corsproxy.io/?key=7383fd1a&url=';
    const targetUrl = 'https://www.lexisrex.com/Spanish/Daily-Word';
    const fullUrl = proxyUrl + encodeURIComponent(targetUrl);

    try {
      const response = await fetch(fullUrl);
      const html = await response.text();

      const wordMatch = html.match(/<span style='color:blue;font-size:40px;font-family: "Times New Roman";'>(.*?)<\/span>/);
      const word = wordMatch ? wordMatch[1].trim() : 'No word found';

      const definitionMatch = html.match(/<font color='green' size='5' face='Times New Roman'>(.*?)<\/font>/);
      const definition = definitionMatch ? definitionMatch[1].trim() : 'No definition found';

      return `**${word}**\n\nTranslation: ${definition}`;
    } catch (error) {
      console.error('Error fetching Spanish Word of the Day:', error);
      return 'Error fetching Spanish Word of the Day';
    }
  }

  // Fetch the Portuguese Word of the Day from LexisRex
  async fetchPortugueseWordOfTheDay() {
    const proxyUrl = 'https://corsproxy.io/?url=';
    const targetUrl = 'https://www.lexisrex.com/Portuguese/Daily-Word';
    const fullUrl = proxyUrl + encodeURIComponent(targetUrl);

    try {
      const response = await fetch(fullUrl);
      const html = await response.text();

      const wordMatch = html.match(/<span style='color:blue;font-size:40px;font-family: "Times New Roman";'>(.*?)<\/span>/);
      const word = wordMatch ? wordMatch[1].trim() : 'No word found';

      const definitionMatch = html.match(/<font color='green' size='5' face='Times New Roman'>(.*?)<\/font>/);
      const definition = definitionMatch ? definitionMatch[1].trim() : 'No definition found';

      return `**${word}**\n\nTranslation: ${definition}`;
    } catch (error) {
      console.error('Error fetching Portuguese Word of the Day:', error);
      return 'Error fetching Portuguese Word of the Day';
    }
  }


  async appendToDailyNote(file, markdownText) {
    try {
      const content = await this.app.vault.read(file);
  
      // Avoid appending duplicate content
      if (content.includes("# Words of the Day")) {
        console.log("Words of the Day already added to the daily note.");
        return;
      }
  
      const updatedContent = `${content}\n\n${markdownText}`;
      await this.app.vault.modify(file, updatedContent);
    } catch (error) {
      console.error("Error appending to daily note:", error);
    }
  }
  
  isDailyNoteFile(file) {
    const dailyNotesConfig = this.app.internalPlugins.plugins["daily-notes"]?.instance?.options;
    if (!dailyNotesConfig) {
      console.log("Daily Notes plugin is not enabled or misconfigured.");
      return false;
    }
  
    const dailyNoteFolder = dailyNotesConfig.folder || "Journal";
    const dateFormat = dailyNotesConfig.format || "YYYY-MM-DD";
    const today = window.moment().format(dateFormat);
  
    const expectedPath = `${dailyNoteFolder}/${today}.md`;
    const isDailyNote = file.path === expectedPath;
  
    return isDailyNote;
  }
  
}