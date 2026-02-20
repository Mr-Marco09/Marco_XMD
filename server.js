const express = require("express");
const path = require("path");
const config = require("./config.json");

const app = express();
const PORT = process.env.PORT || 10000;

const startServer = (sessions, startBot) => {

    // --- Page principale : Design Matrix ---
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'index.html'));
    });

    // --- Endpoint pour générer le pairing code (multi-numéros) ---
    app.get('/pair', async (req, res) => {
        const num = req.query.number;
        if (!num) return res.status(400).json({ error: "Numéro requis" });

        try {
            let marcoInstance = sessions.get(num);

            // Création de la session si elle n'existe pas
            if (!marcoInstance) {
                marcoInstance = await startBot(num);
                sessions.set(num, marcoInstance);
            }

            // Attendre que le socket soit prêt avant de générer le code
            await new Promise((resolve, reject) => {
                if (marcoInstance.ws?.readyState === 1) return resolve();
                const timeout = setTimeout(() => reject(new Error("Socket non prêt")), 10000);
                marcoInstance.ev.once("connection.update", (update) => {
                    if (update.connection === "open") {
                        clearTimeout(timeout);
                        resolve();
                    }
                });
            });

            // Génération du vrai pairing code WhatsApp
            const code = await marcoInstance.requestPairingCode(num);
            res.status(200).json({ code });

        } catch (err) {
            console.error(`Erreur Pairing pour ${num}:`, err);
            res.status(500).json({ error: "Erreur lors de la génération" });
        }
    });

    // --- Lancer le serveur ---
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🌍 Serveur de ${config.botName} en ligne sur le port ${PORT}`);
    });
};

module.exports = { startServer };
