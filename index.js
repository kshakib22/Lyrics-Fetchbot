require("dotenv").config();
const { Client, GatewayIntentBits, REST, Routes } = require("discord.js");
const Genius = require("genius-lyrics");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const GeniusClient = new Genius.Client(process.env.GENIUS_ACCESS_TOKEN);
const commands = [
  {
    name: "lyrics",
    description: "Fetch lyrics for a song",
    options: [
      {
        name: "song",
        type: "STRING",
        description: "The name of the song",
        required: true,
      },
    ],
  },
];

const rest = new REST({ version: "10" }).setToken(
  process.env.DISCORD_BOT_TOKEN
);

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

  if (commandName === "lyrics") {
    const songTitle = options.getString("song");
    const lyrics = await fetchLyrics(songTitle);
    await interaction.reply(`Lyrics for "${songTitle}":\n${lyrics}`);
  }
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.login(process.env.DISCORD_BOT_TOKEN);
