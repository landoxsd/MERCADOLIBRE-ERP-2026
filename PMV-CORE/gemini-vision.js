const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function extractReceiptData(imageBuffer, mimeType = "image/jpeg") {
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

  const prompt = `
    Analiza esta imagen de un comprobante de pago móvil o transferencia bancaria de Venezuela.
    Extrae los siguientes datos en formato JSON puro:
    - reference: Solo los números de la referencia o número de confirmación.
    - amount: El monto numérico (usa punto para decimales, ejemplo: 150.50).
    - date: La fecha en formato YYYY-MM-DD.
    - bank: Nombre del banco emisor o receptor mencionado.
    - confidence: Un valor de 0 a 1 indicando qué tan legible es el comprobante.

    Si no encuentras algún dato, pon null. 
    Responde ÚNICAMENTE el objeto JSON, sin bloques de código ni texto adicional.
  `;

  const imagePart = {
    inlineData: {
      data: imageBuffer.toString("base64"),
      mimeType,
    },
  };

  try {
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();
    const jsonStr = text.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Error en Gemini Vision:", error);
    throw new Error("No se pudo procesar la imagen con IA.");
  }
}

module.exports = { extractReceiptData };
