const config = require("../config.json");

module.exports = {
    name: "menu",
    category: "general",
    description: "Affiche la liste des commandes",
    async execute(conn, m, args) {
        const botNumber = conn.user.id.split(':')[0]; // Récupère le numéro du bot actuel
        const prefix = config.prefix;
        
        let menuMsg = `✨ *𝐌𝐀𝐑𝐂𝐎-𝐗𝐌𝐃 𝐒𝐘𝐒𝐓𝐄𝐌* ✨\n\n`;
        menuMsg += `👤 *Bot:* ${botNumber}\n`;
        menuMsg += `🛠️ *Prefix:* [ ${prefix} ]\n`;
        menuMsg += `📅 *Date:* ${new Date().toLocaleDateString()}\n`;
        menuMsg += `──────────────\n\n`;
        
        menuMsg += `*📜 COMMANDES DISPONIBLES :*\n\n`;
        
        menuMsg += `┌──『 *GÉNÉRAL* 』\n`;
        menuMsg += `│ ▫️ ${prefix}menu : Liste des commandes\n`;
        menuMsg += `│ ▫️ ${prefix}ping : Test de vitesse\n`;
        menuMsg += `│ ▫️ ${prefix}owner : Infos proprio\n`;
        menuMsg += `└───\n\n`;

        menuMsg += `┌──『 *DOWNLOAD* 』\n`;
        menuMsg += `│ ▫️ ${prefix}play [nom] : Musique\n`;
        menuMsg += `│ ▫️ ${prefix}video [nom] : Vidéo\n`;
        menuMsg += `└───\n\n`;

        menuMsg += `> 💡 _Répondez à un message audio avec 1, 2 ou 3 pour choisir le format._\n\n`;
        menuMsg += `© 2024 *${config.ownerName}*`;

        await conn.sendMessage(m.key.remoteJid, {
            image: { url: config.botLogo },
            caption: menuMsg,
            footer: "Marco-xmd Multi-Session",
            mentions: [m.key.participant || m.key.remoteJid]
        }, { quoted: m });

        // Petit effet de réaction
        await conn.sendMessage(m.key.remoteJid, { react: { text: "📜", key: m.key } });
    }
};
