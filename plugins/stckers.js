const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const config = require("../config.json");

module.exports = {
    name: "sticker",
    aliases: ["s", "stickers"],
    category: "tools",
    description: "Convertit une image ou vidéo en sticker",
    async execute(conn, m, args) {
        const quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage || m.message;
        const mime = (quoted.imageMessage || quoted.videoMessage) ? Object.keys(quoted)[0] : null;

        if (!mime) return conn.sendMessage(m.key.remoteJid, { text: `❌ Répondez à une image ou une vidéo avec ${config.prefix}sticker` }, { quoted: m });

        try {
            await conn.sendMessage(m.key.remoteJid, { react: { text: "🎨", key: m.key } });

            // Téléchargement du média
            const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
            const stream = await downloadContentFromMessage(quoted[mime], mime.split('Message')[0]);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            // Création du sticker avec tes crédits
            const sticker = new Sticker(buffer, {
                pack: `𝐌𝐚𝐫𝐜𝐨-𝐗𝐌𝐃 🚀`, // Nom du pack
                author: `by 𝐌𝐫 𝐌𝐚𝐫𝐜𝐨`, // Ton nom ici
                type: StickerTypes.FULL, // Garde l'image entière
                categories: ['🤩', '🎉'],
                id: '12345',
                quality: 70,
            });

            const stickerBuffer = await sticker.toBuffer();
            await conn.sendMessage(m.key.remoteJid, { sticker: stickerBuffer }, { quoted: m });

        } catch (e) {
            console.error(e);
            conn.sendMessage(m.key.remoteJid, { text: "❌ Erreur lors de la création du sticker." }, { quoted: m });
        }
    }
};
