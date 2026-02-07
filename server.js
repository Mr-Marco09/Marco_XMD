/////// server.js (MULTI-SESSION CORRECTED) ////////

const express = require("express");
const path = require("path");
const { default: makeWASocket, useMultiFileAuthState, Browsers, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const pino = require("pino");
const { handleEvents } = require("./events"); // Import nécessaire pour activer le bot

const app = express();
const PORT = process.env.PORT || 10000;

const startServer = (commands) => { // On passe 'commands' pour les plugins
    
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'index.html'));
    });

    app.get('/pair', async (req, res) => {
        const num = req.query.number; 
        if (!num) return res.status(400).json({ error: "Numéro requis" });

        // 1. Nettoyage du numéro et création du dossier de session
        const cleanNum = num.replace(/\D/g, '');
        const sessionPath = path.join(__dirname, 'sessions', cleanNum);

        try {
            // 2. Initialisation Auth
            const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
            
            const marco = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
                },
                logger: pino({ level: "fatal" }),
                browser: Browsers.ubuntu("Chrome"),
                printQRInTerminal: false
            });

            // 3. Liaison immédiate des événements (Important pour que le bot marche après le pairing)
            handleEvents(marco, saveCreds, commands);

            // 4. Demande du code après un petit délai de socket
            setTimeout(async () => {
                try {
                    if (!marco.authState.creds.registered) {
                        const code = await marco.requestPairingCode(cleanNum);
                        if (!res.headersSent) {
                            res.status(200).json({ code: code });
                        }
                    } else {
                        res.status(200).json({ code: "Déjà connecté" });
                    }
                } catch (pairErr) {
                    console.error("Pairing Error:", pairErr);
                    if (!res.headersSent) res.status(500).json({ error: "Échec du pairing" });
                }
            }, 5000); // 5 secondes pour être sûr que le socket est prêt

        } catch (err) {
            console.error("Erreur Serveur:", err);
            if (!res.headersSent) res.status(500).json({ error: "Erreur système" });
        }
    });

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🌍 Système Multi-Bot actif sur le port ${PORT}`);
    });
};

module.exports = { startServer };
