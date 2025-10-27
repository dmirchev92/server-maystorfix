const { SQLiteDatabase } = require('./src/models/SQLiteDatabase.ts');

const db = new SQLiteDatabase();

setTimeout(async () => {
  try {
    console.log('🔍 Debugging service providers...');
    
    // Get all providers regardless of filters
    const allProviders = await db.searchProviders({});
    console.log('📊 Total providers in database:', allProviders.length);
    
    if (allProviders.length > 0) {
      console.log('\n🔍 Sample provider data:');
      console.log('Service Category:', allProviders[0].service_category);
      console.log('City:', allProviders[0].city);
      console.log('Business Name:', allProviders[0].business_name);
      
      console.log('\n📋 All providers:');
      allProviders.forEach((p, i) => {
        console.log(`${i + 1}. ${p.business_name} - Category: "${p.service_category}" - City: "${p.city}"`);
      });
    }
    
    // Try searching for handyman (most of your migrated users)
    const handymen = await db.searchProviders({ category: 'handyman' });
    console.log('\n🔨 Handyman providers:', handymen.length);
    
    // Try searching for electrician
    const electricians = await db.searchProviders({ category: 'electrician' });
    console.log('⚡ Electrician providers:', electricians.length);
    
    // Try searching by city
    const sofiaProviders = await db.searchProviders({ city: 'София' });
    console.log('🏙️ Sofia providers:', sofiaProviders.length);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}, 1000);





