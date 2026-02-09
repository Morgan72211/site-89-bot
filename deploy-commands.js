require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID; // your bot application ID
const GUILD_ID = process.env.GUILD_ID;   // your server ID

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  throw new Error(
    "Missing env vars. Required: TOKEN, CLIENT_ID, GUILD_ID (set them in Railway Variables)."
  );
}

const commands = [
  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send an announcement embed (L4+ only).")
    .addStringOption((opt) =>
      opt
        .setName("message")
        .setDescription("What should the announcement say?")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("intercom")
    .setDescription("Send an intercom embed (L4+ only).")
    .addStringOption((opt) =>
      opt
        .setName("message")
        .setDescription("Intercom message to broadcast")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("status")
    .setDescription("Show the bot/server status (everyone)."),
].map((c) => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    console.log("🚀 Starting slash command deploy...");
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });
    console.log("✅ Slash commands deployed successfully!");
  } catch (err) {
    console.error("❌ Deploy failed:", err);
  }
})();