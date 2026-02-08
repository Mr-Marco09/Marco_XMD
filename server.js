app.get('/pair', async (req, res) => {
    const num = req.query.number; 
    if (!num) return res.status(400).json({ error: "Numéro requis" });

    const cleanNum = num.replace(/\D/g, '');
    const sessionPath = path.join(__dirname, 'sessions', cleanNum);

    // Nettoyage impératif pour forcer un nouveau code
    if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true });
    fs.mkdirSync(sessionPath, { recursive: true });

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
            browser: ["Ubuntu", "Chrome", "20.0.04"], 
            printQRInTerminal: false
        });

        // --- APPLICATION DE LA MÉTHODE DOCUMENTÉE ---
        marco.ev.on('connection.update', async (update) => {
            const { connection, qr } = update;

            // On attend l'état "connecting" OU la présence du flux QR pour injecter le code
            if (connection === "connecting" || qr) {
                try {
                    // Petit délai pour laisser le socket se stabiliser sur Render
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

            if (connection === 'open') {
                console.log(`📡 Session ${cleanNum} activée avec succès !`);
            }
        });

        handleEvents(marco, saveCreds, commands);

    } catch (err) {
        console.error("[CRITICAL ERROR]", err);
        if (!res.headersSent) res.status(500).json({ error: "Erreur système" });
    }
});
