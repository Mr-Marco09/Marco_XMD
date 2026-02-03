module.exports = {
    name: "ping",
    category: "general",
    description: "Vérifie la vitesse de réponse du bot",
    async execute(conn, m, args) {
        const start = Date.now();
        
        // Petite réaction pour montrer que le bot travaille
        await conn.sendMessage(m.key.remoteJid, { react: { text: "⚡", key: m.key } });

        const end = Date.now();
        const latence = end - start;

        await conn.sendMessage(m.key.remoteJid, { 
            text: `*Pong !* 🏓\n\n*Vitesse :* ${latence} ms\n*Statut :* En ligne 🚀` 
        }, { quoted: m });
    }
};
