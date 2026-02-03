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

// 1. CHARGEMENT DES PLUGINS (Une seule fois en mémoire)
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
    console.log(`📦 System : ${commands.size} Plugins chargés`);
};

// 2. FONCTION POUR DÉMARRER UNE INSTANCE (Multi-session)
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

    // Liaison des événements pour ce bot spécifique
    handleEvents(marco, saveCreds, commands);

    marco.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'open') {
            console.log(`✅ Session [${sessionId}] est en ligne !`);
        }
        if (connection === 'close') {
            // Reconnexion automatique si ce n'est pas une déconnexion volontaire
            startBotInstance(sessionId);
        }
    });

    return marco;
}

// 3. LANCEMENT GLOBAL
async function initSystem() {
    if (!fs.existsSync(SESSIONS_PATH)) fs.mkdirSync(SESSIONS_PATH);
    
    loadPlugins();

    // Lancer le serveur Express en lui passant la fonction de création d'instance
    startServer(startBotInstance);

    // Reconnecter toutes les sessions existantes dans le dossier /sessions
    const existingSessions = fs.readdirSync(SESSIONS_PATH);
    for (const id of existingSessions) {
        if (fs.statSync(path.join(SESSIONS_PATH, id)).isDirectory()) {
            await startBotInstance(id);
        }
    }
}

initSystem().catch(err => console.error("Erreur critique :", err));
