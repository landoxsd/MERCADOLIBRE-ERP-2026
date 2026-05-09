
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMappings() {
  const { data: mappings, error: mapError } = await supabase
    .from('category_mappings')
    .select('*');

  if (mapError) {
    console.error('Error fetching mappings:', mapError);
    return;
  }

  console.log('--- Current Mappings ---');
  mappings.forEach(m => {
    console.log(`Profit: ${m.internal_name} -> ML: ${m.ml_category_name} (${m.ml_category_id})`);
  });
  console.log('------------------------');
}

checkMappings();
