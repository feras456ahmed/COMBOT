const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const { Boom } = require("@hapi/boom");

async function startItashiBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // سنستخدم كود الربط
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
    });

    // --- نظام الربط برقم الهاتف الجديد ---
    if (!sock.authState.creds.registered) {
        console.log("\x1b[1;32m[!] جاري استخراج كود الربط للرقم المخصص...\x1b[0m");
        
        // الرقم الذي طلبته
        const phoneNumber = "4915511425791"; 

        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                console.log(`\n\x1b[1;33m[⚡] كود الربط الخاص بك هو: \x1b[1;37m${code}\x1b[0m\n`);
                console.log("\x1b[1;36m[ℹ] افتح واتساب > الأجهزة المرتبطة > ربط برقم هاتف وأدخل الكود أعلاه.\x1b[0m\n");
            } catch (error) {
                console.error("خطأ في طلب كود الربط:", error);
            }
        }, 3000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
	if (!msg.message) return;

        const from = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        
        if (text.startsWith('.')) {
            const commandName = text.slice(1).trim().split(' ')[0].toLowerCase();
            const commandFile = `./commands/${commandName}.js`;

            if (fs.existsSync(commandFile)) {
                try {
                    const runCommand = require(commandFile);
                    await runCommand(sock, from, msg);
                } catch (err) {
                    console.error(`خطأ في تنفيذ الأمر ${commandName}:`, err);
                }
            }
        }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startItashiBot();
        } else if (connection === 'open') {
            console.log('\x1b[1;32m[✔] تم الاتصال بنجاح! نظام ITASHI جاهز الآن.\x1b[0m');
        }
    });
}

startItashiBot();

