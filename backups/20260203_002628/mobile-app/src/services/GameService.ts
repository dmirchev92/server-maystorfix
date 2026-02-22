/**
 * Game Service
 * API calls for the fighting game gamification feature
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://snapfix.bg/api/v1';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

async function getAuthToken(): Promise<string | null> {
  // Must use 'auth_token' to match ApiService
  return AsyncStorage.getItem('auth_token');
}

async function apiCall<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any
): Promise<ApiResponse<T>> {
  const token = await getAuthToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const config: RequestInit = {
    method,
    headers,
  };
  
  if (body && method !== 'GET') {
    config.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json();
    return data;
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error.message || 'Network request failed'
      }
    };
  }
}

// Player types
export interface PlayerStats {
  strength: number;
  agility: number;
  vitality: number;
  critChance: number;
  critDamage: number;
}

export interface CalculatedStats {
  maxHP: number;
  damage: number;
  dodgeChance: number;
  critChance: number;
  critDamage: number;
}

export interface BattleStats {
  battlesWon: number;
  battlesLost: number;
  totalDamageDealt: number;
  totalCriticalHits: number;
  currentWinStreak: number;
  bestWinStreak: number;
}

export interface Player {
  id: number;
  userId: string;
  characterClass: string;
  level: number;
  xp: number;
  xpForNextLevel: number;
  xpProgress: number;
  skillPoints: number;
  stats: PlayerStats;
  calculated: CalculatedStats;
  stamina: number;
  maxStamina: number;
  secondsUntilNextStamina: number;
  gold: number;
  premiumCurrency: number;
  battleStats: BattleStats;
  dailyStreak: number;
  lastDailyClaim: string | null;
}

// Item types
export interface ItemStats {
  strength: number;
  agility: number;
  vitality: number;
  critChance: number;
  critDamage: number;
}

export interface Item {
  id: number;
  name: string;
  description: string;
  slot: 'weapon' | 'armor' | 'helmet' | 'ring' | 'boots';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  equipped: boolean;
  quantity: number;
  stats: ItemStats;
  visual: {
    icon: string;
    colorPrimary: string;
    colorSecondary?: string;
  };
  levelRequired: number;
  sellPrice: number;
}

export interface Inventory {
  equipped: Record<string, Item>;
  inventory: Item[];
}

// Quest types
export interface Quest {
  id: number;
  name: string;
  description: string;
  type: string;
  targetValue: number;
  progress: number;
  progressPercent: number;
  completed: boolean;
  claimed: boolean;
  isDaily: boolean;
  isRepeatable: boolean;
  rewards: {
    xp: number;
    gold: number;
    item: { name: string; rarity: string } | null;
  };
}

// Achievement types
export interface Achievement {
  id: number;
  name: string;
  description: string;
  type: string;
  targetValue: number;
  progress: number;
  progressPercent: number;
  unlocked: boolean;
  unlockedAt: string | null;
  icon: string;
  rewards: {
    xp: number;
    gold: number;
    premium: number;
    title: string | null;
  };
}

// Opponent types
export interface Opponent {
  id: number;
  name: string;
  characterClass: string;
  level: number;
  isBoss: boolean;
  power: number;
  stats: PlayerStats;
  calculated: CalculatedStats;
  rewards: {
    xp: number;
    gold: number;
  };
}

// Battle types
export interface BattleCharacter {
  id: number;
  name: string;
  characterClass: string;
  level: number;
  maxHP: number;
  currentHP: number;
  damage: number;
  dodgeChance: number;
  critChance: number;
  critDamage: number;
  stats?: PlayerStats;
  isBoss?: boolean;
}

export interface BattleLogEntry {
  actor: 'player' | 'opponent';
  action: 'attack' | 'defend' | 'charge' | 'release';
  damage: number;
  dodged: boolean;
  critical: boolean;
  blocked?: boolean;
  message: string;
}

export interface BattleData {
  battleId: string;
  player: BattleCharacter;
  opponent: BattleCharacter;
  rewards: {
    xp: number;
    gold: number;
  };
  battleLog?: BattleLogEntry[];
  battleEnded?: boolean;
  victory?: boolean;
  playerDefending?: boolean;
}

export interface BattleResult {
  victory: boolean;
  rewards: {
    xp: number;
    gold: number;
  };
  leveledUp: boolean;
  newLevel: number;
  skillPointsGained: number;
  battleStats: {
    totalDamage: number;
    criticalHits: number;
  };
  player: Player;
}

// Shop item type
export interface ShopItem {
  id: number;
  name: string;
  description: string;
  slot: string;
  rarity: string;
  stats: ItemStats;
  visual: {
    icon: string;
    colorPrimary: string;
  };
  levelRequired: number;
  cost: {
    gold: number;
    premium: number;
  };
  canPurchase: boolean;
}

// API Functions
class GameAPI {
  // Player
  async getPlayer(): Promise<ApiResponse<Player>> {
    return apiCall<Player>('/game/player');
  }
  
  async changeClass(characterClass: string): Promise<ApiResponse<Player>> {
    return apiCall<Player>('/game/player/class', 'POST', { characterClass });
  }
  
  async upgradeStats(stat: string, points: number): Promise<ApiResponse<Player>> {
    return apiCall<Player>('/game/player/upgrade', 'POST', { stat, points });
  }
  
  // Battle
  async getOpponents(): Promise<ApiResponse<Opponent[]>> {
    return apiCall<Opponent[]>('/game/opponents');
  }
  
  async startBattle(opponentId: number): Promise<ApiResponse<BattleData>> {
    return apiCall<BattleData>('/game/battle/start', 'POST', { opponentId });
  }
  
  async performAction(action: string, battleData: BattleData): Promise<ApiResponse<BattleData>> {
    return apiCall<BattleData>('/game/battle/action', 'POST', { action, battleData });
  }
  
  async endBattle(battleData: BattleData): Promise<ApiResponse<BattleResult>> {
    return apiCall<BattleResult>('/game/battle/end', 'POST', { battleData });
  }
  
  // Quests
  async getQuests(): Promise<ApiResponse<Quest[]>> {
    return apiCall<Quest[]>('/game/quests');
  }
  
  async claimQuest(questId: number): Promise<ApiResponse<{ xp: number; gold: number; itemId: number | null }>> {
    return apiCall('/game/quests/' + questId + '/claim', 'POST');
  }
  
  // Achievements
  async getAchievements(): Promise<ApiResponse<Achievement[]>> {
    return apiCall<Achievement[]>('/game/achievements');
  }
  
  // Inventory
  async getInventory(): Promise<ApiResponse<Inventory>> {
    return apiCall<Inventory>('/game/inventory');
  }
  
  async equipItem(itemId: number): Promise<ApiResponse<Inventory>> {
    return apiCall<Inventory>('/game/inventory/equip', 'POST', { itemId });
  }
  
  async unequipItem(itemId: number): Promise<ApiResponse<Inventory>> {
    return apiCall<Inventory>('/game/inventory/unequip', 'POST', { itemId });
  }
  
  // Shop
  async getShopItems(): Promise<ApiResponse<ShopItem[]>> {
    return apiCall<ShopItem[]>('/game/shop');
  }
  
  async purchaseItem(itemId: number): Promise<ApiResponse<{ success: boolean; item: any; goldSpent: number }>> {
    return apiCall('/game/shop/purchase', 'POST', { itemId });
  }
  
  // Daily
  async claimDailyReward(): Promise<ApiResponse<{ day: number; rewards: any }>> {
    return apiCall('/game/daily/claim', 'POST');
  }
  
  // Settings (real-time configuration)
  async getSettings(): Promise<ApiResponse<Record<string, any>>> {
    return apiCall('/game/settings');
  }
}

export const gameAPI = new GameAPI();
export default gameAPI;
