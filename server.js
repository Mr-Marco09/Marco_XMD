const express = require("express");
const path = require("path");
// Imports Baileys spécifiques utilisés dans ce fichier
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    makeCacheableSignalKeyStore, 
    fetchLatestWaWebVersion 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs-extra");

const app = express(); // <-- Déclaration de 'app' accessible à toutes les routes
const PORT = process.env.PORT || 10000;

// La fonction startServer prend maintenant 'handleEvents' en paramètre
const startServer = (commands, handleEvents) => {
    
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'index.html'));
    });

    // --- ROUTE PRINCIPALE POUR LE PAIRING CODE ---
    app.get('/pair', async (req, res) => {
        const num = req.query.number; 
        if (!num) return res.status(400).json({ error: "Numéro requis" });

        const cleanNum = num.replace(/\D/g, ''); 
        const sessionPath = path.join(__dirname, 'sessions', cleanNum);

        if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true });
        fs.mkdirSync(sessionPath, { recursive: true });

        try {
            const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
            const { version } = await fetchLatestWaWebVersion().catch(() => ({ version: }));
            
            const marco = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
                },
                logger: pino({ level: "fatal" }),
                browser: ["Ubuntu", "Chrome", "20.0.04"], 
                printQRInTerminal: false
            });

            // Utilisation de handleEvents passé depuis index.js
            handleEvents(marco, saveCreds, commands);

            // --- ÉVÉNEMENT CRUCIAL POUR DÉCLENCHER LE CODE ---
            marco.ev.on('connection.update', async (update) => {
                const { connection, qr } = update;

                if (connection === "connecting" || qr) {
                    try {
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        
                        if (!marco.authState.creds.registered) {
                            const code = await marco.requestPairingCode(cleanNum);
                            
                            if (!res.headersSent) {
                                console.log(`✅ [SUCCESS] Pairing Code pour ${cleanNum} : ${code}`);
                                res.status(200).json({ code: code });
                            }
                        }
                    } catch (err) {
                        console.error("❌ Erreur lors du requestPairingCode:", err);
                        if (!res.headersSent) res.status(500).json({ error: "WhatsApp a rejeté la demande" });
                    }
                }
            });

        } catch (err) {
            console.error("[CRITICAL ERROR]", err);
            if (!res.headersSent) res.status(500).json({ error: "Erreur système" });
        }
    });
    // --- FIN ROUTE /PAIR ---

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🌍 [${new Date().toLocaleString()}] Serveur Marco xmd en ligne sur le port ${PORT}`);
    });
};

module.exports = { startServer };
