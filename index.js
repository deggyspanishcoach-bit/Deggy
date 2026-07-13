// Word of the Day bot
// Generates a Mexican Spanish word/slang entry via Claude API,
// then posts it to a Discord thread/channel.

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

if (!ANTHROPIC_API_KEY || !DISCORD_BOT_TOKEN || !DISCORD_CHANNEL_ID) {
  console.error("Missing required environment variables.");
  process.exit(1);
}

function getTodayFormatted() {
  const today = new Date();
  return today.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

async function generateWordOfTheDay() {
  const todayStr = getTodayFormatted();

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
- Do not repeat words that are extremely commonly used as example words of the day (like "chido", "neta", "wey", "no manches" -- unless specifically instructed) -- vary selection across obscure Mexican slang, regional terms, food/cultural vocabulary, and everyday expressions.
- Output ONLY the formatted entry. No preamble, no explanation of your choice, nothing else.`;

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
    const entry = await generateWordOfTheDay();
    console.log("Generated entry:\n", entry);
    await postToDiscord(entry);
  } catch (err) {
    console.error("Failed:", err.message);
    process.exit(1);
  }
})();
