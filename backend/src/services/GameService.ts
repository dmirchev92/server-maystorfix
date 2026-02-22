/**
 * Game Service
 * Handles all game logic: battles, progression, items, quests
 */

import { Pool } from 'pg';
import logger from '../utils/logger';

const pool = new Pool({
  user: 'postgres',
  password: 'C58acfd5c!',
  host: 'localhost',
  port: 5432,
  database: 'servicetext_pro'
});

// Character class configurations
const CHARACTER_CLASSES = {
  warrior: { baseStr: 12, baseAgi: 8, baseVit: 12, icon: 'sword-shield' },
  mage: { baseStr: 6, baseAgi: 10, baseVit: 8, icon: 'staff' },
  rogue: { baseStr: 8, baseAgi: 14, baseVit: 6, icon: 'daggers' },
  paladin: { baseStr: 10, baseAgi: 6, baseVit: 14, icon: 'cross-shield' },
  berserker: { baseStr: 14, baseAgi: 10, baseVit: 10, icon: 'axe' },
  archer: { baseStr: 10, baseAgi: 12, baseVit: 8, icon: 'bow' }
};

// XP required for each level: level * 100 * 1.5
function getXPForLevel(level: number): number {
  return Math.floor(level * 100 * 1.5);
}

// Calculate max HP from vitality
function calculateMaxHP(vitality: number): number {
  return 100 + (vitality * 5);
}

// Calculate damage from strength
function calculateDamage(strength: number): number {
  return 10 + (strength * 1.5);
}

// Calculate dodge chance from agility (max 50%)
function calculateDodgeChance(agility: number): number {
  return Math.min(agility * 2, 50);
}

class GameService {
  
  // ==================== PLAYER MANAGEMENT ====================
  
  async getOrCreatePlayer(userId: string): Promise<any> {
    const client = await pool.connect();
    try {
      // Check if player exists
      let result = await client.query(
        'SELECT * FROM game_players WHERE user_id = $1',
        [userId]
      );
      
      if (result.rows.length > 0) {
        const player = result.rows[0];
        // Update stamina based on time passed
        const updatedPlayer = await this.updateStamina(player);
        return this.formatPlayerData(updatedPlayer);
      }
      
      // Create new player
      result = await client.query(`
        INSERT INTO game_players (user_id, character_class, level, xp, skill_points, 
          strength, agility, vitality, crit_chance, crit_damage, 
          stamina, max_stamina, gold, premium_currency)
        VALUES ($1, 'warrior', 1, 0, 0, 10, 10, 10, 10, 150, 100, 100, 100, 0)
        RETURNING *
      `, [userId]);
      
      const newPlayer = result.rows[0];
      
      // Give starter items
      await this.giveStarterItems(newPlayer.id);
      
      // Initialize quests
      await this.initializePlayerQuests(newPlayer.id);
      
      // Initialize achievements
      await this.initializePlayerAchievements(newPlayer.id);
      
      return this.formatPlayerData(newPlayer);
    } finally {
      client.release();
    }
  }
  
  async updateStamina(player: any): Promise<any> {
    const now = new Date();
    const lastUpdate = new Date(player.last_stamina_update);
    const minutesPassed = Math.floor((now.getTime() - lastUpdate.getTime()) / 60000);
    
    if (minutesPassed > 0 && player.stamina < player.max_stamina) {
      const staminaToAdd = Math.min(minutesPassed, player.max_stamina - player.stamina);
      const newStamina = player.stamina + staminaToAdd;
      
      const client = await pool.connect();
      try {
        const result = await client.query(`
          UPDATE game_players 
          SET stamina = $1, last_stamina_update = NOW() 
          WHERE id = $2 
          RETURNING *
        `, [newStamina, player.id]);
        return result.rows[0];
      } finally {
        client.release();
      }
    }
    return player;
  }
  
  formatPlayerData(player: any): any {
    const maxHP = calculateMaxHP(player.vitality);
    const damage = calculateDamage(player.strength);
    const dodgeChance = calculateDodgeChance(player.agility);
    const xpForNextLevel = getXPForLevel(player.level);
    
    // Calculate time until next stamina
    let secondsUntilNextStamina = 0;
    if (player.stamina < player.max_stamina) {
      const lastUpdate = new Date(player.last_stamina_update);
      const now = new Date();
      const secondsSinceUpdate = Math.floor((now.getTime() - lastUpdate.getTime()) / 1000);
      secondsUntilNextStamina = Math.max(0, 60 - (secondsSinceUpdate % 60));
    }
    
    return {
      id: player.id,
      userId: player.user_id,
      characterClass: player.character_class,
      level: player.level,
      xp: player.xp,
      xpForNextLevel,
      xpProgress: (player.xp / xpForNextLevel) * 100,
      skillPoints: player.skill_points,
      
      // Stats
      stats: {
        strength: player.strength,
        agility: player.agility,
        vitality: player.vitality,
        critChance: player.crit_chance,
        critDamage: player.crit_damage
      },
      
      // Calculated stats
      calculated: {
        maxHP,
        damage,
        dodgeChance,
        critChance: player.crit_chance,
        critDamage: player.crit_damage
      },
      
      // Resources
      stamina: player.stamina,
      maxStamina: player.max_stamina,
      secondsUntilNextStamina,
      gold: player.gold,
      premiumCurrency: player.premium_currency,
      
      // Battle stats
      battleStats: {
        battlesWon: player.battles_won,
        battlesLost: player.battles_lost,
        totalDamageDealt: player.total_damage_dealt,
        totalCriticalHits: player.total_critical_hits,
        currentWinStreak: player.current_win_streak,
        bestWinStreak: player.best_win_streak
      },
      
      // Daily
      dailyStreak: player.daily_streak,
      lastDailyClaim: player.last_daily_claim
    };
  }
  
  async giveStarterItems(playerId: number): Promise<void> {
    const client = await pool.connect();
    try {
      // Give starter weapon (Rusty Sword) and armor (Cloth Tunic)
      await client.query(`
        INSERT INTO game_player_inventory (player_id, item_id, equipped)
        SELECT $1, id, true FROM game_items WHERE name IN ('Rusty Sword', 'Cloth Tunic')
        ON CONFLICT DO NOTHING
      `, [playerId]);
    } finally {
      client.release();
    }
  }
  
  async initializePlayerQuests(playerId: number): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(`
        INSERT INTO game_player_quests (player_id, quest_id, progress)
        SELECT $1, id, 0 FROM game_quests WHERE level_required = 1 AND NOT is_daily
        ON CONFLICT DO NOTHING
      `, [playerId]);
    } finally {
      client.release();
    }
  }
  
  async initializePlayerAchievements(playerId: number): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(`
        INSERT INTO game_player_achievements (player_id, achievement_id, progress)
        SELECT $1, id, 0 FROM game_achievements
        ON CONFLICT DO NOTHING
      `, [playerId]);
    } finally {
      client.release();
    }
  }
  
  // ==================== CHARACTER CLASS ====================
  
  async changeCharacterClass(userId: string, newClass: string): Promise<any> {
    if (!CHARACTER_CLASSES[newClass as keyof typeof CHARACTER_CLASSES]) {
      throw { statusCode: 400, code: 'INVALID_CLASS', message: 'Invalid character class' };
    }
    
    const client = await pool.connect();
    try {
      const result = await client.query(`
        UPDATE game_players 
        SET character_class = $1, updated_at = NOW()
        WHERE user_id = $2
        RETURNING *
      `, [newClass, userId]);
      
      if (result.rows.length === 0) {
        throw { statusCode: 404, code: 'PLAYER_NOT_FOUND', message: 'Player not found' };
      }
      
      return this.formatPlayerData(result.rows[0]);
    } finally {
      client.release();
    }
  }
  
  // ==================== STAT UPGRADES ====================
  
  async upgradeStats(userId: string, statName: string, points: number): Promise<any> {
    const validStats = ['strength', 'agility', 'vitality', 'crit_chance', 'crit_damage'];
    if (!validStats.includes(statName)) {
      throw { statusCode: 400, code: 'INVALID_STAT', message: 'Invalid stat name' };
    }
    
    const client = await pool.connect();
    try {
      // Get current player
      const playerResult = await client.query(
        'SELECT * FROM game_players WHERE user_id = $1',
        [userId]
      );
      
      if (playerResult.rows.length === 0) {
        throw { statusCode: 404, code: 'PLAYER_NOT_FOUND', message: 'Player not found' };
      }
      
      const player = playerResult.rows[0];
      
      if (player.skill_points < points) {
        throw { statusCode: 400, code: 'INSUFFICIENT_POINTS', message: 'Not enough skill points' };
      }
      
      // Each skill point gives +5 to stat
      const statIncrease = points * 5;
      
      const result = await client.query(`
        UPDATE game_players 
        SET ${statName} = ${statName} + $1, 
            skill_points = skill_points - $2,
            updated_at = NOW()
        WHERE user_id = $3
        RETURNING *
      `, [statIncrease, points, userId]);
      
      return this.formatPlayerData(result.rows[0]);
    } finally {
      client.release();
    }
  }
  
  // ==================== BATTLE SYSTEM ====================
  
  async getOpponents(userId: string): Promise<any[]> {
    const client = await pool.connect();
    try {
      const playerResult = await client.query(
        'SELECT level FROM game_players WHERE user_id = $1',
        [userId]
      );
      
      if (playerResult.rows.length === 0) {
        throw { statusCode: 404, code: 'PLAYER_NOT_FOUND', message: 'Player not found' };
      }
      
      const playerLevel = playerResult.rows[0].level;
      const minLevel = Math.max(1, playerLevel - 2);
      const maxLevel = playerLevel + 3;
      
      // Get NPCs within level range
      const result = await client.query(`
        SELECT * FROM game_npcs 
        WHERE level BETWEEN $1 AND $2 
        ORDER BY RANDOM() 
        LIMIT 10
      `, [minLevel, maxLevel]);
      
      return result.rows.map(npc => ({
        id: npc.id,
        name: npc.name,
        characterClass: npc.character_class,
        level: npc.level,
        isBoss: npc.is_boss,
        power: this.calculatePower(npc),
        stats: {
          strength: npc.strength,
          agility: npc.agility,
          vitality: npc.vitality,
          critChance: npc.crit_chance,
          critDamage: npc.crit_damage
        },
        calculated: {
          maxHP: calculateMaxHP(npc.vitality),
          damage: calculateDamage(npc.strength),
          dodgeChance: calculateDodgeChance(npc.agility)
        },
        rewards: {
          xp: npc.xp_reward,
          gold: npc.gold_reward
        }
      }));
    } finally {
      client.release();
    }
  }
  
  calculatePower(entity: any): number {
    return Math.floor(
      entity.strength * 1.5 +
      entity.agility * 1.2 +
      entity.vitality * 1.3 +
      entity.crit_chance * 0.5 +
      (entity.crit_damage - 100) * 0.3
    );
  }
  
  async startBattle(userId: string, opponentId: number): Promise<any> {
    const client = await pool.connect();
    try {
      // Get player
      const playerResult = await client.query(
        'SELECT * FROM game_players WHERE user_id = $1',
        [userId]
      );
      
      if (playerResult.rows.length === 0) {
        throw { statusCode: 404, code: 'PLAYER_NOT_FOUND', message: 'Player not found' };
      }
      
      const player = playerResult.rows[0];
      
      // Check stamina
      if (player.stamina < 15) {
        throw { statusCode: 400, code: 'INSUFFICIENT_STAMINA', message: 'Not enough stamina (need 15)' };
      }
      
      // Get opponent (NPC)
      const npcResult = await client.query(
        'SELECT * FROM game_npcs WHERE id = $1',
        [opponentId]
      );
      
      if (npcResult.rows.length === 0) {
        throw { statusCode: 404, code: 'OPPONENT_NOT_FOUND', message: 'Opponent not found' };
      }
      
      const npc = npcResult.rows[0];
      
      // Get player's equipped items for stat bonuses
      const equipmentResult = await client.query(`
        SELECT gi.* FROM game_player_inventory gpi
        JOIN game_items gi ON gpi.item_id = gi.id
        WHERE gpi.player_id = $1 AND gpi.equipped = true
      `, [player.id]);
      
      // Calculate total stats with equipment
      let playerStats = {
        strength: player.strength,
        agility: player.agility,
        vitality: player.vitality,
        critChance: player.crit_chance,
        critDamage: player.crit_damage
      };
      
      for (const item of equipmentResult.rows) {
        playerStats.strength += item.strength_bonus;
        playerStats.agility += item.agility_bonus;
        playerStats.vitality += item.vitality_bonus;
        playerStats.critChance += item.crit_chance_bonus;
        playerStats.critDamage += item.crit_damage_bonus;
      }
      
      // Deduct stamina
      await client.query(
        'UPDATE game_players SET stamina = stamina - 15 WHERE id = $1',
        [player.id]
      );
      
      // Return battle setup data
      return {
        battleId: `${player.id}-${npc.id}-${Date.now()}`,
        player: {
          id: player.id,
          name: 'You',
          characterClass: player.character_class,
          level: player.level,
          maxHP: calculateMaxHP(playerStats.vitality),
          currentHP: calculateMaxHP(playerStats.vitality),
          damage: calculateDamage(playerStats.strength),
          dodgeChance: calculateDodgeChance(playerStats.agility),
          critChance: Math.min(playerStats.critChance, 50),
          critDamage: playerStats.critDamage,
          stats: playerStats
        },
        opponent: {
          id: npc.id,
          name: npc.name,
          characterClass: npc.character_class,
          level: npc.level,
          isBoss: npc.is_boss,
          maxHP: calculateMaxHP(npc.vitality),
          currentHP: calculateMaxHP(npc.vitality),
          damage: calculateDamage(npc.strength),
          dodgeChance: calculateDodgeChance(npc.agility),
          critChance: npc.crit_chance,
          critDamage: npc.crit_damage
        },
        rewards: {
          xp: npc.xp_reward,
          gold: npc.gold_reward
        }
      };
    } finally {
      client.release();
    }
  }
  
  async performAction(userId: string, battleData: any, action: string): Promise<any> {
    const { player, opponent } = battleData;
    const battleLog: any[] = [];
    
    // Player's turn
    if (action === 'attack') {
      const result = this.calculateAttack(player, opponent, false);
      battleLog.push({
        actor: 'player',
        action: 'attack',
        ...result
      });
      opponent.currentHP -= result.damage;
    } else if (action === 'defend') {
      battleLog.push({
        actor: 'player',
        action: 'defend',
        message: 'You take a defensive stance'
      });
      // Reduce incoming damage by 50% this turn
      battleData.playerDefending = true;
    } else if (action === 'charge') {
      // Charge up for a powerful attack next turn
      battleLog.push({
        actor: 'player',
        action: 'charge',
        damage: 0,
        dodged: false,
        critical: false,
        message: 'You focus your energy for a devastating blow!'
      });
      battleData.playerCharging = true;
    } else if (action === 'release') {
      // Release charged attack - guaranteed crit, can't be dodged, 2x damage
      const baseDamage = player.damage * 2;
      const critMultiplier = player.critDamage / 100;
      const finalDamage = Math.floor(baseDamage * critMultiplier * (0.9 + Math.random() * 0.2));
      
      battleLog.push({
        actor: 'player',
        action: 'release',
        damage: finalDamage,
        dodged: false,
        critical: true,
        message: `DEVASTATING BLOW! ${finalDamage} critical damage!`
      });
      opponent.currentHP -= finalDamage;
      battleData.playerCharging = false;
    }
    
    // Check if opponent is defeated
    if (opponent.currentHP <= 0) {
      opponent.currentHP = 0;
      return {
        ...battleData,
        battleLog,
        battleEnded: true,
        victory: true
      };
    }
    
    // Enemy's turn
    const enemyResult = this.calculateAttack(opponent, player, false);
    
    // Apply defense reduction
    if (battleData.playerDefending) {
      enemyResult.damage = Math.floor(enemyResult.damage * 0.5);
      enemyResult.blocked = true;
      battleData.playerDefending = false;
    }
    
    battleLog.push({
      actor: 'opponent',
      action: 'attack',
      ...enemyResult
    });
    
    player.currentHP -= enemyResult.damage;
    
    // Check if player is defeated
    if (player.currentHP <= 0) {
      player.currentHP = 0;
      return {
        ...battleData,
        battleLog,
        battleEnded: true,
        victory: false
      };
    }
    
    return {
      ...battleData,
      battleLog,
      battleEnded: false
    };
  }
  
  calculateAttack(attacker: any, defender: any, isSpecial: boolean): any {
    // Check dodge
    const dodgeRoll = Math.random() * 100;
    if (dodgeRoll < defender.dodgeChance) {
      return {
        damage: 0,
        dodged: true,
        critical: false,
        message: `${defender.name || 'Target'} dodged the attack!`
      };
    }
    
    // Calculate base damage
    let damage = attacker.damage;
    
    // Special attack multiplier
    if (isSpecial) {
      damage *= 1.8;
    }
    
    // Random variance (±15%)
    damage *= 0.85 + (Math.random() * 0.3);
    
    // Check critical hit
    const critRoll = Math.random() * 100;
    const isCritical = critRoll < attacker.critChance;
    
    if (isCritical) {
      damage *= attacker.critDamage / 100;
    }
    
    damage = Math.floor(damage);
    
    return {
      damage,
      dodged: false,
      critical: isCritical,
      message: isCritical 
        ? `CRITICAL HIT! ${damage} damage!` 
        : `${attacker.name || 'Attacker'} deals ${damage} damage`
    };
  }
  
  async endBattle(userId: string, battleData: any): Promise<any> {
    const client = await pool.connect();
    try {
      const playerResult = await client.query(
        'SELECT * FROM game_players WHERE user_id = $1',
        [userId]
      );
      
      if (playerResult.rows.length === 0) {
        throw { statusCode: 404, code: 'PLAYER_NOT_FOUND', message: 'Player not found' };
      }
      
      const player = playerResult.rows[0];
      const { victory, opponent, battleLog } = battleData;
      
      // Calculate battle stats
      let totalDamage = 0;
      let criticalHits = 0;
      
      for (const entry of battleLog || []) {
        if (entry.actor === 'player' && entry.damage > 0) {
          totalDamage += entry.damage;
          if (entry.critical) criticalHits++;
        }
      }
      
      let xpEarned = 0;
      let goldEarned = 0;
      let leveledUp = false;
      let newLevel = player.level;
      let skillPointsGained = 0;
      
      if (victory) {
        // Get NPC rewards
        const npcResult = await client.query(
          'SELECT xp_reward, gold_reward FROM game_npcs WHERE id = $1',
          [opponent.id]
        );
        
        if (npcResult.rows.length > 0) {
          xpEarned = npcResult.rows[0].xp_reward;
          goldEarned = npcResult.rows[0].gold_reward;
        }
        
        // Update player stats
        const newXP = player.xp + xpEarned;
        const xpRequired = getXPForLevel(player.level);
        
        if (newXP >= xpRequired) {
          leveledUp = true;
          newLevel = player.level + 1;
          skillPointsGained = 3;
        }
        
        const newWinStreak = player.current_win_streak + 1;
        const bestStreak = Math.max(player.best_win_streak, newWinStreak);
        
        await client.query(`
          UPDATE game_players SET
            xp = $1,
            level = $2,
            skill_points = skill_points + $3,
            gold = gold + $4,
            battles_won = battles_won + 1,
            total_damage_dealt = total_damage_dealt + $5,
            total_critical_hits = total_critical_hits + $6,
            current_win_streak = $7,
            best_win_streak = $8,
            updated_at = NOW()
          WHERE id = $9
        `, [
          leveledUp ? newXP - xpRequired : newXP,
          newLevel,
          skillPointsGained,
          goldEarned,
          totalDamage,
          criticalHits,
          newWinStreak,
          bestStreak,
          player.id
        ]);
        
        // Update quest progress
        await this.updateQuestProgress(player.id, 'win_battles', 1);
        await this.updateQuestProgress(player.id, 'critical_hits', criticalHits);
        
        // Check for survival quest (won without losing 50% HP)
        const playerMaxHP = battleData.player.maxHP;
        const playerFinalHP = battleData.player.currentHP;
        if (playerFinalHP > playerMaxHP * 0.5) {
          await this.updateQuestProgress(player.id, 'survival', 1);
        }
        
        // Update win streak quest
        await this.updateQuestProgress(player.id, 'win_streak', newWinStreak);
        
        // Update achievements
        await this.updateAchievementProgress(player.id, 'battles_won', player.battles_won + 1);
        await this.updateAchievementProgress(player.id, 'critical_hits', player.total_critical_hits + criticalHits);
        await this.updateAchievementProgress(player.id, 'total_damage', player.total_damage_dealt + totalDamage);
        await this.updateAchievementProgress(player.id, 'win_streak', newWinStreak);
        
        if (leveledUp) {
          await this.updateAchievementProgress(player.id, 'level', newLevel);
          await this.checkNewQuestsUnlocked(player.id, newLevel);
        }
        
      } else {
        // Loss - reset win streak
        await client.query(`
          UPDATE game_players SET
            battles_lost = battles_lost + 1,
            total_damage_dealt = total_damage_dealt + $1,
            total_critical_hits = total_critical_hits + $2,
            current_win_streak = 0,
            updated_at = NOW()
          WHERE id = $3
        `, [totalDamage, criticalHits, player.id]);
      }
      
      // Record battle history
      await client.query(`
        INSERT INTO game_battle_history 
        (player_id, opponent_type, opponent_id, won, player_hp_remaining, opponent_hp_remaining,
         total_damage_dealt, total_damage_taken, critical_hits, xp_earned, gold_earned, battle_log)
        VALUES ($1, 'npc', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        player.id,
        opponent.id,
        victory,
        battleData.player.currentHP,
        opponent.currentHP,
        totalDamage,
        battleData.player.maxHP - battleData.player.currentHP,
        criticalHits,
        xpEarned,
        goldEarned,
        JSON.stringify(battleLog)
      ]);
      
      // Get updated player data
      const updatedPlayer = await this.getOrCreatePlayer(userId);
      
      return {
        victory,
        rewards: {
          xp: xpEarned,
          gold: goldEarned
        },
        leveledUp,
        newLevel,
        skillPointsGained,
        battleStats: {
          totalDamage,
          criticalHits
        },
        player: updatedPlayer
      };
    } finally {
      client.release();
    }
  }
  
  // ==================== QUEST SYSTEM ====================
  
  async getQuests(userId: string): Promise<any[]> {
    const client = await pool.connect();
    try {
      const playerResult = await client.query(
        'SELECT id, level FROM game_players WHERE user_id = $1',
        [userId]
      );
      
      if (playerResult.rows.length === 0) {
        throw { statusCode: 404, code: 'PLAYER_NOT_FOUND', message: 'Player not found' };
      }
      
      const { id: playerId, level } = playerResult.rows[0];
      
      const result = await client.query(`
        SELECT gq.*, gpq.progress, gpq.completed, gpq.claimed,
               gi.name as reward_item_name, gi.rarity as reward_item_rarity
        FROM game_quests gq
        LEFT JOIN game_player_quests gpq ON gq.id = gpq.quest_id AND gpq.player_id = $1
        LEFT JOIN game_items gi ON gq.item_reward_id = gi.id
        WHERE gq.level_required <= $2
        ORDER BY gq.is_daily DESC, gq.level_required ASC, gq.id ASC
      `, [playerId, level]);
      
      return result.rows.map(quest => ({
        id: quest.id,
        name: quest.name,
        description: quest.description,
        type: quest.quest_type,
        targetValue: quest.target_value,
        progress: quest.progress || 0,
        progressPercent: Math.min(100, ((quest.progress || 0) / quest.target_value) * 100),
        completed: quest.completed || false,
        claimed: quest.claimed || false,
        isDaily: quest.is_daily,
        isRepeatable: quest.is_repeatable,
        rewards: {
          xp: quest.xp_reward,
          gold: quest.gold_reward,
          item: quest.reward_item_name ? {
            name: quest.reward_item_name,
            rarity: quest.reward_item_rarity
          } : null
        }
      }));
    } finally {
      client.release();
    }
  }
  
  async updateQuestProgress(playerId: number, questType: string, amount: number): Promise<void> {
    const client = await pool.connect();
    try {
      // Get quests of this type that aren't completed yet
      const quests = await client.query(`
        SELECT gq.id, gq.target_value, gpq.progress
        FROM game_quests gq
        JOIN game_player_quests gpq ON gq.id = gpq.quest_id
        WHERE gpq.player_id = $1 AND gq.quest_type = $2 AND gpq.completed = false
      `, [playerId, questType]);
      
      for (const quest of quests.rows) {
        let newProgress = questType === 'win_streak' 
          ? amount  // Win streak is absolute, not cumulative
          : (quest.progress || 0) + amount;
        
        const completed = newProgress >= quest.target_value;
        
        await client.query(`
          UPDATE game_player_quests
          SET progress = $1, completed = $2, completed_at = $3
          WHERE player_id = $4 AND quest_id = $5
        `, [newProgress, completed, completed ? new Date() : null, playerId, quest.id]);
      }
    } finally {
      client.release();
    }
  }
  
  async claimQuestReward(userId: string, questId: number): Promise<any> {
    const client = await pool.connect();
    try {
      const playerResult = await client.query(
        'SELECT id FROM game_players WHERE user_id = $1',
        [userId]
      );
      
      if (playerResult.rows.length === 0) {
        throw { statusCode: 404, code: 'PLAYER_NOT_FOUND', message: 'Player not found' };
      }
      
      const playerId = playerResult.rows[0].id;
      
      // Check quest status
      const questResult = await client.query(`
        SELECT gpq.*, gq.xp_reward, gq.gold_reward, gq.item_reward_id, gq.is_repeatable
        FROM game_player_quests gpq
        JOIN game_quests gq ON gpq.quest_id = gq.id
        WHERE gpq.player_id = $1 AND gpq.quest_id = $2
      `, [playerId, questId]);
      
      if (questResult.rows.length === 0) {
        throw { statusCode: 404, code: 'QUEST_NOT_FOUND', message: 'Quest not found' };
      }
      
      const quest = questResult.rows[0];
      
      if (!quest.completed) {
        throw { statusCode: 400, code: 'QUEST_NOT_COMPLETED', message: 'Quest not completed yet' };
      }
      
      if (quest.claimed) {
        throw { statusCode: 400, code: 'ALREADY_CLAIMED', message: 'Reward already claimed' };
      }
      
      // Give rewards
      await client.query(`
        UPDATE game_players SET
          xp = xp + $1,
          gold = gold + $2,
          updated_at = NOW()
        WHERE id = $3
      `, [quest.xp_reward, quest.gold_reward, playerId]);
      
      // Give item reward if any
      if (quest.item_reward_id) {
        await client.query(`
          INSERT INTO game_player_inventory (player_id, item_id, equipped)
          VALUES ($1, $2, false)
          ON CONFLICT (player_id, item_id) DO UPDATE SET quantity = game_player_inventory.quantity + 1
        `, [playerId, quest.item_reward_id]);
      }
      
      // Mark as claimed (or reset if repeatable)
      if (quest.is_repeatable) {
        await client.query(`
          UPDATE game_player_quests
          SET progress = 0, completed = false, claimed = false, started_at = NOW()
          WHERE player_id = $1 AND quest_id = $2
        `, [playerId, questId]);
      } else {
        await client.query(`
          UPDATE game_player_quests
          SET claimed = true
          WHERE player_id = $1 AND quest_id = $2
        `, [playerId, questId]);
      }
      
      return {
        xp: quest.xp_reward,
        gold: quest.gold_reward,
        itemId: quest.item_reward_id
      };
    } finally {
      client.release();
    }
  }
  
  async checkNewQuestsUnlocked(playerId: number, newLevel: number): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(`
        INSERT INTO game_player_quests (player_id, quest_id, progress)
        SELECT $1, id, 0 FROM game_quests 
        WHERE level_required = $2 AND NOT is_daily
        AND id NOT IN (SELECT quest_id FROM game_player_quests WHERE player_id = $1)
      `, [playerId, newLevel]);
    } finally {
      client.release();
    }
  }
  
  // ==================== ACHIEVEMENT SYSTEM ====================
  
  async getAchievements(userId: string): Promise<any[]> {
    const client = await pool.connect();
    try {
      const playerResult = await client.query(
        'SELECT id FROM game_players WHERE user_id = $1',
        [userId]
      );
      
      if (playerResult.rows.length === 0) {
        throw { statusCode: 404, code: 'PLAYER_NOT_FOUND', message: 'Player not found' };
      }
      
      const playerId = playerResult.rows[0].id;
      
      const result = await client.query(`
        SELECT ga.*, gpa.progress, gpa.unlocked, gpa.unlocked_at
        FROM game_achievements ga
        LEFT JOIN game_player_achievements gpa ON ga.id = gpa.achievement_id AND gpa.player_id = $1
        ORDER BY ga.target_value ASC
      `, [playerId]);
      
      return result.rows.map(ach => ({
        id: ach.id,
        name: ach.name,
        description: ach.description,
        type: ach.achievement_type,
        targetValue: ach.target_value,
        progress: ach.progress || 0,
        progressPercent: Math.min(100, ((ach.progress || 0) / ach.target_value) * 100),
        unlocked: ach.unlocked || false,
        unlockedAt: ach.unlocked_at,
        icon: ach.icon,
        rewards: {
          xp: ach.xp_reward,
          gold: ach.gold_reward,
          premium: ach.premium_reward,
          title: ach.title_reward
        }
      }));
    } finally {
      client.release();
    }
  }
  
  async updateAchievementProgress(playerId: number, achievementType: string, newValue: number): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(`
        UPDATE game_player_achievements gpa
        SET progress = $1, 
            unlocked = CASE WHEN $1 >= ga.target_value THEN true ELSE gpa.unlocked END,
            unlocked_at = CASE WHEN $1 >= ga.target_value AND NOT gpa.unlocked THEN NOW() ELSE gpa.unlocked_at END
        FROM game_achievements ga
        WHERE gpa.achievement_id = ga.id 
          AND gpa.player_id = $2 
          AND ga.achievement_type = $3
          AND NOT gpa.unlocked
      `, [newValue, playerId, achievementType]);
    } finally {
      client.release();
    }
  }
  
  // ==================== INVENTORY & ITEMS ====================
  
  async getInventory(userId: string): Promise<any> {
    const client = await pool.connect();
    try {
      const playerResult = await client.query(
        'SELECT id FROM game_players WHERE user_id = $1',
        [userId]
      );
      
      if (playerResult.rows.length === 0) {
        throw { statusCode: 404, code: 'PLAYER_NOT_FOUND', message: 'Player not found' };
      }
      
      const playerId = playerResult.rows[0].id;
      
      const result = await client.query(`
        SELECT gi.*, gpi.equipped, gpi.quantity, gpi.obtained_at
        FROM game_player_inventory gpi
        JOIN game_items gi ON gpi.item_id = gi.id
        WHERE gpi.player_id = $1
        ORDER BY gi.rarity DESC, gi.slot, gi.name
      `, [playerId]);
      
      const items = result.rows.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        slot: item.slot,
        rarity: item.rarity,
        equipped: item.equipped,
        quantity: item.quantity,
        stats: {
          strength: item.strength_bonus,
          agility: item.agility_bonus,
          vitality: item.vitality_bonus,
          critChance: item.crit_chance_bonus,
          critDamage: item.crit_damage_bonus
        },
        visual: {
          icon: item.icon,
          colorPrimary: item.color_primary,
          colorSecondary: item.color_secondary
        },
        levelRequired: item.level_required,
        sellPrice: item.sell_price
      }));
      
      // Group by slot for equipped items
      const equipped: any = {};
      const inventory: any[] = [];
      
      for (const item of items) {
        if (item.equipped) {
          equipped[item.slot] = item;
        }
        inventory.push(item);
      }
      
      return { equipped, inventory };
    } finally {
      client.release();
    }
  }
  
  async equipItem(userId: string, itemId: number): Promise<any> {
    const client = await pool.connect();
    try {
      const playerResult = await client.query(
        'SELECT id, level FROM game_players WHERE user_id = $1',
        [userId]
      );
      
      if (playerResult.rows.length === 0) {
        throw { statusCode: 404, code: 'PLAYER_NOT_FOUND', message: 'Player not found' };
      }
      
      const { id: playerId, level: playerLevel } = playerResult.rows[0];
      
      // Check if player owns the item
      const inventoryResult = await client.query(`
        SELECT gpi.*, gi.slot, gi.level_required
        FROM game_player_inventory gpi
        JOIN game_items gi ON gpi.item_id = gi.id
        WHERE gpi.player_id = $1 AND gpi.item_id = $2
      `, [playerId, itemId]);
      
      if (inventoryResult.rows.length === 0) {
        throw { statusCode: 404, code: 'ITEM_NOT_OWNED', message: 'You do not own this item' };
      }
      
      const item = inventoryResult.rows[0];
      
      if (playerLevel < item.level_required) {
        throw { statusCode: 400, code: 'LEVEL_TOO_LOW', message: `Requires level ${item.level_required}` };
      }
      
      // Unequip current item in that slot
      await client.query(`
        UPDATE game_player_inventory gpi
        SET equipped = false
        FROM game_items gi
        WHERE gpi.item_id = gi.id 
          AND gpi.player_id = $1 
          AND gi.slot = $2
      `, [playerId, item.slot]);
      
      // Equip new item
      await client.query(`
        UPDATE game_player_inventory
        SET equipped = true
        WHERE player_id = $1 AND item_id = $2
      `, [playerId, itemId]);
      
      return this.getInventory(userId);
    } finally {
      client.release();
    }
  }
  
  async unequipItem(userId: string, itemId: number): Promise<any> {
    const client = await pool.connect();
    try {
      const playerResult = await client.query(
        'SELECT id FROM game_players WHERE user_id = $1',
        [userId]
      );
      
      if (playerResult.rows.length === 0) {
        throw { statusCode: 404, code: 'PLAYER_NOT_FOUND', message: 'Player not found' };
      }
      
      const playerId = playerResult.rows[0].id;
      
      await client.query(`
        UPDATE game_player_inventory
        SET equipped = false
        WHERE player_id = $1 AND item_id = $2
      `, [playerId, itemId]);
      
      return this.getInventory(userId);
    } finally {
      client.release();
    }
  }
  
  // ==================== DAILY REWARDS ====================
  
  async claimDailyReward(userId: string): Promise<any> {
    const client = await pool.connect();
    try {
      const playerResult = await client.query(
        'SELECT * FROM game_players WHERE user_id = $1',
        [userId]
      );
      
      if (playerResult.rows.length === 0) {
        throw { statusCode: 404, code: 'PLAYER_NOT_FOUND', message: 'Player not found' };
      }
      
      const player = playerResult.rows[0];
      const today = new Date().toISOString().split('T')[0];
      
      if (player.last_daily_claim === today) {
        throw { statusCode: 400, code: 'ALREADY_CLAIMED', message: 'Daily reward already claimed today' };
      }
      
      // Check streak
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      let newStreak = 1;
      if (player.last_daily_claim === yesterdayStr) {
        newStreak = (player.daily_streak % 7) + 1; // Cycle 1-7
      }
      
      // Get reward for this day
      const rewardResult = await client.query(
        'SELECT * FROM game_daily_rewards WHERE day_number = $1',
        [newStreak]
      );
      
      if (rewardResult.rows.length === 0) {
        throw { statusCode: 500, code: 'REWARD_NOT_FOUND', message: 'Daily reward configuration error' };
      }
      
      const reward = rewardResult.rows[0];
      
      // Give rewards
      await client.query(`
        UPDATE game_players SET
          xp = xp + $1,
          gold = gold + $2,
          stamina = LEAST(stamina + $3, max_stamina),
          daily_streak = $4,
          last_daily_claim = $5,
          updated_at = NOW()
        WHERE id = $6
      `, [reward.xp_reward, reward.gold_reward, reward.stamina_reward, newStreak, today, player.id]);
      
      // Give item if any
      if (reward.item_reward_id) {
        await client.query(`
          INSERT INTO game_player_inventory (player_id, item_id, equipped)
          VALUES ($1, $2, false)
          ON CONFLICT (player_id, item_id) DO UPDATE SET quantity = game_player_inventory.quantity + 1
        `, [player.id, reward.item_reward_id]);
      }
      
      return {
        day: newStreak,
        rewards: {
          xp: reward.xp_reward,
          gold: reward.gold_reward,
          stamina: reward.stamina_reward,
          itemId: reward.item_reward_id
        }
      };
    } finally {
      client.release();
    }
  }
  
  // ==================== SHOP ====================
  
  async getShopItems(userId: string): Promise<any[]> {
    const client = await pool.connect();
    try {
      const playerResult = await client.query(
        'SELECT id, level FROM game_players WHERE user_id = $1',
        [userId]
      );
      
      if (playerResult.rows.length === 0) {
        throw { statusCode: 404, code: 'PLAYER_NOT_FOUND', message: 'Player not found' };
      }
      
      const { id: playerId, level } = playerResult.rows[0];
      
      // Get items that can be purchased and player doesn't own
      const result = await client.query(`
        SELECT gi.* FROM game_items gi
        WHERE gi.gold_cost > 0 
          AND gi.level_required <= $1
          AND gi.id NOT IN (SELECT item_id FROM game_player_inventory WHERE player_id = $2)
        ORDER BY gi.level_required, gi.rarity, gi.gold_cost
      `, [level + 5, playerId]); // Show items up to 5 levels ahead
      
      return result.rows.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        slot: item.slot,
        rarity: item.rarity,
        stats: {
          strength: item.strength_bonus,
          agility: item.agility_bonus,
          vitality: item.vitality_bonus,
          critChance: item.crit_chance_bonus,
          critDamage: item.crit_damage_bonus
        },
        visual: {
          icon: item.icon,
          colorPrimary: item.color_primary
        },
        levelRequired: item.level_required,
        cost: {
          gold: item.gold_cost,
          premium: item.premium_cost
        },
        canPurchase: level >= item.level_required
      }));
    } finally {
      client.release();
    }
  }
  
  async purchaseItem(userId: string, itemId: number): Promise<any> {
    const client = await pool.connect();
    try {
      const playerResult = await client.query(
        'SELECT * FROM game_players WHERE user_id = $1',
        [userId]
      );
      
      if (playerResult.rows.length === 0) {
        throw { statusCode: 404, code: 'PLAYER_NOT_FOUND', message: 'Player not found' };
      }
      
      const player = playerResult.rows[0];
      
      // Get item
      const itemResult = await client.query(
        'SELECT * FROM game_items WHERE id = $1',
        [itemId]
      );
      
      if (itemResult.rows.length === 0) {
        throw { statusCode: 404, code: 'ITEM_NOT_FOUND', message: 'Item not found' };
      }
      
      const item = itemResult.rows[0];
      
      // Check level
      if (player.level < item.level_required) {
        throw { statusCode: 400, code: 'LEVEL_TOO_LOW', message: `Requires level ${item.level_required}` };
      }
      
      // Check gold
      if (player.gold < item.gold_cost) {
        throw { statusCode: 400, code: 'INSUFFICIENT_GOLD', message: 'Not enough gold' };
      }
      
      // Check if already owned
      const ownedResult = await client.query(
        'SELECT id FROM game_player_inventory WHERE player_id = $1 AND item_id = $2',
        [player.id, itemId]
      );
      
      if (ownedResult.rows.length > 0) {
        throw { statusCode: 400, code: 'ALREADY_OWNED', message: 'You already own this item' };
      }
      
      // Deduct gold and add item
      await client.query(
        'UPDATE game_players SET gold = gold - $1 WHERE id = $2',
        [item.gold_cost, player.id]
      );
      
      await client.query(`
        INSERT INTO game_player_inventory (player_id, item_id, equipped)
        VALUES ($1, $2, false)
      `, [player.id, itemId]);
      
      return {
        success: true,
        item: {
          id: item.id,
          name: item.name,
          rarity: item.rarity
        },
        goldSpent: item.gold_cost
      };
    } finally {
      client.release();
    }
  }

  // ==================== GAME SETTINGS ====================

  async getGameSettings(): Promise<Record<string, any>> {
    const result = await pool.query('SELECT setting_key, setting_value FROM game_settings');
    const settings: Record<string, any> = {};
    for (const row of result.rows) {
      settings[row.setting_key] = row.setting_value;
    }
    return settings;
  }

  async updateGameSetting(key: string, value: any): Promise<void> {
    await pool.query(
      `INSERT INTO game_settings (setting_key, setting_value, updated_at) 
       VALUES ($1, $2, NOW()) 
       ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2, updated_at = NOW()`,
      [key, JSON.stringify(value)]
    );
  }
}

export default new GameService();
