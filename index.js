require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
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
    .setName("fetchlyrics") // Updated command name to /fetchlyrics
    .setDescription("Fetch lyrics for a song")
    .addStringOption((option) =>
      option
        .setName("song")
        .setDescription("The name of the song")
        .setRequired(true)
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

async function fetchLyrics(songTitle) {
  try {
    const searches = await GeniusClient.songs.search(songTitle);
    if (searches.length === 0) {
      return "No lyrics found for this song.";
    }

    const song = searches[0];
    const lyrics = await song.lyrics();
    return lyrics;
  } catch (error) {
    console.error("Error fetching lyrics:", error);
    return "Error fetching lyrics.";
  }
}

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName, options } = interaction;

  if (commandName === "fetchlyrics") {
    const songTitle = options.getString("song");
    const lyrics = await fetchLyrics(songTitle);

    try {
      await interaction.reply(`Lyrics for "${songTitle}":\n${lyrics}`);
    } catch (error) {
      console.error("Failed to send reply:", error);
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
