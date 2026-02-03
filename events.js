const { getContentType, jidNormalizedUser } = require("@whiskeysockets/baileys");
const config = require("./config.json");

const handleEvents = (conn, saveCreds, commands) => {
    conn.ev.on('creds.update', saveCreds);
    conn.replyMemory = {};

    conn.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const from = m.key.remoteJid;
        const botNumber = jidNormalizedUser(conn.user.id);
        const type = getContentType(m.message);
        const body = (type === 'conversation') ? m.message.conversation : (type === 'extendedTextMessage') ? m.message.extendedTextMessage.text : '';

        // Commande simple
        if (body.startsWith(config.prefix)) {
            const args = body.slice(config.prefix.length).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const command = commands.get(cmdName);

            if (command) {
                const isOwner = from.includes(botNumber.split('@')[0]) || from.includes(config.ownerNumber);
                if (config.privateMode === "true" && !isOwner) return;
                await command.execute(conn, m, args);
            }
        }
    });

    conn.ev.on('connection.update', async ({ connection }) => {
        if (connection === 'open') {
            await conn.sendMessage(jidNormalizedUser(conn.user.id), { 
                text: `🚀 *${config.botName}* Connecté !\n\nUtilisez le préfixe: ${config.prefix}` 
            });
        }
    });
};

module.exports = { handleEvents };
