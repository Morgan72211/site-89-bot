// deploy-commands.js (FULL) — Site-89 bot with moderation + warns
require("dotenv").config();
const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const clearanceChoices = [
  { name: "L1", value: "L1" },
  { name: "L2", value: "L2" },
  { name: "L3", value: "L3" },
  { name: "L4", value: "L4" },
  { name: "L5", value: "L5" },
  { name: "Site Director", value: "SITE_DIRECTOR" },
];

const commands = [
  // ===== Everyone =====
  new SlashCommandBuilder().setName("help").setDescription("Show bot command list"),
  new SlashCommandBuilder().setName("status").setDescription("Show bot status (uptime, ping, memory)"),
  new SlashCommandBuilder().setName("serverinfo").setDescription("Show server information"),

  // ===== Announcements =====
  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send an announcement embed (L4+ required)")
    .addStringOption((o) => o.setName("title").setDescription("Embed title").setRequired(true))
    .addStringOption((o) => o.setName("message").setDescription("Announcement message").setRequired(true))
    .addRoleOption((o) => o.setName("ping").setDescription("Role to ping (optional)").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("intercom")
    .setDescription("Send an intercom announcement (L4+ required)")
    .addStringOption((o) => o.setName("message").setDescription("Intercom message").setRequired(true))
    .addRoleOption((o) => o.setName("ping").setDescription("Role to ping (optional)").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  // ===== Roles =====
  new SlashCommandBuilder()
    .setName("addrole")
    .setDescription("Add a role to a user")
    .addUserOption((o) => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption((o) => o.setName("role").setDescription("Role").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName("removerole")
    .setDescription("Remove a role from a user")
    .addUserOption((o) => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption((o) => o.setName("role").setDescription("Role").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  // ===== Moderation =====
  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a user (logs in warnings.json)")
    .addUserOption((o) => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("View a user's warnings")
    .addUserOption((o) => o.setName("user").setDescription("User").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove one warning by its ID")
    .addUserOption((o) => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption((o) => o.setName("warn_id").setDescription("Warning ID").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("clearwarns")
    .setDescription("Clear all warnings for a user")
    .addUserOption((o) => o.setName("user").setDescription("User").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user")
    .addUserOption((o) => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user")
    .addUserOption((o) => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason").setRequired(false))
    .addIntegerOption((o) =>
      o
        .setName("delete_days")
        .setDescription("Delete message history (0-7 days)")
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(7)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout a user (minutes)")
    .addUserOption((o) => o.setName("user").setDescription("User").setRequired(true))
    .addIntegerOption((o) =>
      o
        .setName("minutes")
        .setDescription("Minutes (1 - 40320 = 28 days)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320)
    )
    .addStringOption((o) => o.setName("reason").setDescription("Reason").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  // ===== Lockdown =====
  new SlashCommandBuilder()
    .setName("lockdown")
    .setDescription("Control Site Lockdown (L5+ required)")
    .addSubcommand((sc) => sc.setName("start").setDescription("Start Site Lockdown"))
    .addSubcommand((sc) => sc.setName("lift").setDescription("Lift Site Lockdown"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  // ===== SSU system =====
  new SlashCommandBuilder()
    .setName("ssu")
    .setDescription("Post a Server Start Up announcement (L4+ required)")
    .addRoleOption((o) => o.setName("ping").setDescription("Role to ping (optional)").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("ssd")
    .setDescription("Post a Server Shutdown announcement (L4+ required)")
    .addRoleOption((o) => o.setName("ping").setDescription("Role to ping (optional)").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("ssupoll")
    .setDescription("Post an SSU poll with buttons (L4+ required)")
    .addStringOption((o) => o.setName("question").setDescription("Poll question").setRequired(true))
    .addRoleOption((o) => o.setName("ping").setDescription("Role to ping (optional)").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  // ===== Clearance =====
  new SlashCommandBuilder()
    .setName("clearance")
    .setDescription("Manage and view SCP clearance levels")
    .addSubcommand((sc) =>
      sc
        .setName("set")
        .setDescription("Set a user's clearance level (staff only)")
        .addUserOption((o) => o.setName("user").setDescription("User").setRequired(true))
        .addStringOption((o) =>
          o.setName("level").setDescription("Clearance level").setRequired(true).addChoices(...clearanceChoices)
        )
    )
    .addSubcommand((sc) =>
      sc
        .setName("get")
        .setDescription("Check a user's clearance level")
        .addUserOption((o) => o.setName("user").setDescription("User").setRequired(true))
    )
    .addSubcommand((sc) => sc.setName("list").setDescription("List the clearance levels"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
].map((c) => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log("🚀 Deploying slash commands...");
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), {
      body: commands,
    });
    console.log("✅ Slash commands deployed!");
  } catch (err) {
    console.error("❌ Deploy error:", err);
  }
})();