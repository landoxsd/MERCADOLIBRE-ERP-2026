async function testAttributes() {
  const res = await fetch('https://api.mercadolibre.com/categories/MLV446358/attributes');
  const attributes = await res.json();
  
  const required = attributes.filter(a => a.tags && a.tags.required);
  console.log("REQUIRED ATTRIBUTES FOR MLV446358:");
  required.forEach(a => {
    console.log(`- ID: ${a.id}`);
    console.log(`  Name: ${a.name}`);
    console.log(`  Value Type: ${a.value_type}`);
    if (a.values && a.values.length > 0) {
      console.log(`  Allowed Values: ${a.values.map(v => v.name).join(', ')}`);
    }
  });
}

testAttributes();
