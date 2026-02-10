// deploy-commands.js (FULL) — ALL commands (Site-89)
require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  throw new Error("Missing env vars: TOKEN, CLIENT_ID, GUILD_ID (set these in Railway Variables).");
}

const commands = [
  // ===== Utility =====
  new SlashCommandBuilder().setName("help").setDescription("Show all bot commands."),
  new SlashCommandBuilder().setName("status").setDescription("Show bot status (everyone)."),
  new SlashCommandBuilder().setName("serverinfo").setDescription("Show server information."),

  // ===== Comms =====
  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send an announcement embed (Level-4+).")
    .addStringOption((opt) =>
      opt.setName("message").setDescription("Announcement text").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("intercom")
    .setDescription("Send an intercom broadcast embed (Level-4+).")
    .addStringOption((opt) =>
      opt.setName("message").setDescription("Intercom text").setRequired(true)
    ),

  // ===== Roles =====
  new SlashCommandBuilder()
    .setName("addrole")
    .setDescription("Add a role to a user (Manage Roles).")
    .addUserOption((opt) => opt.setName("user").setDescription("User").setRequired(true))
    .addRoleOption((opt) => opt.setName("role").setDescription("Role").setRequired(true)),

  new SlashCommandBuilder()
    .setName("removerole")
    .setDescription("Remove a role from a user (Manage Roles).")
    .addUserOption((opt) => opt.setName("user").setDescription("User").setRequired(true))
    .addRoleOption((opt) => opt.setName("role").setDescription("Role").setRequired(true)),

  // ===== Moderation =====
  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user (Kick Members).")
    .addUserOption((opt) => opt.setName("user").setDescription("User").setRequired(true))
    .addStringOption((opt) => opt.setName("reason").setDescription("Reason").setRequired(false)),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user (Ban Members).")
    .addUserOption((opt) => opt.setName("user").setDescription("User").setRequired(true))
    .addStringOption((opt) => opt.setName("reason").setDescription("Reason").setRequired(false))
    .addIntegerOption((opt) =>
      opt
        .setName("delete_days")
        .setDescription("Delete message history (0-7 days)")
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout a user (Moderate Members).")
    .addUserOption((opt) => opt.setName("user").setDescription("User").setRequired(true))
    .addIntegerOption((opt) =>
      opt
        .setName("minutes")
        .setDescription("Minutes (1-40320)")
        .setMinValue(1)
        .setMaxValue(40320)
        .setRequired(true)
    )
    .addStringOption((opt) => opt.setName("reason").setDescription("Reason").setRequired(false)),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove timeout from a user (Moderate Members).")
    .addUserOption((opt) => opt.setName("user").setDescription("User").setRequired(true))
    .addStringOption((opt) => opt.setName("reason").setDescription("Reason").setRequired(false)),

  // ===== Warnings =====
  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a user (Moderate Members).")
    .addUserOption((opt) => opt.setName("user").setDescription("User").setRequired(true))
    .addStringOption((opt) => opt.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("View warnings for a user (Moderate Members).")
    .addUserOption((opt) => opt.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove a warning by ID (Moderate Members).")
    .addUserOption((opt) => opt.setName("user").setDescription("User").setRequired(true))
    .addIntegerOption((opt) => opt.setName("warn_id").setDescription("Warning ID").setRequired(true)),

  new SlashCommandBuilder()
    .setName("editwarn")
    .setDescription("Edit a warning reason by ID (Moderate Members).")
    .addUserOption((opt) => opt.setName("user").setDescription("User").setRequired(true))
    .addIntegerOption((opt) => opt.setName("warn_id").setDescription("Warning ID").setRequired(true))
    .addStringOption((opt) => opt.setName("reason").setDescription("New reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("clearwarns")
    .setDescription("Clear ALL warnings for a user (Moderate Members).")
    .addUserOption((opt) => opt.setName("user").setDescription("User").setRequired(true)),

  // ===== Lockdown =====
  new SlashCommandBuilder()
    .setName("lockdown")
    .setDescription("Lock specified channels (Manage Channels).")
    .addStringOption((opt) => opt.setName("reason").setDescription("Reason").setRequired(false)),

  new SlashCommandBuilder()
    .setName("unlockdown")
    .setDescription("Unlock specified channels (Manage Channels).")
    .addStringOption((opt) => opt.setName("reason").setDescription("Reason").setRequired(false)),

  // ===== SSU System =====
  new SlashCommandBuilder().setName("ssu").setDescription("Post SSU join instructions + ping SSU role (Allowed role)."),
  new SlashCommandBuilder().setName("ssd").setDescription("Post SSD shutdown message (Allowed role)."),
  new SlashCommandBuilder().setName("ssupoll").setDescription("Post an SSU poll (Allowed role)."),
  new SlashCommandBuilder().setName("ssubeg").setDescription("Request an SSU (everyone) and ping SSU beg role."),
  new SlashCommandBuilder().setName("ssurevive").setDescription("Ping SSU revive role (everyone)."),
  new SlashCommandBuilder().setName("ssutakeover").setDescription("Edit last SSU embed to show you as host (Allowed role)."),
].map((c) => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    console.log("🚀 Deploying slash commands...");
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log("✅ Slash commands deployed successfully!");
  } catch (err) {
    console.error("❌ Deploy failed:", err);
  }
})();