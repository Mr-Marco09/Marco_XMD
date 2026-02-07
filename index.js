const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestWaWebVersion, 
    Browsers, 
    makeCacheableSignalKeyStore 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs-extra");
const path = require("path");
const config = require("./config.json");
const { startServer } = require("./server");
const { handleEvents } = require("./events");

const commands = new Map();
const SESSIONS_PATH = path.join(__dirname, "sessions");

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
                if (plugin.name) {
                    commands.set(plugin.name.toLowerCase(), plugin);
                }
            } catch (e) {
                console.error(`❌ Erreur dans le plugin ${file}:`, e.message);
            }
        }
    });
    console.log(`📦 [SYSTEM] : ${commands.size} Plugins opérationnels`);
};

/**
 * 🤖 DÉMARRAGE D'UNE INSTANCE DE BOT
 */
async function startBotInstance(sessionId) {
    const sessionDir = path.join(SESSIONS_PATH, sessionId);
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    
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

    // Liaison des événements (messages, plugins, etc.)
    handleEvents(marco, saveCreds, commands);

    // Gestion de la connexion et reconnexion
    marco.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log(`✅ Session [${sessionId}] CONNECTÉE`);
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
            if (shouldReconnect) {
                console.log(`🔄 Reconnexion de [${sessionId}]...`);
                startBotInstance(sessionId);
            }
        }
    });

    return marco;
}

/**
 * 🛠 INITIALISATION DU SYSTÈME
 */
async function initSystem() {
    if (!fs.existsSync(SESSIONS_PATH)) fs.mkdirSync(SESSIONS_PATH, { recursive: true });
    
    loadPlugins();

    // IMPORTANT : On passe 'commands' au serveur pour le pairing multi-session
    startServer(commands);

    // Scan et reconnexion automatique des sessions existantes
    const existingSessions = fs.readdirSync(SESSIONS_PATH);
    for (const id of existingSessions) {
        const fullPath = path.join(SESSIONS_PATH, id);
        if (fs.statSync(fullPath).isDirectory()) {
            // On ne lance que si la session contient des clés (évite les dossiers vides)
            if (fs.existsSync(path.join(fullPath, 'creds.json'))) {
                console.log(`⏳ Restauration session : ${id}`);
                await startBotInstance(id);
                // Pause pour éviter le spam serveur
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }
}

initSystem().catch(err => {
    console.error("💥 ERREUR CRITIQUE :", err);
});
