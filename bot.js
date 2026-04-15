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
const DUREE_MINUTES = parseInt(process.env.DUREE_MINUTES) || 60;

let giveawayActif = false;
let messageGiveaway = null;
let participants = new Set();

client.once('ready', () => {
  console.log(`Bot connecte : ${client.user.tag}`);
  lancerSchedule();
});

function lancerSchedule() {
  // Tous les jours a 19h heure française (UTC+2 ete / UTC+1 hiver)
  // 17h UTC en ete, 18h UTC en hiver
  schedule.scheduleJob('0 17 * * *', () => {
    lancerGiveaway();
  });
  console.log('Schedule configure : giveaway tous les jours a 19h (heure francaise)');
}

async function lancerGiveaway() {
  if (giveawayActif) {
    console.log('Un giveaway est deja en cours, annulation.');
    return;
  }

  try {
    const canal = await client.channels.fetch(CANAL_PARTICIPATION);
    if (!canal) { console.log('Canal participation introuvable'); return; }

    giveawayActif = true;
    participants = new Set();

    const embed = new EmbedBuilder()
      .setColor('#f5a623')
      .setTitle('🎁 GIVEAWAY DU JOUR — BET0TALL')
      .setDescription(
        '**Prix : 10€ Tips offerts !**\n\n' +
        '📝 **Comment participer ?**\n' +
        'Écris un message dans ce salon dans les **' + DUREE_MINUTES + ' prochaines minutes** !\n\n' +
        '⚠️ Un seul message par personne compte\n' +
        '🚫 Les doublons sont ignorés\n\n' +
        '⏰ Le tirage aura lieu dans **' + DUREE_MINUTES + ' minutes** !'
      )
      .setFooter({ text: 'BET0TALL — Bonne chance à tous !' })
      .setTimestamp();

    messageGiveaway = await canal.send({ embeds: [embed] });

    console.log('Giveaway lance ! Duree : ' + DUREE_MINUTES + ' minutes');

    // Collecter les messages pendant la duree
    setTimeout(() => {
      tirerAuSort();
    }, DUREE_MINUTES * 60 * 1000);

  } catch (err) {
    console.error('Erreur lancement giveaway:', err);
    giveawayActif = false;
  }
}

// Ecouter les messages pendant le giveaway
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!giveawayActif) return;
  if (message.channelId !== CANAL_PARTICIPATION) return;

  // Ignorer le message du bot lui-meme
  if (messageGiveaway && message.id === messageGiveaway.id) return;

  // Ajouter le participant (Set = pas de doublons automatiquement)
  const avant = participants.size;
  participants.add(message.author.id);
  const apres = participants.size;

  if (apres > avant) {
    console.log(`Nouveau participant : ${message.author.username} (total: ${apres})`);
  } else {
    console.log(`Doublon ignore : ${message.author.username}`);
  }
});

async function tirerAuSort() {
  giveawayActif = false;

  try {
    const canalParticipation = await client.channels.fetch(CANAL_PARTICIPATION);
    const canalGagnant = await client.channels.fetch(CANAL_GAGNANT);

    if (!participants.size) {
      const embedVide = new EmbedBuilder()
        .setColor('#ef4444')
        .setTitle('😔 GIVEAWAY TERMINE — AUCUN PARTICIPANT')
        .setDescription('Personne n\'a participé au giveaway d\'aujourd\'hui.\nRejouez demain à 19h !')
        .setTimestamp();

      await canalParticipation.send({ embeds: [embedVide] });
      await canalGagnant.send({ embeds: [embedVide] });
      console.log('Aucun participant');
      return;
    }

    // Tirage au sort
    const listeParticipants = Array.from(participants);
    const idxGagnant = Math.floor(Math.random() * listeParticipants.length);
    const idGagnant = listeParticipants[idxGagnant];

    const gagnant = await client.users.fetch(idGagnant);

    console.log(`Gagnant tire : ${gagnant.username} (${participants.size} participants)`);

    const embedGagnant = new EmbedBuilder()
      .setColor('#10b981')
      .setTitle('🏆 GIVEAWAY — ON A UN GAGNANT !')
      .setDescription(
        `🎉 **Félicitations <@${idGagnant}> !**\n\n` +
        `Tu remportes **10€ Tips** !\n\n` +
        `📩 Contacte **Azzpronos** sur Discord pour recevoir ta récompense.\n\n` +
        `👥 **${participants.size} participant${participants.size > 1 ? 's' : ''}** au total\n` +
        `🔄 Prochain giveaway demain à **19h** !`
      )
      .setThumbnail(gagnant.displayAvatarURL())
      .setFooter({ text: 'BET0TALL — Merci à tous les participants !' })
      .setTimestamp();

    // Annonce dans les deux canaux
    await canalParticipation.send({ embeds: [embedGagnant] });
    await canalGagnant.send({ embeds: [embedGagnant] });

    participants = new Set();
    messageGiveaway = null;

  } catch (err) {
    console.error('Erreur tirage au sort:', err);
  }
}

// Commande manuelle !tirage pour lancer un test
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.content === '!tirage' && message.member?.permissions.has('Administrator')) {
    await message.reply('Lancement du giveaway manuel...');
    lancerGiveaway();
  }
  if (message.content === '!forcetirer' && message.member?.permissions.has('Administrator')) {
    await message.reply('Tirage forcé...');
    tirerAuSort();
  }
});

client.login(process.env.BOT_TOKEN);
