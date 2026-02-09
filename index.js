require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
} = require("discord.js");

if (!process.env.TOKEN) {
  throw new Error("TOKEN env var is missing. Add TOKEN in Railway Variables.");
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// --- L4+ check based on role names like "L4-..." "L5-..." etc
function isL4Plus(member) {
  if (!member?.roles?.cache) return false;

  return member.roles.cache.some((role) => {
    const name = role.name.toUpperCase().trim();
    // Matches "L4", "L4-", "L4 ", "L5", etc
    const match = name.match(/^L(\d+)\b/);
    if (!match) return false;

    const level = Number(match[1]);
    return Number.isFinite(level) && level >= 4;
  });
}

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;

    console.log("Received command:", interaction.commandName);

    // -------- /status (everyone)
    if (interaction.commandName === "status") {
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

    // -------- /announce (L4+ only)
    if (interaction.commandName === "announce") {
      const member = interaction.member;

      if (!isL4Plus(member)) {
        return interaction.reply({
          content: "❌ You must be **L4+** to use /announce.",
          ephemeral: true,
        });
      }

      const msg = interaction.options.getString("message", true);

      const embed = new EmbedBuilder()
        .setTitle("📣 Announcement")
        .setDescription(msg)
        .setFooter({ text: `Posted by ${interaction.user.tag}` })
        .setTimestamp();

      // Send publicly
      await interaction.channel.send({ embeds: [embed] });

      return interaction.reply({
        content: "✅ Announcement sent.",
        ephemeral: true,
      });
    }

    // -------- /intercom (L4+ only)
    if (interaction.commandName === "intercom") {
      const member = interaction.member;

      if (!isL4Plus(member)) {
        return interaction.reply({
          content: "❌ You must be **L4+** to use /intercom.",
          ephemeral: true,
        });
      }

      const msg = interaction.options.getString("message", true);

      const embed = new EmbedBuilder()
        .setTitle("📢 Intercom Broadcast")
        .setDescription(msg)
        .setFooter({ text: `Broadcast by ${interaction.user.tag}` })
        .setTimestamp();

      // Send publicly
      await interaction.channel.send({ embeds: [embed] });

      return interaction.reply({
        content: "✅ Intercom broadcast sent.",
        ephemeral: true,
      });
    }

    // If we somehow get here:
    return interaction.reply({
      content: "❌ Command not handled in index.js (paste the correct file).",
      ephemeral: true,
    });
  } catch (err) {
    console.error("Command error:", err);
    if (interaction?.isRepliable()) {
      try {
        await interaction.reply({
          content: "❌ Something went wrong running that command.",
          ephemeral: true,
        });
      } catch {}
    }
  }
});

client.login(process.env.TOKEN);