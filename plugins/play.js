const yts = require("yt-search");
const config = require("../config.json");

module.exports = {
    name: "play",
    aliases: ["song", "musique", "mp3"], // Les synonymes
    category: "download",
    description: "Cherche et télécharge une musique",
    async execute(conn, m, args) {
        const text = args.join(" ");
        if (!text) return conn.sendMessage(m.key.remoteJid, { text: `❌ Utilisation : ${config.prefix}play [nom de la chanson]` }, { quoted: m });

        try {
            await conn.sendMessage(m.key.remoteJid, { react: { text: "🔍", key: m.key } });

            const search = await yts(text);
            const video = search.videos[0];
            if (!video) return conn.sendMessage(m.key.remoteJid, { text: "❌ Aucune vidéo trouvée." }, { quoted: m });

            const infoMess = `✨ *𝐌𝐀𝐑𝐂𝐎-𝐗𝐌𝐃 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃* ✨\n\n` +
                             `📝 *Titre :* ${video.title}\n` +
                             `⏳ *Durée :* ${video.timestamp}\n\n` +
                             `*Répondez par :*\n` +
                             `1️⃣ - MP3 (Audio)\n` +
                             `2️⃣ - Document\n` +
                             `3️⃣ - Voice (Vocal)\n\n` +
                             `© ${config.ownerName}`;

            const sentMsg = await conn.sendMessage(m.key.remoteJid, {
                image: { url: video.thumbnail },
                caption: infoMess
            }, { quoted: m });

            // On stocke dans la mémoire de l'instance
            conn.replyMemory[sentMsg.key.id] = {
                downloadUrl: video.url,
                title: video.title
            };

        } catch (e) {
            console.error(e);
            conn.sendMessage(m.key.remoteJid, { text: "❌ Erreur de recherche." }, { quoted: m });
        }
    }
};
