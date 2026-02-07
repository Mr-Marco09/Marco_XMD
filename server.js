/////// server.js (OPTIMISÉ POUR RENDER) ////////

const express = require("express");
const path = require("path");
const { default: makeWASocket, useMultiFileAuthState, Browsers, makeCacheableSignalKeyStore, fetchLatestWaWebVersion } = require("@whiskeysockets/baileys");
const pino = require("pino");
const { handleEvents } = require("./events");
const fs = require("fs-extra");

const app = express();
const PORT = process.env.PORT || 10000;

const startServer = (commands) => {
    
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'index.html'));
    });

    app.get('/pair', async (req, res) => {
        const num = req.query.number; 
        if (!num) return res.status(400).json({ error: "Numéro requis" });

        const cleanNum = num.replace(/\D/g, '');
        const sessionPath = path.join(__dirname, 'sessions', cleanNum);

        // SÉCURITÉ : Créer le dossier s'il n'existe pas
        if (!fs.existsSync(sessionPath)) {
            fs.mkdirSync(sessionPath, { recursive: true });
        }

        console.log(`[PAIRING] Tentative pour le numéro : ${cleanNum}`);

        try {
            const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
            const { version } = await fetchLatestWaWebVersion().catch(() => ({ version: [2, 3000, 1015901307] }));
            
            const marco = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
                },
                logger: pino({ level: "fatal" }),
                browser: Browsers.macOS("Desktop"), // macOS est parfois plus stable pour le pairing sur Render
                printQRInTerminal: false
            });

            handleEvents(marco, saveCreds, commands);

            // Augmentation du délai à 10s pour Render (Cloud plus lent)
            setTimeout(async () => {
                try {
                    console.log(`[PAIRING] Demande du code à WhatsApp...`);
                    const code = await marco.requestPairingCode(cleanNum);
                    
                    if (!res.headersSent) {
                        console.log(`[PAIRING] Code généré avec succès : ${code}`);
                        res.status(200).json({ code: code });
                    }
                } catch (pairErr) {
                    console.error("[PAIRING ERROR]", pairErr.message);
                    if (!res.headersSent) res.status(500).json({ error: "Échec du pairing. Réessayez." });
                }
            }, 10000); 

        } catch (err) {
            console.error("[SERVER ERROR]", err);
            if (!res.headersSent) res.status(500).json({ error: "Erreur système" });
        }
    });

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🌍 [${new Date().toLocaleString()}] Serveur Marco xmd en ligne sur le port ${PORT}`);
    });
};

module.exports = { startServer };
