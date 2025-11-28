const OpenAI = require("openai");
const fs = require("node:fs");
const path = require("node:path");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Write previews into the Next.js public folder so they are served at /previews/*
const previewsDir = path.join(__dirname, "public", "previews");

const voicePacks = [
  {
    id: "friendly-us",
    fileName: "friendly-us.mp3",
    openAIVoice: "shimmer",
    description: "Friendly (Female, US) - warm, approachable, friendly, supportive",
    text: "Hi there! I’m Aloha. I’m here to help and make every call feel friendly and easy.",
  },
  {
    id: "professional-us",
    fileName: "professional-us.mp3",
    openAIVoice: "onyx",
    description: "Professional (Male, US) - confident, clear, trustworthy, efficient",
    text: "Hello, this is Aloha. You can count on me for clear communication and reliable updates.",
  },
  {
    id: "energetic-uk",
    fileName: "energetic-uk.mp3",
    openAIVoice: "nova",
    description: "Energetic (Female, US) - lively, upbeat, enthusiastic, positive",
    text: "Hey! I’m Aloha. Let’s jump in and make things happen with energy and momentum!",
  },
  {
    id: "empathetic-neutral",
    fileName: "empathetic-neutral.mp3",
    openAIVoice: "onyx",
    description: "Empathetic (Male, Neutral) - calm, caring, reassuring, emotionally aware",
    text: "Hi, I’m Aloha. I’m here to listen, support you, and make every call feel understood.",
  },
];

async function ensurePreviewsDir() {
  await fs.promises.mkdir(previewsDir, { recursive: true });
}

async function generatePreview(voicePack) {
  console.log(
    `Generating preview for "${voicePack.id}" using OpenAI voice "${voicePack.openAIVoice}"...`
  );

  const response = await openai.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice: voicePack.openAIVoice,
    format: "mp3",
    input: voicePack.text,
  });

  const audioBuffer = Buffer.from(await response.arrayBuffer());

  const filePath = path.join(previewsDir, voicePack.fileName);
  await fs.promises.writeFile(filePath, audioBuffer);

  console.log(`Saved preview: ${filePath}`);
}

async function main() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set.");
    }

    await ensurePreviewsDir();

    for (const voicePack of voicePacks) {
      await generatePreview(voicePack);
    }

    console.log("All voice previews generated successfully.");
  } catch (error) {
    console.error("Error generating voice previews:", error);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
