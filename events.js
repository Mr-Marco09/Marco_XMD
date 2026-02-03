const { getContentType, jidNormalizedUser } = require("@whiskeysockets/baileys");
const config = require("./config.json");

/**
 * 🛠 GESTIONNAIRE D'ÉVÉNEMENTS MULTI-SESSION
 * Chaque instance de bot appelle cette fonction pour lier ses propres événements.
 */
const handleEvents = (conn, saveCreds, commands) => {
    
    // 1. SAUVEGARDE DES CLÉS (Crucial pour rester connecté)
    conn.ev.on('creds.update', saveCreds);

    // 2. MÉMOIRE TEMPORAIRE (Spécifique à cette instance)
    // Utilisé pour stocker les choix de téléchargement (Play/Video)
    conn.replyMemory = {};

    // 3. RÉCEPTION DES MESSAGES
    conn.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m || !m.message) return;
        if (m.key.fromMe) return; // Ne pas répondre à ses propres messages

        const from = m.key.remoteJid;
        const botNumber = jidNormalizedUser(conn.user.id);
        const type = getContentType(m.message);
        
        // Extraction du texte
        const body = (type === 'conversation') ? m.message.conversation : 
                     (type === 'extendedTextMessage') ? m.message.extendedTextMessage.text : 
                     (type === 'imageMessage') ? m.message.imageMessage.caption : '';

        // --- GESTION DES RÉPONSES AUX CHOIX (1, 2, 3) ---
        const quotedMsgId = m.message?.extendedTextMessage?.contextInfo?.stanzaId;
        if (quotedMsgId && conn.replyMemory[quotedMsgId]) {
            const { downloadUrl, title } = conn.replyMemory[quotedMsgId];
            
            if (["1", "2", "3"].includes(body)) {
                await conn.sendMessage(from, { react: { text: "⏳", key: m.key } });
                
                // Logique simplifiée (à adapter selon tes plugins de téléchargement)
                if (body === "1") await conn.sendMessage(from, { audio: { url: downloadUrl }, mimetype: "audio/mpeg" }, { quoted: m });
                if (body === "2") await conn.sendMessage(from, { document: { url: downloadUrl }, fileName: `${title}.mp3`, mimetype: "audio/mpeg" }, { quoted: m });
                if (body === "3") await conn.sendMessage(from, { audio: { url: downloadUrl }, ptt: true }, { quoted: m });

                await conn.sendMessage(from, { react: { text: "✅", key: m.key } });
                return;
            }
        }

        // --- GESTION DES COMMANDES ---
        if (body.startsWith(config.prefix)) {
            const args = body.slice(config.prefix.length).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();

            // Recherche de la commande (par nom ou par alias)
            const command = commands.get(cmdName) || [...commands.values()].find(cmd => cmd.aliases && cmd.aliases.includes(cmdName));

            if (command) {
                // Déterminer si l'expéditeur est le propriétaire de CETTE session précise
                const isOwner = from.startsWith(botNumber.split('@')[0]) || from.startsWith(config.ownerNumber);
                
                if (config.privateMode === "true" && !isOwner) return;

                try {
                    await command.execute(conn, m, args);
                } catch (err) {
                    console.error(`Erreur commande ${cmdName}:`, err);
                }
            }
        }
    });

    // 4. ÉVÉNEMENTS DE CONNEXION (LOGS)
    conn.ev.on('connection.update', async ({ connection }) => {
        if (connection === 'open') {
            const botNum = jidNormalizedUser(conn.user.id).split('@')[0];
            const welcomeMsg = `🚀 *${config.botName}* est en ligne !\n\n👤 *Utilisateur :* ${botNum}\n⚙️ *Prefix :* ${config.prefix}`;
            
            // Envoie un message de confirmation au numéro qui vient de se connecter
            await conn.sendMessage(conn.user.id, { 
                image: { url: config.botLogo }, 
                caption: welcomeMsg 
            });
        }
    });
};

module.exports = { handleEvents };
