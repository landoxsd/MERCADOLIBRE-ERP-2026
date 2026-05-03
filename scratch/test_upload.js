require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpload() {
  console.log("Testing upload to product-photos bucket...");
  const { data, error } = await supabase.storage
    .from('product-photos')
    .upload('test.txt', 'Hello World', {
      contentType: 'text/plain',
      upsert: true
    });

  if (error) {
    console.error("❌ Upload failed:", error.message);
  } else {
    console.log("✅ Upload successful:", data);
  }
}

testUpload();
