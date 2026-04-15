const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const schedule = require('node-schedule');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const CANAL_PARTICIPATION = process.env.CANAL_PARTICIPATION || '1482502816273530912';
const CANAL_GAGNANT = process.env.CANAL_GAGNANT || '1482502976487559242';

// Participants depuis le dernier tirage (Set = pas de doublons)
let participants = new Set();

client.once('ready', () => {
  console.log('Bot connecte : ' + client.user.tag);
  lancerSchedule();
});

// Ecouter les messages dans le canal participation
client.on('messageCreate', (message) => {
  if (message.author.bot) return;
  if (message.channelId !== CANAL_PARTICIPATION) return;

  const avant = participants.size;
  participants.add(message.author.id);

  if (participants.size > avant) {
    console.log('Nouveau participant : ' + message.author.username + ' (total: ' + participants.size + ')');
  } else {
    console.log('Doublon ignore : ' + message.author.username);
  }
});

function lancerSchedule() {
  // 19h heure francaise = 17h UTC en ete (avril-octobre)
  schedule.scheduleJob('0 17 * * *', function() {
    tirerAuSort();
  });
  console.log('Schedule : tirage tous les jours a 19h heure francaise');
}

async function tirerAuSort() {
  try {
    const canalGagnant = await client.channels.fetch(CANAL_GAGNANT);

    if (!participants.size) {
      const embedVide = new EmbedBuilder()
        .setColor('#ef4444')
        .setTitle('TIRAGE DU JOUR — BET0TALL')
        .setDescription(
          'Aucun participant depuis le dernier tirage.\n' +
          'Ecrivez dans <#' + CANAL_PARTICIPATION + '> pour participer demain !'
        )
        .setTimestamp();

      await canalGagnant.send({ embeds: [embedVide] });
      console.log('Tirage : aucun participant');
      return;
    }

    const liste = Array.from(participants);
    const idGagnant = liste[Math.floor(Math.random() * liste.length)];
    const gagnant = await client.users.fetch(idGagnant);

    console.log('Gagnant : ' + gagnant.username + ' parmi ' + liste.length + ' participants');

    const embedGagnant = new EmbedBuilder()
      .setColor('#f5a623')
      .setTitle('TIRAGE DU JOUR — BET0TALL')
      .setDescription(
        'Felicitations <@' + idGagnant + '> !\n\n' +
        'Tu remportes **10 euros Tips** !\n\n' +
        'Contacte **Azzpronos** sur Discord pour recevoir ta recompense.\n\n' +
        liste.length + ' participant(s) au total\n\n' +
        'Continue a ecrire dans <#' + CANAL_PARTICIPATION + '> pour le prochain tirage !'
      )
      .setThumbnail(gagnant.displayAvatarURL())
      .setFooter({ text: 'BET0TALL — Prochain tirage demain a 19h !' })
      .setTimestamp();

    await canalGagnant.send({ embeds: [embedGagnant] });

    // Reset pour le prochain tirage
    participants = new Set();
    console.log('Participants reset pour le prochain tirage');

  } catch (err) {
    console.error('Erreur tirage:', err);
  }
}

// Commandes admin
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.member) return;
  if (!message.member.permissions.has('Administrator')) return;

  if (message.content === '!tirage') {
    await message.reply('Tirage force ! ' + participants.size + ' participant(s) en lice...');
    tirerAuSort();
  }

  if (message.content === '!participants') {
    if (!participants.size) {
      await message.reply('Aucun participant pour linstant.');
      return;
    }
    var noms = [];
    for (var id of participants) {
      try {
        var u = await client.users.fetch(id);
        noms.push(u.username);
      } catch(e) {
        noms.push(id);
      }
    }
    await message.reply(participants.size + ' participant(s) : ' + noms.join(', '));
  }

  if (message.content === '!reset') {
    participants = new Set();
    await message.reply('Participants reset !');
  }
});

client.login(process.env.BOT_TOKEN);
