//////index.js/////////

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
 * Scanne le dossier /plugins et les stocke en mémoire
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
 * 🚀 DÉMARRAGE D'UNE INSTANCE DE BOT
 * @param {string} sessionId - L'identifiant (souvent le numéro de téléphone)
 * @param {string} phoneNumber - Le numéro pour le pairing (optionnel)
 */
async function startBotInstance(sessionId, phoneNumber = null) {
    const sessionDir = path.join(SESSIONS_PATH, sessionId);
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    
    // Version WhatsApp de secours
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

    // Liaison des événements (messages, groupes, etc.)
    handleEvents(marco, saveCreds, commands);

    // Si c'est une nouvelle session et qu'on a un numéro, on génère le code
    if (!state.creds.registered && phoneNumber) {
        setTimeout(async () => {
            try {
                const code = await marco.requestPairingCode(phoneNumber.replace(/\D/g, ''));
                marco.pairingCode = code; // On stocke le code dans l'objet pour le serveur
                console.log(`🔑 Code généré pour ${phoneNumber}: ${code}`);
            } catch (err) {
                console.error("❌ Erreur de génération de code:", err);
            }
        }, 3000);
    }

    // Gestion de la connexion
    marco.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log(`✅ Session [${sessionId}] CONNECTÉE`);
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401; // 401 = Logged Out
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
    // Création du dossier sessions s'il n'existe pas
    if (!fs.existsSync(SESSIONS_PATH)) fs.mkdirSync(SESSIONS_PATH, { recursive: true });
    
    loadPlugins();

    // Lancement du serveur Web (Express)
    startServer(startBotInstance);

    // Scan et reconnexion des sessions existantes
    const existingSessions = fs.readdirSync(SESSIONS_PATH);
    for (const id of existingSessions) {
        if (fs.statSync(path.join(SESSIONS_PATH, id)).isDirectory()) {
            await startBotInstance(id);
        }
    }
}

// Lancement du bot avec gestion d'erreur globale
initSystem().catch(err => {
    console.error("💥 ERREUR CRITIQUE :", err);
});
