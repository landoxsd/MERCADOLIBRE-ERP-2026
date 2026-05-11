const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

/**
 * Intenta conciliar un intento de pago específico.
 * @param {number} attemptId - ID del registro en payment_attempts
 */
async function reconcileAttempt(attemptId) {
  // 1. Obtener el intento de pago
  const { data: attempt, error: attError } = await supabase
    .from("payment_attempts")
    .select("*")
    .eq("id", attemptId)
    .single();

  if (attError || !attempt) {
    console.error("❌ No se encontró el intento de pago:", attemptId);
    return;
  }

  console.log(`🔍 Buscando match para: Ref ${attempt.extracted_reference}, Monto ${attempt.extracted_amount}`);

  // 2. Buscar en movimientos bancarios
  // Regla: Monto exacto y referencia contenida (los bancos a veces truncan referencias)
  const { data: movements, error: movError } = await supabase
    .from("bank_statements_staging")
    .select("*")
    .eq("amount", attempt.extracted_amount)
    .eq("reconciliation_status", "UNMATCHED");

  if (movError) {
    console.error("❌ Error buscando en banco:", movError);
    return;
  }

  // 3. Verificar referencia
  const match = movements.find(m => 
    m.reference_number.includes(attempt.extracted_reference) || 
    attempt.extracted_reference.includes(m.reference_number)
  );

  if (match) {
    console.log("✅ MATCH ENCONTRADO!");
    
    // 4. Marcar ambos como conciliados
    await supabase.from("bank_statements_staging")
      .update({ reconciliation_status: "MATCHED" })
      .eq("id", match.id);

    await supabase.from("payment_attempts")
      .update({ status: "matched" })
      .eq("id", attempt.id);

    return { success: true, matchId: match.id };
  } else {
    console.log("⚠️ No se encontró un movimiento que coincida perfectamente.");
    return { success: false };
  }
}

module.exports = { reconcileAttempt };
