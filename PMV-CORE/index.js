const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { extractReceiptData } = require("./gemini-vision");
const { reconcileAttempt } = require("./reconciler");
const path = require("path");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let lastQr = null;
let lastStatus = 'Desconectado';

// Enviar estado y QR a nuevas conexiones
io.on('connection', (socket) => {
    socket.emit('status', lastStatus);
    if (lastQr) socket.emit('qr', lastQr);
});

// Inicializar WhatsApp con configuración robusta
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './sessions' }),
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1014583151-alpha.html',
    },
    puppeteer: {
        headless: false, // Ahora verás la ventana real de Chrome
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    }
});

// Eventos de WhatsApp
client.on('qr', (qr) => {
    console.log('⚡ QR RECIBIDO. ESCANEA CON TU CELULAR:');
    qrcode.generate(qr, { small: true });
    lastQr = qr;
    lastStatus = 'Esperando QR';
    io.emit('status', lastStatus);
    io.emit('qr', qr);
});

client.on('ready', () => {
    console.log('✅ WhatsApp está listo!');
    lastStatus = 'Online';
    lastQr = null;
    io.emit('status', lastStatus);
});

const ALLOWED_GROUP = "584241782001-1614260242@g.us";

client.on('message_create', async (msg) => {
    try {
        // Solo procesar si es el grupo permitido
        if (msg.from !== ALLOWED_GROUP) return;

        if (msg.hasMedia) {
            const media = await msg.downloadMedia().catch(e => null);

            if (media && media.mimetype.includes('image')) {
                console.log(`📸 Procesando imagen en el grupo autorizado...`);
                
                // Buffer para Gemini
                const buffer = Buffer.from(media.data, 'base64');
                
                // Extraer con IA
                const extraction = await extractReceiptData(buffer, media.mimetype).catch(e => null);

                if (extraction && extraction.amount) {
                    console.log("🤖 IA Extrajo:", extraction);
                    io.emit('new_payment', extraction);

                    // Formatear respuesta
                    const response = `✅ *PAGO DETECTADO*\n\n` +
                                     `📅 *Fecha:* ${extraction.date || 'No detectada'}\n` +
                                     `💰 *Monto:* Bs. ${extraction.amount}\n` +
                                     `🔢 *Referencia:* ${extraction.reference}\n\n` +
                                     `_Verificando disponibilidad en cuenta..._`;

                    // Enviar mensaje al grupo
                    await client.sendMessage(msg.from, response);
                }
            }
        }
    } catch (globalError) {
        console.error("🚨 Error:", globalError.message);
    }
});

// Evitar que el proceso muera por errores no capturados
process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err.message);
});

client.initialize();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Panel de Control en: http://localhost:${PORT}`);
});
