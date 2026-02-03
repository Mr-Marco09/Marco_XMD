///////server.js////////

const express = require("express");
const path = require("path");
const { default: makeWASocket, useMultiFileAuthState, Browsers } = require("@whiskeysockets/baileys");
const pino = require("pino");
const app = express();
const PORT = process.env.PORT || 10000;

// On exporte une fonction qui ne dépend pas d'une instance unique
const startServer = () => {
    
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'index.html'));
    });

    app.get('/pair', async (req, res) => {
        const num = req.query.number; 
        if (!num) return res.status(400).json({ error: "Numéro requis" });

        // 1. Créer un ID de session unique basé sur le numéro
        const sessionId = `session_${num.replace(/\D/g, '')}`;
        const sessionPath = path.join(__dirname, 'sessions', sessionId);

        try {
            // 2. Initialiser une authentification propre à ce numéro
            const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
            
            const tempSocket = makeWASocket({
                auth: state,
                logger: pino({ level: "fatal" }),
                browser: Browsers.ubuntu("Chrome")
            });

            // 3. Sauvegarder les clés dès qu'elles sont générées
            tempSocket.ev.on('creds.update', saveCreds);

            // 4. Demander le code (attendre un court instant que la socket s'initialise)
            setTimeout(async () => {
                try {
                    const code = await tempSocket.requestPairingCode(num);
                    res.status(200).json({ code: code });

                    // 5. Surveiller la connexion pour activer les plugins une fois lié
                    tempSocket.ev.on('connection.update', (update) => {
                        const { connection } = update;
                        if (connection === 'open') {
                            console.log(`✅ Nouveau bot lié : ${num}`);
                            // Ici, tu peux appeler handleEvents(tempSocket, ...) 
                            // pour que ce nouveau bot réponde aux commandes
                        }
                    });
                } catch (pairErr) {
                    res.status(500).json({ error: "Échec du pairing" });
                }
            }, 3000);

        } catch (err) {
            console.error("Erreur Serveur:", err);
            res.status(500).json({ error: "Erreur système" });
        }
    });

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🌍 Système Multi-Bot actif sur le port ${PORT}`);
    });
};

module.exports = { startServer };
