require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

async function checkBuckets() {
  console.log("Checking Supabase Buckets...");
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error("Error listing buckets:", error);
  } else {
    console.log("Buckets found:");
    data.forEach(b => console.log(`- ${b.name} (public: ${b.public})`));
  }
}

checkBuckets();
