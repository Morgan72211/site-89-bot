// index.js (FULL) — FIXED to prevent "application isn't responding" using deferReply/editReply everywhere
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const os = require("os");
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

/* =======================
   OPTIONAL DEFAULT PING ROLES (leave null to always pass /ping)
======================= */
const DEFAULT_SSU_PING_ROLE_ID = null;
const DEFAULT_SSUPOLL_PING_ROLE_ID = null;

/* =======================
   LOCKDOWN CHANNELS
======================= */
const LOCKDOWN_CHANNELS = [
  "1467681208359194776",
  "1467681285320478866",
  "1467681307470336001",
  "1467681330991988862",
  "1467681524181635133",
  "1467681904345219082",
  "1467681540854120531",
  "1467681638027759727",
];

/* =======================
   CLEARANCE CONFIG (optional role sync)
======================= */
const CLEARANCE_ROLE_IDS = { L1: null, L2: null, L3: null, L4: null, L5: null, SITE_DIRECTOR: null };
const CLEARANCE_NAMES = { L1: "L1", L2: "L2", L3: "L3", L4: "L4", L5: "L5", SITE_DIRECTOR: "Site Director" };
const CLEARANCE_RANK = { L1: 1, L2: 2, L3: 3, L4: 4, L5: 5, SITE_DIRECTOR: 6 };

/* =======================
   JSON HELPERS
======================= */
function ensureJsonFile(file, fallbackObj) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(fallbackObj, null, 2), "utf8");
}
function readJson(file, fallbackObj) {
  ensureJsonFile(file, fallbackObj);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    fs.writeFileSync(file, JSON.stringify(fallbackObj, null, 2), "utf8");
    return fallbackObj;
  }
}
function writeJson(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), "utf8");
}

/* =======================
   STORAGE FILES
======================= */
const CLEARANCE_FILE = path.join(__dirname, "clearance.json");
const WARN_FILE = path.join(__dirname, "warnings.json");

/* =======================
   CLEARANCE HELPERS
======================= */
function getUserClearance(store, userId) {
  return store[userId] || "L1";
}
function hasClearance(store, userId, requiredLevel) {
  const userLevel = getUserClearance(store, userId);
  return (CLEARANCE_RANK[userLevel] || 0) >= (CLEARANCE_RANK[requiredLevel] || 999);
}

/* =======================
   WARN HELPERS
======================= */
function loadWarnings() {
  return readJson(WARN_FILE, { guilds: {} });
}
function saveWarnings(obj) {
  writeJson(WARN_FILE, obj);
}

/* =======================
   BOT
======================= */
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

const startedAt = Date.now();

// SSU poll (in-memory)
const ssuPollCounts = new Map();

client.once("clientReady", () => {
  console.log(`✅ Site-89 Bot logged in as ${client.user.tag}`);
});

/* Optional: role sync if you later fill CLEARANCE_ROLE_IDS */
async function syncClearanceRole(guild, member, levelKey) {
  const targetRoleId = CLEARANCE_ROLE_IDS[levelKey];
  const allRoleIds = Object.values(CLEARANCE_ROLE_IDS).filter(Boolean);
  if (!targetRoleId || allRoleIds.length === 0) return { didSync: false };

  const me = guild.members.me;
  if (!me?.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return { didSync: false, error: "I need Manage Roles to sync clearance roles." };
  }

  const targetRole = guild.roles.cache.get(targetRoleId);
  if (!targetRole) return { didSync: false, error: "Target clearance role not found." };
  if (me.roles.highest.position <= targetRole.position) {
    return { didSync: false, error: "Move my bot role above the clearance roles." };
  }

  const toRemove = member.roles.cache.filter((r) => allRoleIds.includes(r.id));
  for (const role of toRemove.values()) await member.roles.remove(role).catch(() => {});
  await member.roles.add(targetRole).catch(() => {});
  return { didSync: true };
}

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (mins) parts.push(`${mins}m`);
  parts.push(`${secs}s`);
  return parts.join(" ");
}

async function setLockdown(guild, locked) {
  const everyone = guild.roles.everyone;
  const results = { updated: 0, missing: 0, failed: 0 };
  for (const id of LOCKDOWN_CHANNELS) {
    const channel = guild.channels.cache.get(id);
    if (!channel) {
      results.missing += 1;
      continue;
    }
    if (!channel.isTextBased?.()) {
      results.failed += 1;
      continue;
    }
    try {
      await channel.permissionOverwrites.edit(everyone, { SendMessages: locked ? false : null });
      results.updated += 1;
    } catch {
      results.failed += 1;
    }
  }
  return results;
}

function buildSSUPollEmbed(question, counts) {
  return new EmbedBuilder()
    .setTitle("📊 SSU Poll")
    .setDescription(`**${question}**\n\nClick a button below to vote.`)
    .addFields(
      { name: "✅ Joining", value: `${counts.join.size}`, inline: true },
      { name: "❓ Maybe", value: `${counts.maybe.size}`, inline: true },
      { name: "❌ Can't", value: `${counts.cant.size}`, inline: true }
    )
    .setTimestamp();
}

// Moderation safety: prevents modding higher/equal roles; requires bot role above target
function modSafety(interaction, targetMember) {
  const me = interaction.guild.members.me;
  const actor = interaction.member;
  const isOwner = interaction.guild.ownerId === interaction.user.id;

  if (!targetMember) return "❌ That user is not in this server.";
  if (targetMember.id === interaction.guild.ownerId) return "❌ You can’t moderate the server owner.";

  if (!me) return "❌ Bot member not cached. Try again.";
  if (me.roles.highest.position <= targetMember.roles.highest.position)
    return "❌ My bot role must be above the target’s top role.";

  if (!isOwner && actor.roles.highest.position <= targetMember.roles.highest.position)
    return "❌ You can’t moderate someone with an equal/higher top role than you.";

  return null;
}

function fmtWarn(w) {
  const when = `<t:${Math.floor(w.time / 1000)}:R>`;
  return `• **ID:** \`${w.id}\`\n  **By:** <@${w.moderatorId}>\n  **When:** ${when}\n  **Reason:** ${w.reason}`;
}

/* =======================
   INTERACTIONS
======================= */
client.on("interactionCreate", async (interaction) => {
  // ===== Button handling for ssupoll =====
  if (interaction.isButton()) {
    const [tag, messageId, choice] = interaction.customId.split(":");
    if (tag !== "ssupoll") return;

    const data = ssuPollCounts.get(messageId);
    if (!data) return interaction.reply({ content: "❌ This poll expired (bot restarted).", ephemeral: true });

    const uid = interaction.user.id;
    data.join.delete(uid);
    data.maybe.delete(uid);
    data.cant.delete(uid);

    if (choice === "join") data.join.add(uid);
    if (choice === "maybe") data.maybe.add(uid);
    if (choice === "cant") data.cant.add(uid);

    return interaction.update({ embeds: [buildSSUPollEmbed(data.question, data)] });
  }

  // ===== Slash commands =====
  if (!interaction.isChatInputCommand()) return;
  if (!interaction.inGuild()) return interaction.reply({ content: "❌ Use this in a server.", ephemeral: true });

  // IMPORTANT: defer early so Discord never times out
  await interaction.deferReply({ ephemeral: true });

  // Load clearance
  const clearanceData = readJson(CLEARANCE_FILE, { guilds: {} });
  const gid = interaction.guildId;
  if (!clearanceData.guilds[gid]) clearanceData.guilds[gid] = { users: {} };
  const clearanceStore = clearanceData.guilds[gid].users;

  /* =======================
     /help
  ======================= */
  if (interaction.commandName === "help") {
    const embed = new EmbedBuilder()
      .setTitle("📖 Site-89 Bot Commands")
      .setDescription(
        [
          "**General**",
          "• /help",
          "• /status",
          "• /serverinfo",
          "",
          "**Moderation**",
          "• /warn",
          "• /warnings",
          "• /unwarn",
          "• /clearwarns",
          "• /kick",
          "• /ban",
          "• /timeout",
          "",
          "**Clearance**",
          "• /clearance set (staff)",
          "• /clearance get",
          "• /clearance list",
          "",
          "**Announcements (L4+)**",
          "• /announce",
          "• /intercom",
          "",
          "**Roles**",
          "• /addrole",
          "• /removerole",
          "",
          "**Site**",
          "• /lockdown start (L5+)",
          "• /lockdown lift (L5+)",
          "• /ssu (L4+)",
          "• /ssd (L4+)",
          "• /ssupoll (L4+)",
        ].join("\n")
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  /* =======================
     /serverinfo
  ======================= */
  if (interaction.commandName === "serverinfo") {
    const guild = interaction.guild;
    const embed = new EmbedBuilder()
      .setTitle(`📊 ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .addFields(
        { name: "👑 Owner", value: `<@${guild.ownerId}>`, inline: true },
        { name: "👥 Members", value: `${guild.memberCount}`, inline: true },
        { name: "📅 Created", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true }
      )
      .setTimestamp();

    // This one can be public if you want — but we deferred ephemeral.
    return interaction.editReply({ embeds: [embed] });
  }

  /* =======================
     /status
  ======================= */
  if (interaction.commandName === "status") {
    const uptime = formatUptime(Date.now() - startedAt);
    const ping = `${Math.round(client.ws.ping)}ms`;
    const mem = `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`;

    const embed = new EmbedBuilder()
      .setTitle("📡 Site-89 Bot Status")
      .addFields(
        { name: "Uptime", value: uptime, inline: true },
        { name: "WebSocket Ping", value: ping, inline: true },
        { name: "Memory (RSS)", value: mem, inline: true },
        { name: "Node", value: process.version, inline: true },
        { name: "Platform", value: `${os.platform()} ${os.arch()}`, inline: true }
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  /* =======================
     /warn
  ======================= */
  if (interaction.commandName === "warn") {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.editReply("❌ You need **Manage Messages**.");
    }

    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") || "No reason provided.";
    const memberTarget = await interaction.guild.members.fetch(user.id).catch(() => null);

    const safety = modSafety(interaction, memberTarget);
    if (safety) return interaction.editReply(safety);

    const warns = loadWarnings();
    if (!warns.guilds[gid]) warns.guilds[gid] = { users: {} };
    if (!warns.guilds[gid].users[user.id]) warns.guilds[gid].users[user.id] = [];

    const warnId = `${Date.now()}`;
    warns.guilds[gid].users[user.id].push({
      id: warnId,
      moderatorId: interaction.user.id,
      reason,
      time: Date.now(),
    });
    saveWarnings(warns);

    const total = warns.guilds[gid].users[user.id].length;

    const embed = new EmbedBuilder()
      .setTitle("⚠️ Warning Issued")
      .addFields(
        { name: "User", value: `${user} (${user.id})` },
        { name: "Warning ID", value: `\`${warnId}\``, inline: true },
        { name: "Total Warnings", value: `${total}`, inline: true },
        { name: "Reason", value: reason },
        { name: "Moderator", value: `${interaction.user}`, inline: true }
      )
      .setTimestamp();

    user.send(`You were warned in **${interaction.guild.name}**.\nReason: ${reason}\nWarn ID: ${warnId}\nTotal warnings: ${total}`).catch(() => {});
    return interaction.editReply({ embeds: [embed] });
  }

  /* =======================
     /warnings
  ======================= */
  if (interaction.commandName === "warnings") {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.editReply("❌ You need **Manage Messages**.");
    }

    const user = interaction.options.getUser("user", true);
    const warns = loadWarnings();
    const list = warns.guilds?.[gid]?.users?.[user.id] || [];

    if (list.length === 0) return interaction.editReply(`✅ ${user} has **0** warnings.`);

    const last = list.slice(-5).reverse();
    const embed = new EmbedBuilder()
      .setTitle(`📄 Warnings for ${user.username}`)
      .setDescription(
        `Total warnings: **${list.length}**\n\n` +
          last.map(fmtWarn).join("\n\n") +
          (list.length > 5 ? `\n\n…showing latest **5**. Use IDs with /unwarn.` : "")
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  /* =======================
     /unwarn
  ======================= */
  if (interaction.commandName === "unwarn") {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.editReply("❌ You need **Manage Messages**.");
    }

    const user = interaction.options.getUser("user", true);
    const warnId = interaction.options.getString("warn_id", true);

    const warns = loadWarnings();
    const list = warns.guilds?.[gid]?.users?.[user.id] || [];

    const idx = list.findIndex((w) => w.id === warnId);
    if (idx === -1) return interaction.editReply(`❌ No warning found with ID \`${warnId}\` for ${user}.`);

    const removed = list.splice(idx, 1)[0];
    if (!warns.guilds[gid]) warns.guilds[gid] = { users: {} };
    warns.guilds[gid].users[user.id] = list;
    saveWarnings(warns);

    return interaction.editReply(`✅ Removed warning \`${warnId}\` from ${user}.\nReason was: **${removed.reason}**`);
  }

  /* =======================
     /clearwarns
  ======================= */
  if (interaction.commandName === "clearwarns") {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.editReply("❌ You need **Manage Messages**.");
    }

    const user = interaction.options.getUser("user", true);
    const warns = loadWarnings();
    const count = warns.guilds?.[gid]?.users?.[user.id]?.length || 0;

    if (!warns.guilds[gid]) warns.guilds[gid] = { users: {} };
    warns.guilds[gid].users[user.id] = [];
    saveWarnings(warns);

    return interaction.editReply(`✅ Cleared **${count}** warning(s) for ${user}.`);
  }

  /* =======================
     /kick
  ======================= */
  if (interaction.commandName === "kick") {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.KickMembers)) {
      return interaction.editReply("❌ You need **Kick Members**.");
    }

    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") || "No reason provided.";
    const memberTarget = await interaction.guild.members.fetch(user.id).catch(() => null);

    const safety = modSafety(interaction, memberTarget);
    if (safety) return interaction.editReply(safety);

    if (!interaction.guild.members.me?.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      return interaction.editReply("❌ I need **Kick Members** permission.");
    }

    await user.send(`You were kicked from **${interaction.guild.name}**.\nReason: ${reason}`).catch(() => {});
    await memberTarget.kick(reason).catch((e) => interaction.editReply(`❌ Kick failed: ${e.message}`));

    return interaction.editReply(`✅ Kicked ${user}. Reason: ${reason}`);
  }

  /* =======================
     /ban
  ======================= */
  if (interaction.commandName === "ban") {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.BanMembers)) {
      return interaction.editReply("❌ You need **Ban Members**.");
    }

    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") || "No reason provided.";
    const deleteDays = interaction.options.getInteger("delete_days") ?? 0;

    if (!interaction.guild.members.me?.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return interaction.editReply("❌ I need **Ban Members** permission.");
    }

    const memberTarget = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (memberTarget) {
      const safety = modSafety(interaction, memberTarget);
      if (safety) return interaction.editReply(safety);
    }

    await user.send(`You were banned from **${interaction.guild.name}**.\nReason: ${reason}`).catch(() => {});
    await interaction.guild.members
      .ban(user.id, { reason, deleteMessageSeconds: deleteDays * 24 * 60 * 60 })
      .catch((e) => interaction.editReply(`❌ Ban failed: ${e.message}`));

    return interaction.editReply(`✅ Banned ${user}. Reason: ${reason}`);
  }

  /* =======================
     /timeout
  ======================= */
  if (interaction.commandName === "timeout") {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ModerateMembers)) {
      return interaction.editReply("❌ You need **Timeout Members** permission.");
    }

    const user = interaction.options.getUser("user", true);
    const minutes = interaction.options.getInteger("minutes", true);
    const reason = interaction.options.getString("reason") || "No reason provided.";
    const memberTarget = await interaction.guild.members.fetch(user.id).catch(() => null);

    const safety = modSafety(interaction, memberTarget);
    if (safety) return interaction.editReply(safety);

    if (!interaction.guild.members.me?.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return interaction.editReply("❌ I need **Timeout Members** permission.");
    }

    const ms = minutes * 60 * 1000;
    await user.send(`You were timed out in **${interaction.guild.name}** for **${minutes} minutes**.\nReason: ${reason}`).catch(() => {});
    await memberTarget.timeout(ms, reason).catch((e) => interaction.editReply(`❌ Timeout failed: ${e.message}`));

    return interaction.editReply(`✅ Timed out ${user} for **${minutes} minutes**. Reason: ${reason}`);
  }

  // If we got here, command wasn’t handled
  return interaction.editReply("❌ Command not handled in index.js (paste the correct file).");
});

client.login(process.env.TOKEN);