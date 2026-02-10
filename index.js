console.log("🚀 RUNNING INDEX VERSION: FULL-BOT-LEVEL-2026-02-09");
// index.js (FULL) — ALL commands + Level-# permission system
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const os = require("os");
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
} = require("discord.js");

// ===== REQUIRED ENV =====
if (!process.env.TOKEN) throw new Error("TOKEN env var is missing. Add TOKEN in Railway Variables.");

// ===== CONFIG (your IDs) =====
const SSU_ALLOWED_ROLE_ID = "1453309078984982706";
const SSU_PING_ROLE_ID = "1464810149288869971";
const SSUBEG_PING_ROLE_ID = "1453309078984982706";
const SSUREVIVE_ROLE_ID = "1464810232189550683";

// Lockdown channels
const LOCKDOWN_CHANNEL_IDS = [
  "1467681208359194776",
  "1467681285320478866",
  "1467681307470336001",
  "1467681330991988862",
  "1467681524181635133",
  "1467681904345219082",
  "1467681540854120531",
  "1467681638027759727",
];

// Data files
const WARNINGS_FILE = path.join(__dirname, "warnings.json");
const SSU_FILE = path.join(__dirname, "ssu.json");

// ===== JSON HELPERS =====
function loadJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, "utf8");
    return raw.trim() ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

// Ensure warnings structure exists
function ensureWarningsFile() {
  if (!fs.existsSync(WARNINGS_FILE)) saveJson(WARNINGS_FILE, { users: {} });
}
ensureWarningsFile();

// ===== LEVEL SYSTEM (Level-# roles) =====
function getHighestLevel(member) {
  if (!member?.roles?.cache) return 0;

  let highest = 0;

  for (const role of member.roles.cache.values()) {
    const name = role.name.trim();

    // Matches: "Level-4", "Level-4 | Something", "LEVEL-10", etc
    const match = name.match(/^Level-(\d+)\b/i);
    if (!match) continue;

    const lvl = Number(match[1]);
    if (Number.isFinite(lvl)) highest = Math.max(highest, lvl);
  }

  return highest;
}

function isLevelOrAbove(member, minLevel) {
  return getHighestLevel(member) >= minLevel;
}

function hasRoleId(member, roleId) {
  return member?.roles?.cache?.has(roleId) ?? false;
}

// ===== BOT =====
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

const startedAt = Date.now();
function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${d}d ${h}h ${m}m ${sec}s`;
}

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ===== MAIN HANDLER =====
client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.inGuild()) {
      return interaction.reply({ content: "❌ Use this in a server.", ephemeral: true });
    }

    const cmd = interaction.commandName;
    console.log("✅ Command received:", cmd);

    // Defer fast for Railway/Discord lag safety
    await interaction.deferReply({ ephemeral: true });

    // ===== /status =====
    if (cmd === "status") {
      const embed = new EmbedBuilder()
        .setTitle("📡 Site-89 Status")
        .setDescription("Bot is online and responding.")
        .addFields(
          { name: "Ping", value: `${client.ws.ping}ms`, inline: true },
          { name: "Uptime", value: formatUptime(Date.now() - startedAt), inline: true },
          { name: "Node", value: process.version, inline: true },
          { name: "Memory", value: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`, inline: true },
          { name: "Platform", value: `${os.platform()} ${os.arch()}`, inline: true }
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ===== /help =====
    if (cmd === "help") {
      const embed = new EmbedBuilder()
        .setTitle("🧾 Site-89 Bot Commands")
        .setDescription(
          [
            "**Comms (Level-4+)**: /announce, /intercom",
            "**Utility**: /help, /status, /serverinfo",
            "**Roles**: /addrole, /removerole",
            "**Moderation**: /kick, /ban, /timeout, /untimeout",
            "**Warnings**: /warn, /warnings, /unwarn, /editwarn, /clearwarns",
            "**Security**: /lockdown, /unlockdown",
            "**SSU**: /ssu, /ssd, /ssupoll, /ssubeg, /ssurevive, /ssutakeover",
          ].join("\n")
        )
        .setFooter({ text: 'Tip: If a command is missing, run: node deploy-commands.js' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ===== /serverinfo =====
    if (cmd === "serverinfo") {
      const g = interaction.guild;
      const embed = new EmbedBuilder()
        .setTitle("🏢 Server Info")
        .addFields(
          { name: "Name", value: g?.name ?? "Unknown", inline: true },
          { name: "Members", value: `${g?.memberCount ?? "?"}`, inline: true },
          { name: "Owner", value: `<@${g?.ownerId}>`, inline: true },
          { name: "ID", value: g?.id ?? "Unknown", inline: false }
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ===== /announce + /intercom (Level-4+) =====
    if (cmd === "announce" || cmd === "intercom") {
      if (!isLevelOrAbove(interaction.member, 4)) {
        return interaction.editReply(`❌ You must be **Level-4+** to use /${cmd}.`);
      }

      const msg = interaction.options.getString("message", true);

      const embed = new EmbedBuilder()
        .setTitle(cmd === "announce" ? "📣 Announcement" : "📢 Intercom Broadcast")
        .setDescription(msg)
        .setFooter({ text: `Posted by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.channel.send({ embeds: [embed] });
      return interaction.editReply(`✅ ${cmd} sent.`);
    }

    // ===== /addrole /removerole =====
    if (cmd === "addrole" || cmd === "removerole") {
      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return interaction.editReply("❌ You need **Manage Roles** permission.");
      }

      const user = interaction.options.getUser("user", true);
      const role = interaction.options.getRole("role", true);
      const member = await interaction.guild.members.fetch(user.id);

      const botMember = await interaction.guild.members.fetchMe();
      if (role.position >= botMember.roles.highest.position) {
        return interaction.editReply("❌ I can’t manage that role (it’s higher than or equal to my top role).");
      }

      if (cmd === "addrole") await member.roles.add(role);
      else await member.roles.remove(role);

      return interaction.editReply(
        `✅ ${cmd === "addrole" ? "Added" : "Removed"} ${role} ${cmd === "addrole" ? "to" : "from"} ${member}.`
      );
    }

    // ===== /kick =====
    if (cmd === "kick") {
      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.KickMembers)) {
        return interaction.editReply("❌ You need **Kick Members** permission.");
      }

      const user = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason") || "No reason provided";
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (!member) return interaction.editReply("❌ That user is not in this server.");
      if (!member.kickable) return interaction.editReply("❌ I can’t kick that user (role hierarchy).");

      await member.kick(reason);
      return interaction.editReply(`✅ Kicked **${user.tag}**. Reason: ${reason}`);
    }

    // ===== /ban =====
    if (cmd === "ban") {
      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.BanMembers)) {
        return interaction.editReply("❌ You need **Ban Members** permission.");
      }

      const user = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason") || "No reason provided";
      const deleteDays = interaction.options.getInteger("delete_days") ?? 0;

      await interaction.guild.members.ban(user.id, {
        reason,
        deleteMessageSeconds: deleteDays * 86400,
      });

      return interaction.editReply(
        `✅ Banned **${user.tag}**. Deleted ${deleteDays} day(s) of messages. Reason: ${reason}`
      );
    }

    // ===== /timeout =====
    if (cmd === "timeout") {
      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        return interaction.editReply("❌ You need **Moderate Members** permission.");
      }

      const user = interaction.options.getUser("user", true);
      const minutes = interaction.options.getInteger("minutes", true);
      const reason = interaction.options.getString("reason") || "No reason provided";
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (!member) return interaction.editReply("❌ That user is not in this server.");

      await member.timeout(minutes * 60 * 1000, reason);
      return interaction.editReply(`✅ Timed out **${user.tag}** for ${minutes} minute(s). Reason: ${reason}`);
    }

    // ===== /untimeout =====
    if (cmd === "untimeout") {
      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        return interaction.editReply("❌ You need **Moderate Members** permission.");
      }

      const user = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason") || "No reason provided";
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (!member) return interaction.editReply("❌ That user is not in this server.");

      await member.timeout(null, reason);
      return interaction.editReply(`✅ Removed timeout from **${user.tag}**. Reason: ${reason}`);
    }

    // ===== WARNINGS SYSTEM (JSON) =====
    const warningsDb = loadJson(WARNINGS_FILE, { users: {} });

    function getUserWarns(userId) {
      if (!warningsDb.users[userId]) warningsDb.users[userId] = [];
      return warningsDb.users[userId];
    }
    function nextWarnId(warns) {
      let max = 0;
      for (const w of warns) max = Math.max(max, w.id || 0);
      return max + 1;
    }

    // Permission gate for warn commands
    if (["warn", "warnings", "unwarn", "editwarn", "clearwarns"].includes(cmd)) {
      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        return interaction.editReply("❌ You need **Moderate Members** permission.");
      }
    }

    if (cmd === "warn") {
      const user = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason", true);

      const warns = getUserWarns(user.id);
      const id = nextWarnId(warns);

      warns.push({ id, reason, modId: interaction.user.id, time: Date.now() });
      saveJson(WARNINGS_FILE, warningsDb);

      return interaction.editReply(`✅ Warned **${user.tag}**.\n**Warn ID:** ${id}\n**Reason:** ${reason}`);
    }

    if (cmd === "warnings") {
      const user = interaction.options.getUser("user", true);
      const warns = getUserWarns(user.id);

      if (warns.length === 0) return interaction.editReply(`✅ **${user.tag}** has no warnings.`);

      const lines = warns.slice(-15).map((w) => {
        const date = new Date(w.time).toLocaleString();
        return `**#${w.id}** — ${w.reason} *(by <@${w.modId}>, ${date})*`;
      });

      const embed = new EmbedBuilder()
        .setTitle(`⚠️ Warnings for ${user.tag}`)
        .setDescription(lines.join("\n"))
        .setFooter({ text: `Showing last ${Math.min(15, warns.length)} warning(s)` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (cmd === "unwarn") {
      const user = interaction.options.getUser("user", true);
      const warnId = interaction.options.getInteger("warn_id", true);

      const warns = getUserWarns(user.id);
      const idx = warns.findIndex((w) => w.id === warnId);

      if (idx === -1) return interaction.editReply(`❌ No warning found with ID **${warnId}** for ${user.tag}.`);

      warns.splice(idx, 1);
      saveJson(WARNINGS_FILE, warningsDb);

      return interaction.editReply(`✅ Removed warning **#${warnId}** from **${user.tag}**.`);
    }

    if (cmd === "editwarn") {
      const user = interaction.options.getUser("user", true);
      const warnId = interaction.options.getInteger("warn_id", true);
      const newReason = interaction.options.getString("reason", true);

      const warns = getUserWarns(user.id);
      const w = warns.find((x) => x.id === warnId);

      if (!w) return interaction.editReply(`❌ No warning found with ID **${warnId}** for ${user.tag}.`);

      w.reason = newReason;
      saveJson(WARNINGS_FILE, warningsDb);

      return interaction.editReply(`✅ Edited warning **#${warnId}** for **${user.tag}**.\nNew reason: ${newReason}`);
    }

    if (cmd === "clearwarns") {
      const user = interaction.options.getUser("user", true);
      warningsDb.users[user.id] = [];
      saveJson(WARNINGS_FILE, warningsDb);

      return interaction.editReply(`✅ Cleared all warnings for **${user.tag}**.`);
    }

    // ===== LOCKDOWN =====
    if (cmd === "lockdown" || cmd === "unlockdown") {
      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageChannels)) {
        return interaction.editReply("❌ You need **Manage Channels** permission.");
      }

      const reason = interaction.options.getString("reason") || "No reason provided";
      const everyone = interaction.guild.roles.everyone;

      let changed = 0;
      for (const channelId of LOCKDOWN_CHANNEL_IDS) {
        const ch = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (!ch) continue;

        if (cmd === "lockdown") {
          await ch.permissionOverwrites.edit(everyone, { SendMessages: false }).catch(() => null);
        } else {
          await ch.permissionOverwrites.edit(everyone, { SendMessages: null }).catch(() => null);
        }
        changed++;
      }

      return interaction.editReply(
        `✅ ${cmd === "lockdown" ? "Locked" : "Unlocked"} **${changed}** channel(s).\nReason: ${reason}`
      );
    }

    // ===== SSU PERMISSION (allowed role ID) =====
    if (["ssu", "ssd", "ssupoll", "ssutakeover"].includes(cmd)) {
      if (!hasRoleId(interaction.member, SSU_ALLOWED_ROLE_ID)) {
        return interaction.editReply("❌ You are not allowed to use this SSU command.");
      }
    }

    if (cmd === "ssu") {
      const embed = new EmbedBuilder()
        .setTitle("🚨 Server Start Up")
        .setDescription(
          `A Server Start Up has been hosted by **${interaction.user}**!\n` +
            `Please join to roleplay and have fun!\n\n` +
            `**How to join:**\n` +
            `> Join the SCP: Roleplay game\n` +
            `> Press "Custom Servers"\n` +
            `> Search, "Site-44" in the search bar\n` +
            `> Press Join!`
        )
        .setTimestamp();

      const ping = `<@&${SSU_PING_ROLE_ID}>`;
      const msg = await interaction.channel.send({ content: ping, embeds: [embed] });

      saveJson(SSU_FILE, { channelId: msg.channel.id, messageId: msg.id });
      return interaction.editReply("✅ SSU posted.");
    }

    if (cmd === "ssd") {
      const embed = new EmbedBuilder()
        .setTitle("🛑 Server Shutdown")
        .setDescription(
          `Unfortunately, the Server Start-up has shut down.\n` +
            `Don't worry! There will always be another SSU soon!\n` +
            `Feel free to go the SSU beg channel to ask for an SSU!`
        )
        .setTimestamp();

      await interaction.channel.send({ embeds: [embed] });
      return interaction.editReply("✅ SSD posted.");
    }

    if (cmd === "ssupoll") {
      const embed = new EmbedBuilder()
        .setTitle("📊 SSU Poll")
        .setDescription("Should we host an SSU soon?\n\n✅ = Yes\n❌ = No")
        .setFooter({ text: `Poll by ${interaction.user.tag}` })
        .setTimestamp();

      const m = await interaction.channel.send({ embeds: [embed] });
      await m.react("✅");
      await m.react("❌");

      return interaction.editReply("✅ SSU poll posted.");
    }

    if (cmd === "ssubeg") {
      const ping = `<@&${SSUBEG_PING_ROLE_ID}>`;
      await interaction.channel.send({ content: `${ping} **${interaction.user}** is requesting an SSU!` });
      return interaction.editReply("✅ SSU beg sent.");
    }

    if (cmd === "ssurevive") {
      const ping = `<@&${SSUREVIVE_ROLE_ID}>`;
      await interaction.channel.send({ content: `${ping} **${interaction.user}** is calling for an SSU revive!` });
      return interaction.editReply("✅ SSU revive ping sent.");
    }

    if (cmd === "ssutakeover") {
      const last = loadJson(SSU_FILE, null);
      if (!last?.channelId || !last?.messageId) {
        return interaction.editReply("❌ No SSU message saved yet. Use /ssu first.");
      }

      const ch = await interaction.guild.channels.fetch(last.channelId).catch(() => null);
      if (!ch) return interaction.editReply("❌ Could not find the SSU channel.");

      const msg = await ch.messages.fetch(last.messageId).catch(() => null);
      if (!msg) return interaction.editReply("❌ Could not find the last SSU message.");

      const oldEmbed = msg.embeds?.[0];
      if (!oldEmbed) return interaction.editReply("❌ Last SSU message has no embed.");

      const newEmbed = EmbedBuilder.from(oldEmbed)
        .setDescription(
          `A Server Start Up has been hosted by **${interaction.user}**!\n` +
            `Please join to roleplay and have fun!\n\n` +
            `**How to join:**\n` +
            `> Join the SCP: Roleplay game\n` +
            `> Press "Custom Servers"\n` +
            `> Search, "Site-44" in the search bar\n` +
            `> Press Join!`
        )
        .setTimestamp();

      await msg.edit({ embeds: [newEmbed] });
      return interaction.editReply("✅ SSU takeover complete. Embed updated.");
    }

    // ===== FALLBACK =====
    return interaction.editReply("❌ Command not handled in index.js (wrong file running).");
  } catch (err) {
    console.error("Command error:", err);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply("❌ Something went wrong running that command.");
      } else {
        await interaction.reply({ content: "❌ Something went wrong running that command.", ephemeral: true });
      }
    } catch {}
  }
});

client.login(process.env.TOKEN);