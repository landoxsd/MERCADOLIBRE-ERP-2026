require('dotenv').config();
const MELI_BASE_URL = "https://api.mercadolibre.com";

async function checkToken(token) {
  const res = await fetch(`${MELI_BASE_URL}/users/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  console.log("--- TOKEN INFO ---");
  console.log("ID:", data.id);
  console.log("Nickname:", data.nickname);
  console.log("Site:", data.site_id);
  console.log("Scopes:", data.scopes); // Some tokens have scopes here
  console.log("Full data:", JSON.stringify(data, null, 2));
}

// Para usar esto necesito un token. 
// Lo obtendré de la DB si puedo.
console.log("Script listo. Necesita token.");
