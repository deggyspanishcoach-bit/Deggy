// Word of the Day bot
// Generates a Mexican Spanish word/slang entry via Claude API,
// then posts it to a Discord thread/channel.
// Tracks previously used words in used-words.json to avoid repeats.

const fs = require("fs");
const path = require("path");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

const USED_WORDS_PATH = path.join(__dirname, "used-words.json");

if (!ANTHROPIC_API_KEY || !DISCORD_BOT_TOKEN || !DISCORD_CHANNEL_ID) {
  console.error("Missing required environment variables.");
  process.exit(1);
}

function loadUsedWords() {
  try {
    const raw = fs.readFileSync(USED_WORDS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function saveUsedWords(words) {
  fs.writeFileSync(USED_WORDS_PATH, JSON.stringify(words, null, 2) + "\n");
}

function extractWordFromEntry(entry) {
  const match = entry.match(/\*\*(.+?)\*\*/);
  return match ? match[1].trim() : null;
}

function getTodayFormatted() {
  const today = new Date();
  return today.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

async function generateWordOfTheDay(usedWords) {
  const todayStr = getTodayFormatted();

  const avoidList =
    usedWords.length > 0
      ? `\n\nWords already used previously — do NOT repeat any of these, pick something different:\n${usedWords.join(", ")}`
      : "";

  const systemPrompt = `You generate a "Word of the Day" post for a private Discord server focused on Mexican Spanish.

STRICT FORMAT (copy exactly, fill in brackets):

Word of the Day - ${todayStr} - **[word]**

[Brief, casual, very simple explanation of what the word/phrase means and how it's used]

English equivalent: [closest English equivalent]

[1-2 example sentences in Spanish, each followed by its English translation in parentheses]

RULES (follow strictly):
- No emojis, anywhere, ever.
- No AI-sounding language (avoid phrases like "Let's dive in", "Did you know", "Great choice", etc.)
- No closing commentary, no sign-off, no message directed at the user, no "hope this helps" type lines.
- The word/phrase must be authentic, well-researched Mexican Spanish slang, vocabulary, or a cultural term — not generic Spanish used elsewhere in the Spanish-speaking world unless it's notably common/distinct in Mexican usage.
- Keep the explanation casual and simple, like you're explaining it to a friend, not a textbook definition.
- Vary selection across obscure Mexican slang, regional terms, food/cultural vocabulary, and everyday expressions.
- Output ONLY the formatted entry. No preamble, no explanation of your choice, nothing else.${avoidList}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: "Generate today's word of the day entry.",
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const textBlock = data.content.find((block) => block.type === "text");
  if (!textBlock) {
    throw new Error("No text content returned from Claude API.");
  }
  return textBlock.text.trim();
}

async function postToDiscord(message) {
  const response = await fetch(
    `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      },
      body: JSON.stringify({ content: message }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Discord API error: ${response.status} ${errText}`);
  }

  console.log("Posted successfully.");
}

(async () => {
  try {
    const usedWords = loadUsedWords();
    const entry = await generateWordOfTheDay(usedWords);
    console.log("Generated entry:\n", entry);

    await postToDiscord(entry);

    const newWord = extractWordFromEntry(entry);
    if (newWord && !usedWords.includes(newWord)) {
      usedWords.push(newWord);
      saveUsedWords(usedWords);
      console.log(`Added "${newWord}" to used-words.json`);
    }
  } catch (err) {
    console.error("Failed:", err.message);
    process.exit(1);
  }
})();
