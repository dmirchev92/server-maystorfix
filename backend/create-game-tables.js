const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: 'C58acfd5c!',
  host: 'localhost',
  port: 5432,
  database: 'servicetext_pro'
});

async function createGameTables() {
  const client = await pool.connect();
  
  try {
    console.log('Creating game tables...');
    
    // Game Player Profiles (linked to users table)
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_players (
        id SERIAL PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        character_class VARCHAR(20) DEFAULT 'warrior',
        level INTEGER DEFAULT 1,
        xp INTEGER DEFAULT 0,
        skill_points INTEGER DEFAULT 0,
        
        -- Base Stats
        strength INTEGER DEFAULT 10,
        agility INTEGER DEFAULT 10,
        vitality INTEGER DEFAULT 10,
        crit_chance INTEGER DEFAULT 10,
        crit_damage INTEGER DEFAULT 150,
        
        -- Resources
        stamina INTEGER DEFAULT 100,
        max_stamina INTEGER DEFAULT 100,
        last_stamina_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        gold INTEGER DEFAULT 100,
        premium_currency INTEGER DEFAULT 0,
        
        -- Battle Stats
        battles_won INTEGER DEFAULT 0,
        battles_lost INTEGER DEFAULT 0,
        total_damage_dealt BIGINT DEFAULT 0,
        total_critical_hits INTEGER DEFAULT 0,
        current_win_streak INTEGER DEFAULT 0,
        best_win_streak INTEGER DEFAULT 0,
        
        -- Daily
        last_daily_claim DATE,
        daily_streak INTEGER DEFAULT 0,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(user_id)
      );
    `);
    console.log('✓ game_players table created');

    // Game Items Definition
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_items (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        slot VARCHAR(20) NOT NULL, -- weapon, armor, helmet, ring, boots
        rarity VARCHAR(20) DEFAULT 'common', -- common, rare, epic, legendary
        
        -- Stat Bonuses
        strength_bonus INTEGER DEFAULT 0,
        agility_bonus INTEGER DEFAULT 0,
        vitality_bonus INTEGER DEFAULT 0,
        crit_chance_bonus INTEGER DEFAULT 0,
        crit_damage_bonus INTEGER DEFAULT 0,
        
        -- Visual
        icon VARCHAR(50),
        color_primary VARCHAR(7),
        color_secondary VARCHAR(7),
        
        -- Requirements
        level_required INTEGER DEFAULT 1,
        class_required VARCHAR(20),
        
        -- Economy
        gold_cost INTEGER DEFAULT 0,
        premium_cost INTEGER DEFAULT 0,
        sellable BOOLEAN DEFAULT true,
        sell_price INTEGER DEFAULT 0,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ game_items table created');

    // Player Inventory
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_player_inventory (
        id SERIAL PRIMARY KEY,
        player_id INTEGER REFERENCES game_players(id) ON DELETE CASCADE,
        item_id INTEGER REFERENCES game_items(id) ON DELETE CASCADE,
        equipped BOOLEAN DEFAULT false,
        quantity INTEGER DEFAULT 1,
        obtained_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(player_id, item_id)
      );
    `);
    console.log('✓ game_player_inventory table created');

    // Quests Definition
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_quests (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        quest_type VARCHAR(30) NOT NULL, -- win_battles, kill_npcs, critical_hits, reach_level, survival
        target_value INTEGER NOT NULL,
        
        -- Rewards
        xp_reward INTEGER DEFAULT 0,
        gold_reward INTEGER DEFAULT 0,
        item_reward_id INTEGER REFERENCES game_items(id),
        
        -- Requirements
        level_required INTEGER DEFAULT 1,
        prerequisite_quest_id INTEGER REFERENCES game_quests(id),
        
        -- Flags
        is_daily BOOLEAN DEFAULT false,
        is_repeatable BOOLEAN DEFAULT false,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ game_quests table created');

    // Player Quest Progress
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_player_quests (
        id SERIAL PRIMARY KEY,
        player_id INTEGER REFERENCES game_players(id) ON DELETE CASCADE,
        quest_id INTEGER REFERENCES game_quests(id) ON DELETE CASCADE,
        progress INTEGER DEFAULT 0,
        completed BOOLEAN DEFAULT false,
        claimed BOOLEAN DEFAULT false,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        
        UNIQUE(player_id, quest_id)
      );
    `);
    console.log('✓ game_player_quests table created');

    // NPC Enemies
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_npcs (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        character_class VARCHAR(20) DEFAULT 'warrior',
        level INTEGER DEFAULT 1,
        
        -- Stats
        strength INTEGER DEFAULT 10,
        agility INTEGER DEFAULT 10,
        vitality INTEGER DEFAULT 10,
        crit_chance INTEGER DEFAULT 10,
        crit_damage INTEGER DEFAULT 150,
        
        -- Visual
        avatar VARCHAR(50),
        is_boss BOOLEAN DEFAULT false,
        
        -- Rewards
        xp_reward INTEGER DEFAULT 50,
        gold_reward INTEGER DEFAULT 10,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ game_npcs table created');

    // Battle History
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_battle_history (
        id SERIAL PRIMARY KEY,
        player_id INTEGER REFERENCES game_players(id) ON DELETE CASCADE,
        opponent_type VARCHAR(10) NOT NULL, -- npc, player
        opponent_id INTEGER NOT NULL,
        
        -- Result
        won BOOLEAN NOT NULL,
        player_hp_remaining INTEGER,
        opponent_hp_remaining INTEGER,
        total_damage_dealt INTEGER,
        total_damage_taken INTEGER,
        critical_hits INTEGER DEFAULT 0,
        
        -- Rewards
        xp_earned INTEGER DEFAULT 0,
        gold_earned INTEGER DEFAULT 0,
        
        battle_log JSONB,
        fought_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ game_battle_history table created');

    // Achievements
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_achievements (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        achievement_type VARCHAR(30) NOT NULL,
        target_value INTEGER NOT NULL,
        
        -- Rewards
        xp_reward INTEGER DEFAULT 0,
        gold_reward INTEGER DEFAULT 0,
        premium_reward INTEGER DEFAULT 0,
        title_reward VARCHAR(50),
        
        icon VARCHAR(50),
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ game_achievements table created');

    // Player Achievements
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_player_achievements (
        id SERIAL PRIMARY KEY,
        player_id INTEGER REFERENCES game_players(id) ON DELETE CASCADE,
        achievement_id INTEGER REFERENCES game_achievements(id) ON DELETE CASCADE,
        progress INTEGER DEFAULT 0,
        unlocked BOOLEAN DEFAULT false,
        unlocked_at TIMESTAMP,
        
        UNIQUE(player_id, achievement_id)
      );
    `);
    console.log('✓ game_player_achievements table created');

    // Daily Login Rewards
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_daily_rewards (
        id SERIAL PRIMARY KEY,
        day_number INTEGER NOT NULL UNIQUE,
        xp_reward INTEGER DEFAULT 0,
        gold_reward INTEGER DEFAULT 0,
        stamina_reward INTEGER DEFAULT 0,
        item_reward_id INTEGER REFERENCES game_items(id),
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ game_daily_rewards table created');

    // Create indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_game_players_user_id ON game_players(user_id);
      CREATE INDEX IF NOT EXISTS idx_game_player_inventory_player_id ON game_player_inventory(player_id);
      CREATE INDEX IF NOT EXISTS idx_game_player_quests_player_id ON game_player_quests(player_id);
      CREATE INDEX IF NOT EXISTS idx_game_battle_history_player_id ON game_battle_history(player_id);
      CREATE INDEX IF NOT EXISTS idx_game_player_achievements_player_id ON game_player_achievements(player_id);
    `);
    console.log('✓ Indexes created');

    // Insert default items
    await client.query(`
      INSERT INTO game_items (name, description, slot, rarity, strength_bonus, agility_bonus, vitality_bonus, crit_chance_bonus, crit_damage_bonus, icon, color_primary, level_required, gold_cost, sell_price) VALUES
      -- Common Weapons
      ('Rusty Sword', 'A basic sword, slightly rusted', 'weapon', 'common', 5, 0, 0, 0, 0, 'sword', '#808080', 1, 50, 25),
      ('Wooden Staff', 'A simple wooden staff', 'weapon', 'common', 3, 2, 0, 0, 0, 'staff', '#8B4513', 1, 50, 25),
      ('Iron Dagger', 'A small but sharp dagger', 'weapon', 'common', 3, 5, 0, 2, 0, 'dagger', '#C0C0C0', 1, 50, 25),
      ('Training Bow', 'A bow for beginners', 'weapon', 'common', 4, 3, 0, 1, 0, 'bow', '#DEB887', 1, 50, 25),
      
      -- Rare Weapons
      ('Steel Blade', 'A well-crafted steel sword', 'weapon', 'rare', 12, 0, 0, 3, 0, 'sword', '#4169E1', 5, 200, 100),
      ('Crystal Staff', 'A staff infused with magic crystals', 'weapon', 'rare', 8, 5, 0, 5, 10, 'staff', '#9370DB', 5, 200, 100),
      ('Shadow Daggers', 'Twin daggers that seem to absorb light', 'weapon', 'rare', 7, 12, 0, 8, 0, 'dagger', '#483D8B', 5, 200, 100),
      ('Elven Bow', 'Crafted by elven artisans', 'weapon', 'rare', 10, 8, 0, 5, 5, 'bow', '#228B22', 5, 200, 100),
      
      -- Epic Weapons
      ('Dragon Slayer', 'A legendary blade forged in dragon fire', 'weapon', 'epic', 25, 5, 5, 8, 15, 'sword', '#9400D3', 10, 500, 250),
      ('Arcane Focus', 'Channels immense magical power', 'weapon', 'epic', 18, 10, 0, 12, 25, 'staff', '#FF00FF', 10, 500, 250),
      ('Assassins Edge', 'Silent and deadly', 'weapon', 'epic', 15, 25, 0, 15, 10, 'dagger', '#800080', 10, 500, 250),
      ('Phoenix Bow', 'Burns with eternal flame', 'weapon', 'epic', 20, 15, 0, 10, 20, 'bow', '#FF4500', 10, 500, 250),
      
      -- Legendary Weapons
      ('Excalibur', 'The sword of kings', 'weapon', 'legendary', 40, 15, 15, 15, 30, 'sword', '#FFD700', 15, 1500, 750),
      ('Staff of Ages', 'Contains the wisdom of millennia', 'weapon', 'legendary', 30, 20, 10, 20, 40, 'staff', '#FFD700', 15, 1500, 750),
      ('Deaths Whisper', 'One cut is all it takes', 'weapon', 'legendary', 25, 40, 5, 25, 25, 'dagger', '#FFD700', 15, 1500, 750),
      ('Apollo Bow', 'Blessed by the sun god', 'weapon', 'legendary', 35, 25, 10, 18, 35, 'bow', '#FFD700', 15, 1500, 750),
      
      -- Common Armor
      ('Cloth Tunic', 'Basic protection', 'armor', 'common', 0, 2, 8, 0, 0, 'armor', '#DEB887', 1, 40, 20),
      ('Leather Vest', 'Light and flexible', 'armor', 'common', 0, 5, 5, 0, 0, 'armor', '#8B4513', 1, 40, 20),
      
      -- Rare Armor
      ('Chainmail', 'Interlocking metal rings', 'armor', 'rare', 3, 0, 15, 0, 0, 'armor', '#4169E1', 5, 180, 90),
      ('Rogues Garb', 'Silent movement guaranteed', 'armor', 'rare', 0, 10, 10, 3, 0, 'armor', '#483D8B', 5, 180, 90),
      
      -- Epic Armor
      ('Dragonscale Armor', 'Made from actual dragon scales', 'armor', 'epic', 8, 5, 30, 0, 0, 'armor', '#9400D3', 10, 450, 225),
      ('Shadow Cloak', 'Wraps you in darkness', 'armor', 'epic', 0, 20, 20, 10, 0, 'armor', '#800080', 10, 450, 225),
      
      -- Legendary Armor
      ('Armor of the Ancients', 'Worn by legendary heroes', 'armor', 'legendary', 15, 15, 50, 5, 10, 'armor', '#FFD700', 15, 1400, 700),
      
      -- Helmets
      ('Iron Helm', 'Basic head protection', 'helmet', 'common', 2, 0, 5, 0, 0, 'helmet', '#808080', 1, 30, 15),
      ('Mage Hood', 'Enhances magical focus', 'helmet', 'rare', 5, 3, 3, 5, 5, 'helmet', '#4169E1', 5, 150, 75),
      ('Dragon Crown', 'Radiates power', 'helmet', 'epic', 10, 8, 15, 8, 10, 'helmet', '#9400D3', 10, 400, 200),
      ('Crown of Kings', 'Symbol of ultimate power', 'helmet', 'legendary', 20, 15, 25, 12, 15, 'helmet', '#FFD700', 15, 1200, 600),
      
      -- Rings
      ('Copper Ring', 'A simple ring', 'ring', 'common', 2, 2, 2, 1, 0, 'ring', '#B87333', 1, 25, 12),
      ('Ring of Strength', 'Enhances physical power', 'ring', 'rare', 10, 0, 5, 0, 0, 'ring', '#4169E1', 5, 120, 60),
      ('Ring of Shadows', 'Increases critical strikes', 'ring', 'epic', 5, 10, 5, 15, 20, 'ring', '#9400D3', 10, 350, 175),
      ('Ring of the Champion', 'Worn by true champions', 'ring', 'legendary', 15, 15, 15, 20, 30, 'ring', '#FFD700', 15, 1000, 500),
      
      -- Boots
      ('Leather Boots', 'Basic footwear', 'boots', 'common', 0, 5, 3, 0, 0, 'boots', '#8B4513', 1, 35, 17),
      ('Swift Boots', 'Light as a feather', 'boots', 'rare', 0, 12, 5, 3, 0, 'boots', '#4169E1', 5, 140, 70),
      ('Boots of the Wind', 'Move like the wind', 'boots', 'epic', 5, 20, 10, 8, 5, 'boots', '#9400D3', 10, 380, 190),
      ('Godspeed Boots', 'Legendary speed', 'boots', 'legendary', 10, 30, 15, 12, 10, 'boots', '#FFD700', 15, 1100, 550)
      ON CONFLICT DO NOTHING;
    `);
    console.log('✓ Default items inserted');

    // Insert default quests
    await client.query(`
      INSERT INTO game_quests (name, description, quest_type, target_value, xp_reward, gold_reward, level_required, is_daily, is_repeatable) VALUES
      ('First Blood', 'Win your first battle', 'win_battles', 1, 50, 20, 1, false, false),
      ('Warrior Path', 'Win 5 battles', 'win_battles', 5, 150, 50, 1, false, false),
      ('Battle Hardened', 'Win 25 battles', 'win_battles', 25, 500, 150, 5, false, false),
      ('War Veteran', 'Win 100 battles', 'win_battles', 100, 2000, 500, 10, false, false),
      ('Critical Striker', 'Land 10 critical hits', 'critical_hits', 10, 100, 30, 1, false, false),
      ('Precision Master', 'Land 50 critical hits', 'critical_hits', 50, 400, 100, 5, false, false),
      ('Rising Star', 'Reach level 5', 'reach_level', 5, 300, 100, 1, false, false),
      ('Champion', 'Reach level 10', 'reach_level', 10, 800, 300, 5, false, false),
      ('Legend', 'Reach level 20', 'reach_level', 20, 2500, 800, 10, false, false),
      ('Perfect Victory', 'Win a battle without losing 50% HP', 'survival', 1, 200, 75, 3, false, true),
      ('Daily Challenge', 'Win 3 battles today', 'win_battles', 3, 100, 50, 1, true, true),
      ('Daily Crit', 'Land 5 critical hits today', 'critical_hits', 5, 75, 30, 1, true, true),
      ('Winning Streak', 'Win 5 battles in a row', 'win_streak', 5, 300, 100, 3, false, true),
      ('Unstoppable', 'Win 10 battles in a row', 'win_streak', 10, 750, 250, 5, false, false)
      ON CONFLICT DO NOTHING;
    `);
    console.log('✓ Default quests inserted');

    // Insert default NPCs
    await client.query(`
      INSERT INTO game_npcs (name, character_class, level, strength, agility, vitality, crit_chance, crit_damage, is_boss, xp_reward, gold_reward) VALUES
      ('Training Dummy', 'warrior', 1, 5, 5, 8, 5, 100, false, 20, 5),
      ('Goblin Scout', 'rogue', 1, 8, 10, 6, 8, 120, false, 30, 8),
      ('Forest Wolf', 'berserker', 2, 12, 8, 10, 6, 130, false, 40, 10),
      ('Skeleton Warrior', 'warrior', 3, 14, 6, 15, 5, 120, false, 50, 15),
      ('Dark Mage', 'mage', 4, 10, 8, 12, 12, 150, false, 60, 18),
      ('Orc Berserker', 'berserker', 5, 18, 8, 20, 8, 140, false, 80, 25),
      ('Shadow Assassin', 'rogue', 6, 15, 20, 12, 18, 160, false, 100, 30),
      ('Knight Commander', 'paladin', 7, 20, 10, 25, 10, 140, false, 120, 40),
      ('Fire Elemental', 'mage', 8, 22, 12, 18, 15, 170, false, 150, 50),
      ('Death Knight', 'warrior', 9, 25, 12, 28, 12, 150, false, 180, 60),
      -- Bosses
      ('Goblin King', 'berserker', 5, 25, 15, 35, 10, 150, true, 300, 150),
      ('Dragon Spawn', 'warrior', 10, 35, 20, 50, 15, 180, true, 600, 300),
      ('Lich Lord', 'mage', 15, 40, 25, 45, 25, 200, true, 1000, 500),
      ('Ancient Dragon', 'berserker', 20, 60, 30, 80, 20, 220, true, 2000, 1000)
      ON CONFLICT DO NOTHING;
    `);
    console.log('✓ Default NPCs inserted');

    // Insert default achievements
    await client.query(`
      INSERT INTO game_achievements (name, description, achievement_type, target_value, xp_reward, gold_reward, icon) VALUES
      ('First Steps', 'Win your first battle', 'battles_won', 1, 50, 25, 'trophy'),
      ('Warrior', 'Win 50 battles', 'battles_won', 50, 500, 200, 'sword'),
      ('Champion', 'Win 200 battles', 'battles_won', 200, 2000, 800, 'crown'),
      ('Legendary Fighter', 'Win 500 battles', 'battles_won', 500, 5000, 2000, 'star'),
      ('Critical Eye', 'Land 100 critical hits', 'critical_hits', 100, 300, 100, 'target'),
      ('Precision Master', 'Land 500 critical hits', 'critical_hits', 500, 1500, 500, 'crosshair'),
      ('Level 10', 'Reach level 10', 'level', 10, 500, 200, 'badge'),
      ('Level 25', 'Reach level 25', 'level', 25, 1500, 600, 'badge'),
      ('Level 50', 'Reach level 50', 'level', 50, 5000, 2000, 'badge'),
      ('Hot Streak', 'Win 10 battles in a row', 'win_streak', 10, 400, 150, 'fire'),
      ('Unstoppable', 'Win 25 battles in a row', 'win_streak', 25, 1000, 400, 'lightning'),
      ('Damage Dealer', 'Deal 10000 total damage', 'total_damage', 10000, 300, 100, 'explosion'),
      ('Devastator', 'Deal 100000 total damage', 'total_damage', 100000, 1500, 500, 'bomb')
      ON CONFLICT DO NOTHING;
    `);
    console.log('✓ Default achievements inserted');

    // Insert daily rewards
    await client.query(`
      INSERT INTO game_daily_rewards (day_number, xp_reward, gold_reward, stamina_reward) VALUES
      (1, 25, 10, 10),
      (2, 50, 20, 15),
      (3, 75, 30, 20),
      (4, 100, 50, 25),
      (5, 150, 75, 30),
      (6, 200, 100, 40),
      (7, 500, 200, 100)
      ON CONFLICT DO NOTHING;
    `);
    console.log('✓ Daily rewards inserted');

    console.log('\n✅ All game tables created successfully!');
    
  } catch (error) {
    console.error('Error creating game tables:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

createGameTables();
