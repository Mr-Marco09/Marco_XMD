const config = require("../config.json");

module.exports = {
    name: "owner",
    category: "general",
    description: "Affiche les informations du propriétaire",
    async execute(conn, m, args) {
        const ownerJid = config.ownerNumber + "@s.whatsapp.net";
        
        // Construction de la VCard (Fiche contact WhatsApp)
        const vcard = 'BEGIN:VCARD\n'
            + 'VERSION:3.0\n' 
            + 'FN:' + config.ownerName + '\n' // Nom complet
            + 'ORG:Marco xmd;\n'             // Organisation
            + 'TEL;type=CELL;type=VOICE;waid=' + config.ownerNumber + ':+' + config.ownerNumber + '\n' // Numéro
            + 'END:VCARD';

        await conn.sendMessage(m.key.remoteJid, {
            contacts: {
                displayName: config.ownerName,
                contacts: [{ vcard }]
            }
        }, { quoted: m });

        await conn.sendMessage(m.key.remoteJid, { 
            text: `👋 Voici mon développeur : *${config.ownerName}*\n\nN'hésitez pas à le contacter si vous avez des questions !` 
        }, { quoted: m });
    }
};
