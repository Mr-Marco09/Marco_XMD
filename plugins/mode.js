// plugins/mode.js
module.exports = {
    name: "mode",
    aliases: ["public", "private"],
    execute: async (conn, m, args) => {
        const from = m.key.remoteJid;
        const text = args[0]?.toLowerCase();

        if (text === "public") {
            config.privateMode = "false";
            await conn.sendMessage(from, { text: "🌍 Bot passé en mode **PUBLIC**." });
        } else if (text === "private") {
            config.privateMode = "true";
            await conn.sendMessage(from, { text: "🔒 Bot passé en mode **PRIVÉ**." });
        } else {
            await conn.sendMessage(from, { text: `Usage: ${config.prefix}mode public/private` });
        }
    }
};
