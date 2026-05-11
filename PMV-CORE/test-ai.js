const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

async function testConnection() {
  console.log("🚀 Probando conexión con Gemini...");
  
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.includes("tu_api_key")) {
    console.error("❌ Error: No se ha configurado la GEMINI_API_KEY en el archivo .env");
    return;
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

  try {
    const result = await model.generateContent("Hola Gemini, confirma que recibes este mensaje para el proyecto PMV-CORE");
    const response = await result.response;
    console.log("✅ Conexión exitosa!");
    console.log("Respuesta de la IA:", response.text());
  } catch (error) {
    console.error("❌ Falló la conexión con Gemini:");
    console.error(error.message);
  }
}

testConnection();
