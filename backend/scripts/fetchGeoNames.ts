/**
 * Script to fetch Bulgarian cities and neighborhoods from GeoNames API
 * and populate the locations table
 * 
 * Run with: npx ts-node scripts/fetchGeoNames.ts
 */

import fetch from 'node-fetch';
import { Pool } from 'pg';

const GEONAMES_USERNAME = 'mirchev92';
const BASE_URL = 'https://secure.geonames.org';

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'servicetext_pro',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'C58acfd5c!',
});

interface GeoNameEntry {
  geonameId: number;
  name: string;
  toponymName: string;
  lat: string;
  lng: string;
  population: number;
  adminName1: string;
  fcode: string;
}

interface GeoNamesResponse {
  totalResultsCount?: number;
  geonames: GeoNameEntry[];
}

// Bulgarian name mappings for common cities
const BULGARIAN_NAMES: Record<string, string> = {
  'Sofia': 'София',
  'Plovdiv': 'Пловдив',
  'Varna': 'Варна',
  'Burgas': 'Бургас',
  'Rousse': 'Русе',
  'Ruse': 'Русе',
  'Stara Zagora': 'Стара Загора',
  'Pleven': 'Плевен',
  'Sliven': 'Сливен',
  'Dobrich': 'Добрич',
  'Shumen': 'Шумен',
  'Pernik': 'Перник',
  'Haskovo': 'Хасково',
  'Yambol': 'Ямбол',
  'Pazardzhik': 'Пазарджик',
  'Blagoevgrad': 'Благоевград',
  'Veliko Tarnovo': 'Велико Търново',
  'Vratsa': 'Враца',
  'Gabrovo': 'Габрово',
  'Asenovgrad': 'Асеновград',
  'Vidin': 'Видин',
  'Kazanlak': 'Казанлък',
  'Kardzhali': 'Кърджали',
  'Kyustendil': 'Кюстендил',
  'Montana': 'Монтана',
  'Targovishte': 'Търговище',
  'Lovech': 'Ловеч',
  'Silistra': 'Силистра',
  'Razgrad': 'Разград',
  'Dupnitsa': 'Дупница',
  'Smolyan': 'Смолян',
  // Sofia neighborhoods
  'Mladost': 'Младост',
  'Lozenets': 'Лозенец',
  'Vitosha': 'Витоша',
  'Lyulin': 'Люлин',
  'Nadezhda': 'Надежда',
  'Krasno Selo': 'Красно село',
  'Ovcha Kupel': 'Овча купел',
  'Banishora': 'Банишора',
  'Ilinden': 'Илинден',
  'Poduene': 'Подуене',
  'Slatina': 'Слатина',
  'Izgrev': 'Изгрев',
  'Studentski Grad': 'Студентски град',
  'Druzhba': 'Дружба',
  'Dianabad': 'Дианабад',
  'Geo Milev': 'Гео Милев',
  'Reduta': 'Редута',
  'Hipodruma': 'Хиподрума',
  'Borovo': 'Борово',
  'Boyana': 'Бояна',
  'Dragalevtsi': 'Драгалевци',
  'Simeonovo': 'Симеоново',
  'Knyazhevo': 'Княжево',
  'Gorna Banya': 'Горна баня',
  'Obelya': 'Обеля',
  'Vrabnitsa': 'Връбница',
  'Orlandovtsi': 'Орландовци',
  'Suhodol': 'Суходол',
  'Malinova Dolina': 'Малинова долина',
  'Manastirski Livadi': 'Манастирски ливади',
  'Strelbishte': 'Стрелбище',
  'Hladilnika': 'Хладилника',
  'Iztok': 'Изток',
  'Oborishte': 'Оборище',
  'Serdika': 'Сердика',
  'Sredets': 'Средец',
  'Triaditsa': 'Триадица',
  'Vazrazhdane': 'Възраждане',
};

function getBulgarianName(englishName: string): string {
  return BULGARIAN_NAMES[englishName] || englishName;
}

async function fetchCities(): Promise<GeoNameEntry[]> {
  console.log('📍 Fetching Bulgarian cities...');
  
  // Fetch major cities (PPLA = first-order admin division seats, PPLC = capital)
  const url = `${BASE_URL}/searchJSON?country=BG&featureClass=P&featureCode=PPLA&featureCode=PPLA2&featureCode=PPLC&maxRows=100&username=${GEONAMES_USERNAME}`;
  
  const response = await fetch(url);
  const data = await response.json() as GeoNamesResponse;
  
  console.log(`✅ Found ${data.geonames?.length || 0} cities`);
  return data.geonames || [];
}

async function fetchNeighborhoods(cityGeonameId: number, cityName: string): Promise<GeoNameEntry[]> {
  console.log(`📍 Fetching neighborhoods for ${cityName} (ID: ${cityGeonameId})...`);
  
  // Fetch children (neighborhoods) of the city
  const url = `${BASE_URL}/childrenJSON?geonameId=${cityGeonameId}&username=${GEONAMES_USERNAME}`;
  
  const response = await fetch(url);
  const data = await response.json() as GeoNamesResponse;
  
  // Filter only PPLX (section of populated place) which are neighborhoods
  const neighborhoods = (data.geonames || []).filter(g => g.fcode === 'PPLX');
  
  console.log(`✅ Found ${neighborhoods.length} neighborhoods for ${cityName}`);
  return neighborhoods;
}

async function insertLocation(
  geonameId: number,
  name: string,
  nameBg: string,
  type: 'city' | 'neighborhood',
  parentCity: string | null,
  parentGeonameId: number | null,
  latitude: number,
  longitude: number,
  population: number,
  adminName: string
): Promise<void> {
  const query = `
    INSERT INTO locations (geoname_id, name, name_bg, type, parent_city, parent_geoname_id, latitude, longitude, population, admin_name)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (geoname_id) DO UPDATE SET
      name = EXCLUDED.name,
      name_bg = EXCLUDED.name_bg,
      type = EXCLUDED.type,
      parent_city = EXCLUDED.parent_city,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      population = EXCLUDED.population,
      admin_name = EXCLUDED.admin_name,
      updated_at = CURRENT_TIMESTAMP
  `;
  
  await pool.query(query, [
    geonameId,
    name,
    nameBg,
    type,
    parentCity,
    parentGeonameId,
    latitude,
    longitude,
    population,
    adminName
  ]);
}

async function main() {
  console.log('🚀 Starting GeoNames data fetch...\n');
  
  try {
    // Fetch all Bulgarian cities
    const cities = await fetchCities();
    
    // Insert cities
    for (const city of cities) {
      const nameBg = getBulgarianName(city.name);
      await insertLocation(
        city.geonameId,
        city.name,
        nameBg,
        'city',
        null,
        null,
        parseFloat(city.lat),
        parseFloat(city.lng),
        city.population,
        city.adminName1
      );
      console.log(`  ✓ Inserted city: ${city.name} (${nameBg})`);
    }
    
    // Fetch neighborhoods for major cities
    const majorCities = [
      { id: 727011, name: 'Sofia' },      // София
      { id: 728193, name: 'Plovdiv' },    // Пловдив
      { id: 726050, name: 'Varna' },      // Варна
      { id: 732770, name: 'Burgas' },     // Бургас
    ];
    
    for (const city of majorCities) {
      const neighborhoods = await fetchNeighborhoods(city.id, city.name);
      
      for (const neighborhood of neighborhoods) {
        const nameBg = getBulgarianName(neighborhood.name);
        await insertLocation(
          neighborhood.geonameId,
          neighborhood.name,
          nameBg,
          'neighborhood',
          city.name,
          city.id,
          parseFloat(neighborhood.lat),
          parseFloat(neighborhood.lng),
          neighborhood.population,
          neighborhood.adminName1
        );
        console.log(`    ✓ Inserted neighborhood: ${neighborhood.name} (${nameBg}) in ${city.name}`);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Get counts
    const cityCount = await pool.query("SELECT COUNT(*) FROM locations WHERE type = 'city'");
    const neighborhoodCount = await pool.query("SELECT COUNT(*) FROM locations WHERE type = 'neighborhood'");
    
    console.log('\n✅ GeoNames data fetch complete!');
    console.log(`   Cities: ${cityCount.rows[0].count}`);
    console.log(`   Neighborhoods: ${neighborhoodCount.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error fetching GeoNames data:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
