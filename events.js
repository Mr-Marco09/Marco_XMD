const { getContentType, jidNormalizedUser } = require("@whiskeysockets/baileys");
const config = require("./config.json");

/**
 * 🛠 GESTIONNAIRE D'ÉVÉNEMENTS MULTI-SESSION
 * Version optimisée : Autorise le contrôle par le propriétaire (fromMe)
 */
const handleEvents = (conn, saveCreds, commands) => {
    
    // 1. SAUVEGARDE DES CLÉS
    conn.ev.on('creds.update', saveCreds);

    // 2. MÉMOIRE TEMPORAIRE (Isolée par instance)
    conn.replyMemory = {};

    // 3. RÉCEPTION DES MESSAGES
    conn.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m || !m.message) return;

        // Sécurité pour éviter les crashs avant la connexion complète
        if (!conn.user) return; 

        const from = m.key.remoteJid;
        const botNumber = jidNormalizedUser(conn.user.id);
        const isMe = m.key.fromMe; // Message envoyé par le compte du bot lui-même
        
        const type = getContentType(m.message);
        const body = (type === 'conversation') ? m.message.conversation : 
                     (type === 'extendedTextMessage') ? m.message.extendedTextMessage.text : 
                     (type === 'imageMessage') ? m.message.imageMessage.caption : '';

        // --- GESTION DES RÉPONSES AUX CHOIX (1, 2, 3) ---
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

        // --- GESTION DES COMMANDES ---
        if (body.startsWith(config.prefix)) {
            const args = body.slice(config.prefix.length).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const command = commands.get(cmdName) || [...commands.values()].find(cmd => cmd.aliases && cmd.aliases.includes(cmdName));

            if (command) {
                // Définition propre du JID du propriétaire (config)
                const ownerJid = config.ownerNumber.includes('@') ? config.ownerNumber : `${config.ownerNumber}@s.whatsapp.net`;
                
                // DROITS : Est propriétaire si (C'est moi 'fromMe') OU (C'est le numéro configuré) OU (C'est le bot lui-même)
                const isOwner = isMe || (from === jidNormalizedUser(ownerJid)) || (from === botNumber);
                
                // GESTION DU MODE PRIVÉ
                const isPrivateMode = config.privateMode === true || config.privateMode === "true";
                
                // En mode privé, on bloque si ce n'est PAS le propriétaire
                if (isPrivateMode && !isOwner) return;

                try {
                    await command.execute(conn, m, args);
                } catch (err) {
                    console.error(`❌ Erreur commande ${cmdName}:`, err);
                }
            }
        }
    });

    // 4. ÉVÉNEMENTS DE CONNEXION
    conn.ev.on('connection.update', async (update) => {
        const { connection } = update;
        if (connection === 'open') {
            const welcomeMsg = `🚀 *${config.botName}* 𝐜𝐨𝐧𝐧𝐞𝐜𝐭𝐞𝐫 𝐚𝐯𝐞𝐜 𝐬𝐮𝐜𝐜𝐞𝐬𝐬 ✅ !\n\nPrefix : ${config.prefix}\nMode : ${config.privateMode === "true" ? 'Privé 🔒' : 'Public 🌍'}`;
            
            // Notification de succès à soi-même
            await conn.sendMessage(conn.user.id, { 
                image: { url: config.botLogo }, 
                caption: welcomeMsg 
            }).catch(e => console.log("Erreur message bienvenue:", e));
        }
    });
};

module.exports = { handleEvents };
