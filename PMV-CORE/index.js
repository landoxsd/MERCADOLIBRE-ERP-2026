const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { extractReceiptData } = require("./gemini-vision");
const { reconcileAttempt } = require("./reconciler");
const { syncBanesco } = require("./banesco-sync");
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

// Usar IDs configurables desde el .env
const ALLOWED_GROUP = process.env.WHATSAPP_GROUP_ID;
const SUPPORT_ID = process.env.WHATSAPP_SUPPORT_ID;

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

client.on('message_create', async (msg) => {
    try {
        // Solo procesar si es el grupo permitido
        if (msg.from !== ALLOWED_GROUP) return;

        if (msg.hasMedia) {
            const media = await msg.downloadMedia().catch(e => null);

            if (media && media.mimetype.includes('image')) {
                console.log(`📸 Procesando imagen en el grupo autorizado...`);
                
                const buffer = Buffer.from(media.data, 'base64');
                const extraction = await extractReceiptData(buffer, media.mimetype).catch(e => null);

                if (extraction && extraction.amount) {
                    console.log("🤖 IA Extrajo:", extraction);
                    io.emit('new_payment', extraction);

                    // 1. Guardar Intento en Supabase
                    const { data: attempt, error: dbError } = await supabase
                        .from("payment_attempts")
                        .insert({
                            whatsapp_phone: msg.author || msg.from,
                            extracted_reference: String(extraction.reference),
                            extracted_amount: extraction.amount,
                            extracted_date: extraction.date,
                            extraction_confidence: extraction.confidence,
                            raw_ai_response: extraction,
                            status: 'pending'
                        })
                        .select()
                        .single();

                    if (dbError) {
                        console.error("❌ Error guardando intento:", dbError.message);
                        return;
                    }

                    // 2. Intentar Conciliación Inmediata
                    console.log(`🔍 Buscando match para Ref: ${extraction.reference}...`);
                    const reconResult = await reconcileAttempt(attempt.id);

                    // 3. Formatear respuesta según resultado
                    let response = `✅ *PAGO DETECTADO*\n\n` +
                                   `💰 *Monto:* Bs. ${extraction.amount}\n` +
                                   `🔢 *Referencia:* ${extraction.reference}\n\n`;

                    if (reconResult && reconResult.success) {
                        response += `🟢 *ESTADO:* ¡CONCILIADO! El dinero ya está en la cuenta.`;
                    } else {
                        response += `⏳ *ESTADO:* Pendiente. Aún no aparece en el banco (o los datos no coinciden exactamente).`;
                    }

                    // Enviar mensaje al grupo
                    await client.sendMessage(msg.from, response);
                }
            }
        }
    } catch (globalError) {
        console.error("🚨 Error:", globalError.message);
    }
});

app.use(express.json());

// Endpoint para obtener movimientos del banco
app.get("/movements", async (req, res) => {
    const { data, error } = await supabase
        .from("bank_statements_staging")
        .select("*")
        .order("operation_date", { ascending: false })
        .limit(20);
    
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Endpoint para obtener intentos de pago
app.get("/attempts", async (req, res) => {
    const { data, error } = await supabase
        .from("payment_attempts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
    
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Endpoint para recibir notificaciones de otros scripts
app.post("/notify", async (req, res) => {
    const { message, type } = req.body;
    if (!message) return res.status(400).json({ error: "No message provided" });

    try {
        // Si es una sincronización exitosa, avisamos al dashboard para que refresque
        if (type === 'BANK_SYNC_COMPLETE') {
            io.emit('refresh_bank_data');
        }

        const target = message.includes('⚠️') ? SUPPORT_ID : ALLOWED_GROUP;
        await client.sendMessage(target, `🤖 *AVISO DEL SISTEMA*\n\n${message}`);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

client.initialize();

// --- CICLO INFINITO DE BANESCO (MODO INDUSTRIAL) ---
async function startInfiniteBankCycle() {
    console.log("♾️ Ciclo infinito de Banesco activado.");
    
    while (true) {
        try {
            console.log("🕒 Iniciando sincronización automática...");
            await syncBanesco();
            console.log("💤 Ciclo completado. Esperando 2 minutos para el próximo latido...");
        } catch (e) {
            console.error("❌ Error en el ciclo bancario:", e.message);
        }
        
        // Espera de 2 minutos (120,000 ms) antes de la siguiente vuelta
        await new Promise(resolve => setTimeout(resolve, 2 * 60 * 1000));
    }
}

// Arrancar el ciclo 30 segundos después del inicio del servidor
setTimeout(() => startInfiniteBankCycle(), 30000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Panel de Control en: http://localhost:${PORT}`);
});
