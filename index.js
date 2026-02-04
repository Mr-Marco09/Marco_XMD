////index.js///////

const { 
    default: makeWASocket, useMultiFileAuthState, DisconnectReason, 
    fetchLatestWaWebVersion, Browsers, makeCacheableSignalKeyStore 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs-extra");
const path = require("path");
const config = require("./config.json");
const { startServer } = require("./server");
const { handleEvents } = require("./events");

const commands = new Map();
let serverStarted = false; // Sécurité anti-crash pour Render

// --- CHARGEMENT DES PLUGINS ---
const loadPlugins = () => {
    const pluginPath = path.join(__dirname, "plugins");
    if (!fs.existsSync(pluginPath)) fs.mkdirSync(pluginPath);

    fs.readdirSync(pluginPath).forEach((file) => {
        if (file.endsWith(".js")) {
            try {
                const plugin = require(`./plugins/${file}`);
                if (plugin.name) {
                    commands.set(plugin.name, plugin);
                }
            } catch (e) {
                console.error(`❌ Erreur plugin ${file}:`, e.message);
            }
        }
    });
    console.log(`📦 [${config.botName}] : ${commands.size} Plugins opérationnels`);
};

async function startBot() {
    // Gestion de l'authentification
    const { state, saveCreds } = await useMultiFileAuthState('session');
    
    // Récupération de la version WA
    const { version } = await fetchLatestWaWebVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

    const marco = makeWASocket({
        version,
        logger: pino({ level: "fatal" }),
        printQRInTerminal: false,
        browser: Browsers.ubuntu("Chrome"),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        }
    });

    // --- LANCEMENT UNIQUE (IMPORTANT) ---
    if (!serverStarted) {
        loadPlugins();
        startServer(marco); // Lance Express une seule fois
        serverStarted = true;
    }

    // Gestion des messages et événements
    handleEvents(marco, saveCreds, commands);

    // --- GESTION DE LA CONNEXION ---
    marco.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'open') {
            console.log(`✅ ${config.botName} est en ligne !`);
            console.log(`👤 Proprio : ${config.ownerName}`);
        }
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`⚠️ Connexion perdue. Reconnexion : ${shouldReconnect}`);
            if (shouldReconnect) startBot();
        }
    });
}

// Lancement du bot avec gestion d'erreur globale
startBot().catch(err => {
    console.error("Erreur critique au démarrage :", err);
});
