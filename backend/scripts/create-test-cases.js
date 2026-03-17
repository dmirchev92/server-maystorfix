const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'servicetext_pro',
  password: 'C58acfd5c!',
  port: 5432,
});

const customerId = '05f95744-ccab-48b6-b7df-0e574b466e77';

const testCases = [
  {
    service_type: 'cat_plumber',
    category: 'cat_plumber',
    description: 'Спукана тръба в банята, спешно се нуждая от водопроводчик',
    budget: '1-125',
    city: 'София',
    neighborhood: 'Лозенец',
    phone: '+359888123456',
    preferred_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    preferred_time: 'morning',
    priority: 'urgent'
  },
  {
    service_type: 'cat_electrician',
    category: 'cat_electrician',
    description: 'Подмяна на електрически табло и осветление в хола',
    budget: '126-250',
    city: 'Пловдив',
    neighborhood: 'Тракия',
    phone: '+359887654321',
    preferred_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    preferred_time: 'afternoon',
    priority: 'normal'
  },
  {
    service_type: 'cat_painter',
    category: 'cat_painter',
    description: 'Боядисване на апартамент 80 кв.м., 2 стаи и коридор',
    budget: '251-400',
    city: 'Варна',
    neighborhood: 'Бриз',
    phone: '+359889111222',
    preferred_date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    preferred_time: 'flexible',
    priority: 'normal'
  },
  {
    service_type: 'cat_hvac',
    category: 'cat_hvac',
    description: 'Монтаж на климатик в спалня, включително тръби и дренаж',
    budget: '401-500',
    city: 'Бургас',
    neighborhood: 'Меден Рудник',
    phone: '+359888333444',
    preferred_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    preferred_time: 'morning',
    priority: 'normal'
  },
  {
    service_type: 'cat_carpenter',
    category: 'cat_carpenter',
    description: 'Изработка на вградени шкафове по поръчка за детска стая',
    budget: '501-1000',
    city: 'Русе',
    neighborhood: 'Дружба',
    phone: '+359887555666',
    preferred_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    preferred_time: 'afternoon',
    priority: 'normal'
  },
  {
    service_type: 'cat_locksmith',
    category: 'cat_locksmith',
    description: 'Смяна на брави и монтаж на сигурносна врата',
    budget: '1001-1500',
    city: 'Стара Загора',
    neighborhood: 'Център',
    phone: '+359889777888',
    preferred_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    preferred_time: 'flexible',
    priority: 'normal'
  },
  {
    service_type: 'cat_handyman',
    category: 'cat_handyman',
    description: 'Основен ремонт на баня - плочки, ВиК, електрика',
    budget: '1501-2000',
    city: 'Плевен',
    neighborhood: 'Сторгозия',
    phone: '+359888999000',
    preferred_date: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    preferred_time: 'morning',
    priority: 'normal'
  },
  {
    service_type: 'cat_appliance',
    category: 'cat_appliance',
    description: 'Ремонт на перална машина и хладилник',
    budget: '2001-2500',
    city: 'Велико Търново',
    neighborhood: 'Бузлуджа',
    phone: '+359887111222',
    preferred_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    preferred_time: 'afternoon',
    priority: 'normal'
  },
  {
    service_type: 'cat_cleaner',
    category: 'cat_cleaner',
    description: 'Почистване и дезинфекция на офис сграда',
    budget: '2501-3000',
    city: 'Шумен',
    neighborhood: 'Център',
    phone: '+359888222333',
    preferred_date: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    preferred_time: 'flexible',
    priority: 'normal'
  },
  {
    service_type: 'cat_mover',
    category: 'cat_mover',
    description: 'Преместване на 3-стаен апартамент с мебели',
    budget: '3001-4000',
    city: 'Габрово',
    neighborhood: 'Младост',
    phone: '+359889333444',
    preferred_date: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    preferred_time: 'morning',
    priority: 'normal'
  },
  {
    service_type: 'cat_carpenter',
    category: 'cat_carpenter',
    description: 'Изработка на кухня по поръчка с уреди',
    budget: '4001-5000',
    city: 'Благоевград',
    neighborhood: 'Еленово',
    phone: '+359887444555',
    preferred_date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    preferred_time: 'afternoon',
    priority: 'normal'
  },
  {
    service_type: 'cat_handyman',
    category: 'cat_handyman',
    description: 'Цялостен ремонт на къща 200 кв.м. - всички видове работи',
    budget: '5000+',
    city: 'Пазарджик',
    neighborhood: 'Център',
    phone: '+359888555666',
    preferred_date: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    preferred_time: 'flexible',
    priority: 'normal'
  }
];

async function createTestCases() {
  const client = await pool.connect();
  
  try {
    console.log('Starting to create test cases...\n');
    
    for (const caseData of testCases) {
      const caseId = uuidv4();
      
      // Insert case
      await client.query(`
        INSERT INTO marketplace_service_cases (
          id, service_type, description, preferred_date, preferred_time, priority,
          city, neighborhood, phone, customer_id, is_open_case, assignment_type,
          status, created_at, updated_at, category, budget, bidding_enabled,
          max_bidders, current_bidders, bidding_closed, chat_source, 
          location_search_status, search_radius_km, negotiation_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      `, [
        caseId,
        caseData.service_type,
        caseData.description,
        caseData.preferred_date,
        caseData.preferred_time,
        caseData.priority,
        caseData.city,
        caseData.neighborhood,
        caseData.phone,
        customerId,
        true, // is_open_case
        'open', // assignment_type
        'pending', // status
        new Date(),
        new Date(),
        caseData.category,
        caseData.budget,
        true, // bidding_enabled
        3, // max_bidders
        0, // current_bidders
        false, // bidding_closed
        'direct', // chat_source
        'completed', // location_search_status
        10, // search_radius_km
        'none' // negotiation_status
      ]);
      
      // Insert GDPR consent for this case
      await client.query(`
        INSERT INTO gdpr_consents (
          id, user_id, consent_type, granted, timestamp, ip_address, user_agent, legal_basis
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        uuidv4(),
        customerId,
        'data_processing',
        true,
        new Date(),
        '127.0.0.1',
        'Mozilla/5.0 (Test Script)',
        'consent'
      ]);
      
      console.log(`✅ Created case: ${caseData.budget} - ${caseData.description.substring(0, 50)}...`);
    }
    
    console.log('\n✅ All test cases created successfully!');
    console.log(`Total cases created: ${testCases.length}`);
    
  } catch (error) {
    console.error('❌ Error creating test cases:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

createTestCases();
