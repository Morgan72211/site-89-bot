require("dotenv").config();

const fs = require("fs");
const path = require("path");
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder
} = require("discord.js");

// ====== CONFIG (your IDs you told me) ======
const SSU_ALLOWED_ROLE_ID = "1453309078984982706";
const SSU_PING_ROLE_ID    = "1464810149288869971";
const SSUBEG_PING_ROLE_ID = "1453309078984982706";
const SSUREVIVE_ROLE_ID   = "1464810232189550683";

// Lockdown channel IDs you gave:
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

// Ensure env
if (!process.env.TOKEN) {
  throw new Error("TOKEN env var is missing. Add TOKEN in Railway Variables.");
}

// Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// L4+ check by role NAME starting with L4/L5 etc (ex: L4-Security Chief)
function isL4Plus(member) {
  if (!member?.roles?.cache) return false;
  return member.roles.cache.some((role) => {
    const name = role.name.toUpperCase().trim();
    const match = name.match(/^L(\d+)\b/);
    if (!match) return false;
    const level = Number(match[1]);
    return Number.isFinite(level) && level >= 4;
  });
}

// Role ID checker
function hasRoleId(member, roleId) {
  return member?.roles?.cache?.has(roleId) ?? false;
}

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ====== COMMAND HANDLER ======
client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;

    const cmd = interaction.commandName;
    console.log("✅ Command received:", cmd);

    // ====== PUBLIC ======
    if (cmd === "status") {
      const embed = new EmbedBuilder()
        .setTitle("📡 Site-89 Status")
        .setDescription("Bot is online and responding.")
        .addFields(
          { name: "Ping", value: `${client.ws.ping}ms`, inline: true },
          { name: "Server", value: interaction.guild?.name ?? "Unknown", inline: true }
        )
        .setFooter({ text: "Site-89 Systems" })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (cmd === "help") {
      const embed = new EmbedBuilder()
        .setTitle("🧾 Site-89 Bot Commands")
        .setDescription(
          [
            "**Comms**: /announce, /intercom, /status",
            "**Utility**: /help, /serverinfo",
            "**Roles**: /addrole, /removerole",
            "**Moderation**: /kick, /ban, /timeout, /untimeout",
            "**Warnings**: /warn, /warnings, /unwarn, /editwarn, /clearwarns",
            "**Security**: /lockdown, /unlockdown",
            "**SSU**: /ssu, /ssd, /ssupoll, /ssubeg, /ssurevive, /ssutakeover",
          ].join("\n")
        )
        .setFooter({ text: "Tip: If a command is missing, re-run node deploy-commands.js" })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (cmd === "serverinfo") {
      const g = interaction.guild;
      const embed = new EmbedBuilder()
        .setTitle("🏢 Server Info")
        .addFields(
          { name: "Name", value: g?.name ?? "Unknown", inline: true },
          { name: "Members", value: `${g?.memberCount ?? "?"}`, inline: true },
          { name: "ID", value: g?.id ?? "Unknown", inline: false }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ====== L4+ COMMS ======
    if (cmd === "announce" || cmd === "intercom") {
      const member = interaction.member;

      if (!isL4Plus(member)) {
        return interaction.reply({
          content: `❌ You must be **L4+** to use /${cmd}.`,
          ephemeral: true,
        });
      }

      const msg = interaction.options.getString("message", true);

      const embed = new EmbedBuilder()
        .setTitle(cmd === "announce" ? "📣 Announcement" : "📢 Intercom Broadcast")
        .setDescription(msg)
        .setFooter({ text: `Posted by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.channel.send({ embeds: [embed] });
      return interaction.reply({ content: `✅ ${cmd} sent.`, ephemeral: true });
    }

    // ====== ROLE MANAGEMENT ======
    if (cmd === "addrole" || cmd === "removerole") {
      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return interaction.reply({
          content: "❌ You need **Manage Roles** permission.",
          ephemeral: true,
        });
      }

      const user = interaction.options.getUser("user", true);
      const role = interaction.options.getRole("role", true);
      const member = await interaction.guild.members.fetch(user.id);

      // Safety: don’t allow editing roles higher/equal than bot’s top role
      const botMember = await interaction.guild.members.fetchMe();
      if (role.position >= botMember.roles.highest.position) {
        return interaction.reply({
          content: "❌ I can’t manage that role (it is higher than or equal to my top role).",
          ephemeral: true,
        });
      }

      if (cmd === "addrole") await member.roles.add(role);
      else await member.roles.remove(role);

      return interaction.reply({
        content: `✅ ${cmd === "addrole" ? "Added" : "Removed"} ${role} ${cmd === "addrole" ? "to" : "from"} ${member}.`,
        ephemeral: true,
      });
    }

    // ====== MODERATION ======
    if (cmd === "kick") {
      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.KickMembers)) {
        return interaction.reply({ content: "❌ You need **Kick Members** permission.", ephemeral: true });
      }
      const user = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason") || "No reason provided";
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (!member) return interaction.reply({ content: "❌ That user is not in this server.", ephemeral: true });
      if (!member.kickable) return interaction.reply({ content: "❌ I can’t kick that user.", ephemeral: true });

      await member.kick(reason);
      return interaction.reply({ content: `✅ Kicked **${user.tag}**. Reason: ${reason}`, ephemeral: true });
    }

    if (cmd === "ban") {
      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.BanMembers)) {
        return interaction.reply({ content: "❌ You need **Ban Members** permission.", ephemeral: true });
      }
      const user = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason") || "No reason provided";
      const deleteDays = interaction.options.getInteger("delete_days") ?? 0;

      await interaction.guild.members.ban(user.id, { reason, deleteMessageSeconds: deleteDays * 86400 });
      return interaction.reply({
        content: `✅ Banned **${user.tag}**. Deleted ${deleteDays} day(s) of messages. Reason: ${reason}`,
        ephemeral: true,
      });
    }

    if (cmd === "timeout") {
      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        return interaction.reply({ content: "❌ You need **Moderate Members** permission.", ephemeral: true });
      }
      const user = interaction.options.getUser("user", true);
      const minutes = interaction.options.getInteger("minutes", true);
      const reason = interaction.options.getString("reason") || "No reason provided";
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (!member) return interaction.reply({ content: "❌ That user is not in this server.", ephemeral: true });
      const ms = minutes * 60 * 1000;

      await member.timeout(ms, reason);
      return interaction.reply({ content: `✅ Timed out **${user.tag}** for ${minutes} minute(s). Reason: ${reason}`, ephemeral: true });
    }

    if (cmd === "untimeout") {
      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        return interaction.reply({ content: "❌ You need **Moderate Members** permission.", ephemeral: true });
      }
      const user = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason") || "No reason provided";
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (!member) return interaction.reply({ content: "❌ That user is not in this server.", ephemeral: true });

      await member.timeout(null, reason);
      return interaction.reply({ content: `✅ Removed timeout from **${user.tag}**. Reason: ${reason}`, ephemeral: true });
    }

    // ====== WARN SYSTEM (JSON) ======
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

    if (["warn", "warnings", "unwarn", "editwarn", "clearwarns"].includes(cmd)) {
      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        return interaction.reply({ content: "❌ You need **Moderate Members** permission.", ephemeral: true });
      }
    }

    if (cmd === "warn") {
      const user = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason", true);

      const warns = getUserWarns(user.id);
      const id = nextWarnId(warns);

      warns.push({
        id,
        reason,
        modId: interaction.user.id,
        time: Date.now(),
      });

      saveJson(WARNINGS_FILE, warningsDb);

      return interaction.reply({
        content: `✅ Warned **${user.tag}**.\n**Warn ID:** ${id}\n**Reason:** ${reason}`,
        ephemeral: true,
      });
    }

    if (cmd === "warnings") {
      const user = interaction.options.getUser("user", true);
      const warns = getUserWarns(user.id);

      if (warns.length === 0) {
        return interaction.reply({ content: `✅ **${user.tag}** has no warnings.`, ephemeral: true });
      }

      const lines = warns
        .slice(-15)
        .map(w => {
          const date = new Date(w.time).toLocaleString();
          return `**#${w.id}** — ${w.reason} *(by <@${w.modId}>, ${date})*`;
        });

      const embed = new EmbedBuilder()
        .setTitle(`⚠️ Warnings for ${user.tag}`)
        .setDescription(lines.join("\n"))
        .setFooter({ text: `Showing last ${Math.min(15, warns.length)} warning(s)` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (cmd === "unwarn") {
      const user = interaction.options.getUser("user", true);
      const warnId = interaction.options.getInteger("warn_id", true);

      const warns = getUserWarns(user.id);
      const idx = warns.findIndex(w => w.id === warnId);

      if (idx === -1) {
        return interaction.reply({ content: `❌ No warning found with ID **${warnId}** for ${user.tag}.`, ephemeral: true });
      }

      const removed = warns.splice(idx, 1)[0];
      saveJson(WARNINGS_FILE, warningsDb);

      return interaction.reply({
        content: `✅ Removed warning **#${removed.id}** from **${user.tag}**.`,
        ephemeral: true,
      });
    }

    if (cmd === "editwarn") {
      const user = interaction.options.getUser("user", true);
      const warnId = interaction.options.getInteger("warn_id", true);
      const newReason = interaction.options.getString("reason", true);

      const warns = getUserWarns(user.id);
      const w = warns.find(x => x.id === warnId);

      if (!w) {
        return interaction.reply({ content: `❌ No warning found with ID **${warnId}** for ${user.tag}.`, ephemeral: true });
      }

      w.reason = newReason;
      saveJson(WARNINGS_FILE, warningsDb);

      return interaction.reply({
        content: `✅ Edited warning **#${warnId}** for **${user.tag}**.\nNew reason: ${newReason}`,
        ephemeral: true,
      });
    }

    if (cmd === "clearwarns") {
      const user = interaction.options.getUser("user", true);
      warningsDb.users[user.id] = [];
      saveJson(WARNINGS_FILE, warningsDb);

      return interaction.reply({ content: `✅ Cleared all warnings for **${user.tag}**.`, ephemeral: true });
    }

    // ====== LOCKDOWN ======
    if (cmd === "lockdown" || cmd === "unlockdown") {
      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageChannels)) {
        return interaction.reply({ content: "❌ You need **Manage Channels** permission.", ephemeral: true });
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
          // Remove our overwrite for SendMessages
          await ch.permissionOverwrites.edit(everyone, { SendMessages: null }).catch(() => null);
        }
        changed++;
      }

      return interaction.reply({
        content: `✅ ${cmd === "lockdown" ? "Locked" : "Unlocked"} **${changed}** channel(s).\nReason: ${reason}`,
        ephemeral: true,
      });
    }

    // ====== SSU SYSTEM ======
    // Allowed role needed for SSU/SSD/SSUPOLL/SSUTAKEOVER
    if (["ssu", "ssd", "ssupoll", "ssutakeover"].includes(cmd)) {
      const member = interaction.member;
      if (!hasRoleId(member, SSU_ALLOWED_ROLE_ID)) {
        return interaction.reply({
          content: "❌ You are not allowed to use this SSU command.",
          ephemeral: true,
        });
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

      // Save last SSU message for takeover edits
      saveJson(SSU_FILE, { channelId: msg.channel.id, messageId: msg.id });

      return interaction.reply({ content: "✅ SSU posted.", ephemeral: true });
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
      return interaction.reply({ content: "✅ SSD posted.", ephemeral: true });
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

      return interaction.reply({ content: "✅ SSU poll posted.", ephemeral: true });
    }

    if (cmd === "ssubeg") {
      const ping = `<@&${SSUBEG_PING_ROLE_ID}>`;
      await interaction.channel.send({
        content: `${ping} **${interaction.user}** is requesting an SSU!`,
      });
      return interaction.reply({ content: "✅ SSU beg sent.", ephemeral: true });
    }

    if (cmd === "ssurevive") {
      const ping = `<@&${SSUREVIVE_ROLE_ID}>`;
      await interaction.channel.send({
        content: `${ping} **${interaction.user}** is calling for an SSU revive!`,
      });
      return interaction.reply({ content: "✅ SSU revive ping sent.", ephemeral: true });
    }

    if (cmd === "ssutakeover") {
      const last = loadJson(SSU_FILE, null);
      if (!last?.channelId || !last?.messageId) {
        return interaction.reply({ content: "❌ No SSU message saved yet. Use /ssu first.", ephemeral: true });
      }

      const ch = await interaction.guild.channels.fetch(last.channelId).catch(() => null);
      if (!ch) return interaction.reply({ content: "❌ Could not find the SSU channel.", ephemeral: true });

      const msg = await ch.messages.fetch(last.messageId).catch(() => null);
      if (!msg) return interaction.reply({ content: "❌ Could not find the last SSU message.", ephemeral: true });

      const oldEmbed = msg.embeds?.[0];
      if (!oldEmbed) return interaction.reply({ content: "❌ Last SSU message has no embed.", ephemeral: true });

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

      return interaction.reply({ content: "✅ SSU takeover complete. Embed updated.", ephemeral: true });
    }

    // ====== FALLBACK ======
    return interaction.reply({
      content: "❌ Command not handled in index.js (paste the correct file).",
      ephemeral: true,
    });

  } catch (err) {
    console.error("Command error:", err);
    if (interaction?.isRepliable()) {
      try {
        await interaction.reply({ content: "❌ Something went wrong running that command.", ephemeral: true });
      } catch {}
    }
  }
});

client.login(process.env.TOKEN);