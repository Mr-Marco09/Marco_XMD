const { delay, useMultiFileAuthState, makeWASocket, fetchLatestWaWebVersion, makeCacheableSignalKeyStore, Browsers } = require("@whiskeysockets/baileys");
const pino = require("pino");
const path = require("path");
const fs = require("fs-extra");

module.exports = {
    name: "pair",
    description: "Permet à n'importe qui de lier son compte au bot",
    category: "public",
    async execute(marco, m, args) {
        // Récupération du numéro (soit par argument, soit par mention/reply)
        const text = args.join(" ");
        if (!text) return m.reply("❌ Usage : *.pair 225XXXXXXXX*");

        const cleanNumber = text.replace(/\D/g, '');
        if (cleanNumber.length < 8) return m.reply("❌ Numéro invalide.");

        const sessionPath = path.join(__dirname, "../sessions", cleanNumber);

        // On nettoie si une session morte existe pour ce numéro
        if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true });
        fs.mkdirSync(sessionPath, { recursive: true });

        await m.reply(`⏳ *MARCO-XMD* prépare votre code de connexion pour : ${cleanNumber}...`);

        try {
            const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
            const { version } = await fetchLatestWaWebVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

            const tempSocket = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }),
                browser: ["Ubuntu", "Chrome", "20.0.04"]
            });

            // Sauvegarde cruciale pour les nouvelles sessions
            tempSocket.ev.on('creds.update', saveCreds);

            tempSocket.ev.on('connection.update', async (update) => {
                const { connection, qr, lastDisconnect } = update;

                // MÉTHODE DOCUMENTÉE : Attendre le signal de connexion ou le QR
                if (connection === "connecting" || qr) {
                    await delay(5000); // Stabilisation
                    
                    if (!tempSocket.authState.creds.registered) {
                        try {
                            const code = await tempSocket.requestPairingCode(cleanNumber);
                            const pairingMsg = `✨ *VOTRE CODE DE CONNEXION* ✨\n\n` +
                                             `Saisissez ce code dans WhatsApp :\n` +
                                             `👉 *${code.toUpperCase()}*\n\n` +
                                             `1️⃣ Allez dans Paramètres > Appareils connectés\n` +
                                             `2️⃣ Lier un appareil > Lier avec le numéro\n` +
                                             `⚠️ *Le code expire dans 2 minutes.*`;
                            
                            await marco.sendMessage(m.chat, { text: pairingMsg }, { quoted: m });
                        } catch (err) {
                            console.error("Erreur Pairing Code:", err);
                        }
                    }
                }

                if (connection === 'open') {
                    await marco.sendMessage(m.chat, { text: `✅ *FÉLICITATIONS !*\n\nVotre compte (${cleanNumber}) est maintenant lié au système MARCO-XMD.` }, { quoted: m });
                    // On ne ferme pas, le bot est maintenant actif en parallèle !
                }

                if (connection === 'close') {
                    // Si déconnecté pour une raison autre que déconnexion manuelle, on nettoie si non réussi
                    const code = lastDisconnect?.error?.output?.statusCode;
                    if (code === 401) {
                        fs.rmSync(sessionPath, { recursive: true, force: true });
                    }
                }
            });

        } catch (error) {
            console.error(error);
            m.reply("❌ Échec de la demande. WhatsApp limite peut-être les requêtes pour ce numéro.");
        }
    }
};
