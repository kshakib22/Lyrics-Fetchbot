require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
} = require("discord.js");
const Genius = require("genius-lyrics");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const GeniusClient = new Genius.Client(process.env.GENIUS_ACCESS_TOKEN);

// Define the slash command
const commands = [
  new SlashCommandBuilder()
    .setName("fetchlyrics")
    .setDescription("Fetch lyrics for a song")
    .addStringOption((option) =>
      option
        .setName("song")
        .setDescription("The name of the song")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("artist")
        .setDescription("The name of the artist (optional)")
        .setRequired(false)
    ),
].map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(
  process.env.DISCORD_BOT_TOKEN
);

// Register the slash command
(async () => {
  try {
    console.log("Started refreshing application (/) commands.");

    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commands,
    });

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
})();

async function fetchLyrics(songTitle, artistName = "") {
  try {
    const searchQuery = artistName ? `${songTitle} ${artistName}` : songTitle;
    const searches = await GeniusClient.songs.search(searchQuery);

    if (searches.length === 0) {
      return { success: false, message: "No lyrics found for this song." };
    }

    return { success: true, results: searches.slice(0, 5) }; // Return top 5 results
  } catch (error) {
    console.error("Error fetching lyrics:", error);
    return { success: false, message: "Error fetching lyrics." };
  }
}

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName, options } = interaction;

  if (commandName === "fetchlyrics") {
    await interaction.deferReply();

    try {
      const songTitle = options.getString("song");
      const artistName = options.getString("artist");
      const result = await fetchLyrics(songTitle, artistName);

      if (!result.success) {
        await interaction.editReply(result.message);
        return;
      }

      const songs = result.results;

      // Create selection menu
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("lyric_select")
        .setPlaceholder("Select a song")
        .addOptions(
          songs.map((song, index) => ({
            label: `${song.title} by ${song.artist.name}`.substring(0, 100),
            description: `${song.fullTitle}`.substring(0, 100),
            value: `${index}`,
          }))
        );

      // Add a cancel option
      selectMenu.addOptions([
        {
          label: "Cancel",
          description: "Cancel the lyric search",
          value: "cancel",
        },
      ]);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const reply = await interaction.editReply({
        content: "Please select a song:",
        components: [row],
      });

      // Handle selection
      const filter = (i) =>
        i.customId === "lyric_select" && i.user.id === interaction.user.id;
      const collector = reply.createMessageComponentCollector({ filter });

      collector.on("collect", async (i) => {
        await i.deferUpdate();

        if (i.values[0] === "cancel") {
          await interaction.followUp("Lyric search cancelled.");
          collector.stop("cancelled");
          return;
        }

        const selectedIndex = parseInt(i.values[0]);
        const selectedSong = songs[selectedIndex];
        const lyrics = await selectedSong.lyrics();

        await interaction.followUp(
          `Fetching lyrics for "${selectedSong.title}"...`
        );

        // Prepare the lyrics message
        let lyricsMessage = `Lyrics for "${selectedSong.title}" by ${selectedSong.artist.name}:\n\n${lyrics}`;

        // Split lyrics into chunks of 1950 characters
        const chunkSize = 1950;
        const chunks = [];

        for (let i = 0; i < lyricsMessage.length; i += chunkSize) {
          chunks.push(lyricsMessage.slice(i, i + chunkSize));
        }

        // Send chunks as separate messages
        for (let i = 0; i < chunks.length; i++) {
          await interaction.followUp(chunks[i]);
        }

        collector.stop();
      });

      collector.on("end", (collected, reason) => {
        if (reason === "cancelled") return;
        if (collected.size === 0) {
          interaction.followUp(
            "No song was selected. The lyric search has been cancelled."
          );
        }
      });
    } catch (error) {
      console.error("Error handling interaction:", error);
      if (interaction.isRepliable()) {
        await interaction.editReply("An error occurred while fetching lyrics.");
      }
    }
  }
});

client.on("error", (error) => {
  console.error("Discord client encountered an error:", error);
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.login(process.env.DISCORD_BOT_TOKEN);
