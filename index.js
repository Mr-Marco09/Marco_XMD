const { 
    default: makeWASocket, useMultiFileAuthState, DisconnectReason, 
    fetchLatestWaWebVersion, Browsers, makeCacheableSignalKeyStore 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs-extra");
const path = require("path");
const config = require("./config.json");
const { startServer } = require("./server");
const { handleEvents } = require("./events"); // <-- Importation unique ici

const commands = new Map();
const SESSIONS_PATH = path.join(__dirname, "sessions");
let serverStarted = false;

/**
 * 📦 CHARGEMENT DES PLUGINS
 */
const loadPlugins = () => {
    const pluginPath = path.join(__dirname, "plugins");
    if (!fs.existsSync(pluginPath)) fs.mkdirSync(pluginPath);

    fs.readdirSync(pluginPath).forEach((file) => {
        if (file.endsWith(".js")) {
            try {
                const plugin = require(`./plugins/${file}`);
                if (plugin.name) commands.set(plugin.name, plugin);
            } catch (e) {
                console.error(`❌ Erreur plugin ${file}:`, e.message);
            }
        }
    });
};

/**
 * 🤖 DÉMARRAGE D'UNE INSTANCE (RESTAURATION)
 */
async function startBotInstance(sessionId) {
    const sessionDir = path.join(SESSIONS_PATH, sessionId);
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestWaWebVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

    const marco = makeWASocket({
        version,
        logger: pino({ level: "fatal" }),
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        }
    });

    handleEvents(marco, saveCreds, commands); // Utilisation de handleEvents

    marco.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log(`✅ [SESSION] : ${sessionId} est en ligne !`);
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBotInstance(sessionId);
        }
    });
}

/**
 * 🛠 INITIALISATION DU SYSTÈME
 */
async function initSystem() {
    if (!fs.existsSync(SESSIONS_PATH)) fs.mkdirSync(SESSIONS_PATH, { recursive: true });
    
    loadPlugins();

    // On lance le serveur en passant la Map des commandes et la fonction handleEvents
    if (!serverStarted) {
        startServer(commands, handleEvents); 
        serverStarted = true;
    }

    // Scan et reconnexion automatique uniquement pour les sessions VALIDES
    const existingSessions = fs.readdirSync(SESSIONS_PATH);
    for (const id of existingSessions) {
        const fullPath = path.join(SESSIONS_PATH, id);
        if (fs.statSync(fullPath).isDirectory() && fs.existsSync(path.join(fullPath, 'creds.json'))) {
            console.log(`⏳ Restauration : ${id}`);
            await startBotInstance(id);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

initSystem().catch(err => console.error("💥 CRITICAL ERROR :", err));
