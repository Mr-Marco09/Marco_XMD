const { getContentType, jidNormalizedUser } = require("@whiskeysockets/baileys");
const config = require("./config.json");

/**
 * 🛠 GESTIONNAIRE D'ÉVÉNEMENTS COMPLET & CORRIGÉ
 * Gère : Multi-sessions, Mode Privé/Public, Auto-Read & Auto-React Status
 */
const handleEvents = (conn, saveCreds, commands) => {
    
    // 1. SAUVEGARDE DES SESSIONS
    conn.ev.on('creds.update', saveCreds);

    // 2. MÉMOIRE ISOLÉE (Pour les menus interactifs 1, 2, 3)
    conn.replyMemory = conn.replyMemory || {};

    // 3. RÉCEPTION DES MESSAGES
    conn.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m || !m.message) return;

        // Sécurité : On attend que le bot soit prêt
        if (!conn.user) return; 

        const from = m.key.remoteJid;
        const botNumber = jidNormalizedUser(conn.user.id);
        const isMe = m.key.fromMe; // Message envoyé par le bot lui-même

        const type = getContentType(m.message);
        const body = (type === 'conversation') ? m.message.conversation : 
                     (type === 'extendedTextMessage') ? m.message.extendedTextMessage.text : 
                     (type === 'imageMessage') ? m.message.imageMessage.caption : '';

        // --- A. GESTION DES STATUTS (Lecture & Réaction) ---
        if (from === 'status@broadcast') {
            // Lecture automatique
            if (config.AUTO_READ_STATUS === "true") {
                await conn.readMessages([m.key]);
            }
            // Réaction automatique
            if (config.AUTO_REACT_STATUS === "true") {
                try {
                    const emojis = ["❤️", "🔥", "✨", "💯", "🙌", "⚡", "✅"];
                    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                    await conn.sendMessage(from, { 
                        react: { text: randomEmoji, key: m.key } 
                    }, { statusJidList: [m.key.participant] });
                } catch (e) { console.error("Erreur React Status:", e.message); }
            }
            return; 
        }

        // --- B. RÉPONSES CONTEXTUELLES (Menus 1, 2, 3) ---
        const quotedMsgId = m.message?.extendedTextMessage?.contextInfo?.stanzaId;
        if (quotedMsgId && conn.replyMemory[quotedMsgId]) {
            const { downloadUrl, title } = conn.replyMemory[quotedMsgId];
            if (["1", "2", "3"].includes(body)) {
                await conn.sendMessage(from, { react: { text: "⏳", key: m.key } });
                if (body === "1") await conn.sendMessage(from, { audio: { url: downloadUrl }, mimetype: "audio/mpeg" }, { quoted: m });
                if (body === "2") await conn.sendMessage(from, { document: { url: downloadUrl }, fileName: `${title}.mp3`, mimetype: "audio/mpeg" }, { quoted: m });
                if (body === "3") await conn.sendMessage(from, { audio: { url: downloadUrl }, ptt: true }, { quoted: m });
                await conn.sendMessage(from, { react: { text: "✅", key: m.key } });
                return;
            }
        }

        // --- C. GESTION DES COMMANDES ---
        if (body.startsWith(config.prefix)) {
            const args = body.slice(config.prefix.length).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const command = commands.get(cmdName) || [...commands.values()].find(cmd => cmd.aliases?.includes(cmdName));

            if (command) {
                // Définition JID Proprio
                const ownerJid = config.ownerNumber.includes('@') ? config.ownerNumber : `${config.ownerNumber}@s.whatsapp.net`;
                
                // DROITS : Est proprio si (fromMe) OU (Numéro config) OU (Bot lui-même)
                const isOwner = isMe || (from === jidNormalizedUser(ownerJid)) || (from === botNumber);
                
                // Vérification Mode Privé
                const isPrivateMode = config.privateMode === true || config.privateMode === "true";
                if (isPrivateMode && !isOwner) return;

                try {
                    await command.execute(conn, m, args);
                } catch (err) {
                    console.error(`❌ Erreur commande ${cmdName}:`, err.message);
                }
            }
        }
    });

    // 4. ÉVÉNEMENTS DE CONNEXION
    conn.ev.on('connection.update', async (update) => {
        const { connection } = update;
        if (connection === 'open') {
            console.log(`✅ [${config.botName}] Session active : ${conn.user.id}`);
            
            const msg = `🚀 *${config.botName}* est en ligne !\n\n` +
                        `⚙️ *Prefix :* ${config.prefix}\n` +
                        `🔒 *Mode :* ${config.privateMode === "true" ? "Privé" : "Public"}\n` +
                        `👀 *Auto-Read Status :* ${config.AUTO_READ_STATUS === "true" ? "ON" : "OFF"}\n` +
                        `❤️ *Auto-React Status :* ${config.AUTO_REACT_STATUS === "true" ? "ON" : "OFF"}`;

            setTimeout(async () => {
                await conn.sendMessage(conn.user.id, { 
                    image: { url: config.botLogo }, 
                    caption: msg 
                }).catch(() => {});
            }, 3000);
        }
    });
};

module.exports = { handleEvents };
