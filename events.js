const { getContentType, jidNormalizedUser } = require("@whiskeysockets/baileys");
const config = require("./config.json");

const LOGO = config.botLogo;

const handleEvents = (conn, saveCreds, commands) => {
    
    conn.ev.on('creds.update', saveCreds);

    // Initialisation de la mémoire des réponses (contextuelle)
    conn.reply = conn.reply || {};

    conn.ev.on('messages.upsert', async (mek) => {
        const m = mek.messages[0];
        if (!m || !m.message) return;

        const from = m.key.remoteJid;
        const type = getContentType(m.message);
        const body = (type === 'conversation') ? m.message.conversation : 
                     (type === 'extendedTextMessage') ? m.message.extendedTextMessage.text : 
                     (type === 'imageMessage') ? m.message.imageMessage.caption : '';

        // --- 1. GESTION DES RÉPONSES CONTEXTUELLES (1, 2, 3) ---
        const quotedMsgId = m.message?.extendedTextMessage?.contextInfo?.stanzaId;

        if (quotedMsgId && conn.reply[quotedMsgId]) {
            const { downloadUrl, title } = conn.reply[quotedMsgId];
            
            if (["1", "2", "3"].includes(body)) {
                await conn.sendMessage(from, { react: { text: "⏳", key: m.key } });

                if (body === "1") {
                    await conn.sendMessage(from, { audio: { url: downloadUrl }, mimetype: "audio/mpeg" }, { quoted: m });
                } else if (body === "2") {
                    await conn.sendMessage(from, { document: { url: downloadUrl }, mimetype: "audio/mpeg", fileName: `${title}.mp3` }, { quoted: m });
                } else if (body === "3") {
                    await conn.sendMessage(from, { audio: { url: downloadUrl }, mimetype: "audio/mpeg", ptt: true }, { quoted: m });
                }

                await conn.sendMessage(from, { react: { text: "✅", key: m.key } });
                return; // On stoppe ici pour éviter de traiter cela comme une commande
            }
        }

        // --- 2. GESTION DES STATUTS ---
        if (from === 'status@broadcast') {
            if (config.AUTO_READ_STATUS === "true") await conn.readMessages([m.key]);
            return; 
        }

        // --- 3. GESTION DES COMMANDES ---
        if (body.startsWith(config.prefix)) {
            const args = body.slice(config.prefix.length).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const command = commands.get(cmdName);

            if (command) {
                if (config.privateMode === true && from !== config.ownerNumber + "@s.whatsapp.net") return;
                // Note: on passe 'm' (le message entier) pour le plugin
                await command.execute(conn, m, args);
            }
        }
    });

    // --- WELCOME ---
    conn.ev.on('group-participants.update', async (anu) => {
        const participant = anu.participants[0];
        const jid = participant.split('@')[0];
        try {
            if (anu.action === 'add') {
                await conn.sendMessage(anu.id, { 
                    image: { url: LOGO }, 
                    caption: `Bienvenue @${jid} dans la team ${config.botName} ! 🛡️`, 
                    mentions: [participant] 
                });
            }
        } catch (e) { console.error("Erreur Welcome:", e); }
    });

    // --- MESSAGE DE CONNEXION ---
    conn.ev.on('connection.update', async ({ connection }) => {
        if (connection === 'open') {
            const msg = `🚀 *${config.botName}* en ligne !\n\nPrefix: ${config.prefix}\nProprio: ${config.ownerName}`;
            await conn.sendMessage(config.ownerNumber + "@s.whatsapp.net", { image: { url: LOGO }, caption: msg });
        }
    });
};

module.exports = { handleEvents };
