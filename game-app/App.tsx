/**
 * Maystor Fighter - Standalone Fighting Game App
 * Mobile-first 2D turn-based fighting game with Mortal Kombat-style animations
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  RefreshControl,
  Vibration,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Rect, Circle, Polygon, Ellipse, Path, G, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const API_BASE_URL = 'https://servicetextpro.com/api/v1';

// Types
type GameTab = 'lobby' | 'stats' | 'items' | 'quests';

interface Player {
  id: number;
  level: number;
  xp: number;
  xpForNextLevel: number;
  xpProgress: number;
  skillPoints: number;
  characterClass: string;
  stats: { strength: number; agility: number; vitality: number; critChance: number; critDamage: number };
  calculated: { maxHP: number; damage: number; dodgeChance: number };
  stamina: number;
  maxStamina: number;
  secondsUntilNextStamina: number;
  gold: number;
  battleStats: { battlesWon: number; battlesLost: number; bestWinStreak: number; totalCriticalHits: number };
}

interface Opponent {
  id: number;
  name: string;
  characterClass: string;
  level: number;
  isBoss: boolean;
  power: number;
  stats: { strength: number; agility: number; vitality: number; critChance: number; critDamage: number };
  calculated: { maxHP: number; damage: number; dodgeChance: number };
  rewards: { xp: number; gold: number };
}

interface Quest {
  id: number;
  name: string;
  description: string;
  targetValue: number;
  progress: number;
  progressPercent: number;
  completed: boolean;
  claimed: boolean;
  isDaily: boolean;
  rewards: { xp: number; gold: number };
}

interface Item {
  id: number;
  name: string;
  slot: string;
  rarity: string;
  equipped: boolean;
  stats: { strength: number; agility: number; vitality: number; critChance: number; critDamage: number };
}

interface BattleCharacter {
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
}

interface BattleData {
  battleId: string;
  player: BattleCharacter;
  opponent: BattleCharacter;
  rewards: { xp: number; gold: number };
  battleLog?: any[];
  battleEnded?: boolean;
  victory?: boolean;
}

interface BattleResult {
  victory: boolean;
  rewards: { xp: number; gold: number };
  leveledUp: boolean;
  newLevel: number;
  skillPointsGained: number;
  player: Player;
}

// Colors
const CLASS_COLORS: Record<string, { primary: string; secondary: string; accent: string }> = {
  warrior: { primary: '#E53935', secondary: '#FFCDD2', accent: '#B71C1C' },
  mage: { primary: '#7B1FA2', secondary: '#E1BEE7', accent: '#4A148C' },
  rogue: { primary: '#455A64', secondary: '#CFD8DC', accent: '#263238' },
  paladin: { primary: '#FFC107', secondary: '#FFF8E1', accent: '#FF8F00' },
  berserker: { primary: '#FF5722', secondary: '#FFCCBC', accent: '#BF360C' },
  archer: { primary: '#4CAF50', secondary: '#C8E6C9', accent: '#1B5E20' },
};

const RARITY_COLORS: Record<string, string> = {
  common: '#9E9E9E',
  rare: '#2196F3',
  epic: '#9C27B0',
  legendary: '#FF9800',
};

// API Functions
async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem('authToken');
}

async function apiCall<T>(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any): Promise<{ success: boolean; data?: T; error?: any }> {
  const token = await getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    return await response.json();
  } catch (error: any) {
    return { success: false, error: { message: error.message } };
  }
}

// Character Component
const GameCharacter: React.FC<{
  characterClass: string;
  isPlayer: boolean;
  isAttacking: boolean;
  isHit: boolean;
  isCritical: boolean;
  isDefending: boolean;
  isDead: boolean;
  size?: number;
}> = ({ characterClass, isPlayer, isAttacking, isHit, isCritical, isDefending, isDead, size = 100 }) => {
  const colors = CLASS_COLORS[characterClass] || CLASS_COLORS.warrior;
  const translateX = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isAttacking) {
      const dashDistance = isPlayer ? 50 : -50;
      Animated.sequence([
        Animated.timing(translateX, { toValue: dashDistance, duration: 150, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.15, duration: 80, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [isAttacking]);

  useEffect(() => {
    if (isHit) {
      const recoilDistance = isPlayer ? -10 : 10;
      Animated.sequence([
        Animated.timing(translateX, { toValue: recoilDistance, duration: 80, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [isHit]);

  useEffect(() => {
    if (isDead) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0.3, duration: 500, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.7, duration: 500, useNativeDriver: true }),
      ]).start();
    }
  }, [isDead]);

  const renderCharacter = () => (
    <Svg width={size} height={size * 1.4} viewBox="0 0 100 140">
      <G transform={isPlayer ? '' : 'translate(100, 0) scale(-1, 1)'}>
        <Rect x="35" y="95" width="12" height="35" rx="3" fill="#5D4037" />
        <Rect x="53" y="95" width="12" height="35" rx="3" fill="#5D4037" />
        <Path d="M30 50 L70 50 L75 95 L25 95 Z" fill={colors.primary} />
        <Rect x="40" y="55" width="20" height="25" rx="2" fill={colors.secondary} opacity="0.5" />
        <Ellipse cx="22" cy="75" rx="16" ry="20" fill={colors.secondary} stroke={colors.accent} strokeWidth="2" />
        <Circle cx="50" cy="35" r="16" fill="#FFE0B2" />
        <Path d="M34 35 Q34 18 50 15 Q66 18 66 35" fill={colors.primary} />
        <G transform={isAttacking ? 'rotate(-45, 78, 60)' : ''}>
          <Rect x="75" y="48" width="4" height="45" rx="1" fill="#9E9E9E" />
          <Polygon points="77,15 74,48 80,48" fill="#E0E0E0" />
        </G>
      </G>
    </Svg>
  );

  return (
    <Animated.View style={{ transform: [{ translateX }, { scale }], opacity }}>
      {isDefending && <View style={styles.defendAura} />}
      {isCritical && <View style={styles.criticalAura} />}
      {isHit && <View style={styles.hitOverlay} />}
      {renderCharacter()}
    </Animated.View>
  );
};

// Main App
const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<GameTab>('lobby');
  const [player, setPlayer] = useState<Player | null>(null);
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [inventory, setInventory] = useState<{ equipped: Record<string, Item>; inventory: Item[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inBattle, setInBattle] = useState(false);
  const [battleData, setBattleData] = useState<BattleData | null>(null);
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [staminaTimer, setStaminaTimer] = useState(0);
  const [turnIndicator, setTurnIndicator] = useState<'player' | 'enemy'>('player');
  const [playerAttacking, setPlayerAttacking] = useState(false);
  const [opponentAttacking, setOpponentAttacking] = useState(false);
  const [playerHit, setPlayerHit] = useState(false);
  const [opponentHit, setOpponentHit] = useState(false);
  const [playerCritical, setPlayerCritical] = useState(false);
  const [opponentCritical, setOpponentCritical] = useState(false);
  const [playerDefending, setPlayerDefending] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [battleLog, setBattleLog] = useState<any[]>([]);
  const screenShake = useRef(new Animated.Value(0)).current;

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (player && player.stamina < player.maxStamina) {
      setStaminaTimer(player.secondsUntilNextStamina);
      const interval = setInterval(() => {
        setStaminaTimer(prev => {
          if (prev <= 1) { loadPlayer(); return 60; }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [player?.stamina]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadPlayer(), loadOpponents(), loadQuests(), loadInventory()]);
    setLoading(false);
  };

  const loadPlayer = async () => {
    const r = await apiCall<Player>('/game/player');
    if (r.success && r.data) setPlayer(r.data);
  };

  const loadOpponents = async () => {
    const r = await apiCall<Opponent[]>('/game/opponents');
    if (r.success && r.data) setOpponents(r.data);
  };

  const loadQuests = async () => {
    const r = await apiCall<Quest[]>('/game/quests');
    if (r.success && r.data) setQuests(r.data);
  };

  const loadInventory = async () => {
    const r = await apiCall<{ equipped: Record<string, Item>; inventory: Item[] }>('/game/inventory');
    if (r.success && r.data) setInventory(r.data);
  };

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const triggerScreenShake = (intensity: number = 5) => {
    Animated.sequence([
      Animated.timing(screenShake, { toValue: intensity, duration: 40, useNativeDriver: true }),
      Animated.timing(screenShake, { toValue: -intensity, duration: 40, useNativeDriver: true }),
      Animated.timing(screenShake, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
    if (Platform.OS !== 'web') Vibration.vibrate(50);
  };

  const startBattle = async (opponent: Opponent) => {
    if (!player || player.stamina < 15) return;
    const r = await apiCall<BattleData>('/game/battle/start', 'POST', { opponentId: opponent.id });
    if (r.success && r.data) {
      setBattleData(r.data);
      setInBattle(true);
      setBattleResult(null);
      setBattleLog([]);
      setTurnIndicator('player');
      setPlayer(prev => prev ? { ...prev, stamina: prev.stamina - 15 } : null);
    }
  };

  const performAction = async (action: 'attack' | 'defend' | 'special') => {
    if (!battleData || isProcessing || battleData.battleEnded) return;
    setIsProcessing(true);
    setTurnIndicator('enemy');

    if (action === 'defend') {
      setPlayerDefending(true);
      setBattleLog(prev => [...prev, { message: 'You take a defensive stance!' }]);
      setTimeout(() => performEnemyTurn(), 600);
      return;
    }

    setPlayerAttacking(true);
    setTimeout(async () => {
      setPlayerAttacking(false);
      const r = await apiCall<BattleData>('/game/battle/action', 'POST', { action, battleData });
      if (r.success && r.data) {
        const newData = r.data;
        const log = newData.battleLog || [];
        const playerAction = log.find((l: any) => l.actor === 'player');
        if (playerAction) {
          setBattleLog(prev => [...prev, playerAction]);
          if (!playerAction.dodged && playerAction.damage > 0) {
            setOpponentHit(true);
            if (playerAction.critical) { setOpponentCritical(true); triggerScreenShake(10); }
            else triggerScreenShake(5);
            setTimeout(() => { setOpponentHit(false); setOpponentCritical(false); }, 200);
          }
        }
        setBattleData(newData);
        if (newData.battleEnded) endBattle(newData);
        else setTimeout(() => performEnemyTurn(), 800);
      }
    }, 400);
  };

  const performEnemyTurn = async () => {
    if (!battleData) return;
    setOpponentAttacking(true);
    setTimeout(async () => {
      setOpponentAttacking(false);
      const r = await apiCall<BattleData>('/game/battle/action', 'POST', { action: 'attack', battleData });
      if (r.success && r.data) {
        const newData = r.data;
        const log = newData.battleLog || [];
        const enemyAction = log.find((l: any) => l.actor === 'opponent');
        if (enemyAction) {
          let finalDamage = enemyAction.damage;
          if (playerDefending && finalDamage > 0) finalDamage = Math.floor(finalDamage * 0.5);
          setBattleLog(prev => [...prev, { ...enemyAction, damage: finalDamage }]);
          if (!enemyAction.dodged && finalDamage > 0) {
            setPlayerHit(true);
            if (enemyAction.critical) { setPlayerCritical(true); triggerScreenShake(10); }
            else triggerScreenShake(playerDefending ? 3 : 5);
            setTimeout(() => { setPlayerHit(false); setPlayerCritical(false); }, 200);
          }
        }
        setPlayerDefending(false);
        setBattleData(newData);
        if (newData.battleEnded) endBattle(newData);
        else { setTurnIndicator('player'); setIsProcessing(false); }
      }
    }, 400);
  };

  const endBattle = async (finalData: BattleData) => {
    const r = await apiCall<BattleResult>('/game/battle/end', 'POST', { battleData: finalData });
    if (r.success && r.data) {
      setBattleResult(r.data);
      setPlayer(r.data.player);
      if (r.data.victory && Platform.OS !== 'web') Vibration.vibrate([0, 100, 50, 100]);
    }
    setIsProcessing(false);
  };

  const exitBattle = () => {
    setInBattle(false);
    setBattleData(null);
    setBattleResult(null);
    setBattleLog([]);
    loadOpponents();
    loadQuests();
  };

  const upgradeStat = async (stat: string) => {
    if (!player || player.skillPoints < 1) return;
    const r = await apiCall<Player>('/game/player/upgrade', 'POST', { stat, points: 1 });
    if (r.success && r.data) setPlayer(r.data);
  };

  const equipItem = async (itemId: number) => {
    const r = await apiCall<{ equipped: Record<string, Item>; inventory: Item[] }>('/game/inventory/equip', 'POST', { itemId });
    if (r.success && r.data) setInventory(r.data);
  };

  const claimQuest = async (questId: number) => {
    const r = await apiCall('/game/quests/' + questId + '/claim', 'POST');
    if (r.success) { loadPlayer(); loadQuests(); }
  };

  const getHealthColor = (percent: number) => percent > 60 ? '#4CAF50' : percent > 30 ? '#FFC107' : '#F44336';

  // Render functions
  const renderTopBar = () => (
    <View style={styles.topBar}>
      <View style={styles.topBarLeft}>
        <View style={styles.levelCircle}><Text style={styles.levelNumber}>{player?.level || 1}</Text></View>
        <View style={styles.xpBarContainer}>
          <View style={styles.xpBarOuter}><View style={[styles.xpBarInner, { width: `${player?.xpProgress || 0}%` }]} /></View>
          <Text style={styles.xpText}>{player?.xp || 0} / {player?.xpForNextLevel || 150} XP</Text>
        </View>
      </View>
      <View style={styles.topBarRight}>
        <View style={styles.staminaContainer}>
          <Text style={styles.staminaIcon}>⚡</Text>
          <Text style={styles.staminaText}>{player?.stamina || 0}/{player?.maxStamina || 100}</Text>
          {player && player.stamina < player.maxStamina && <Text style={styles.staminaTimer}>+1 in {staminaTimer}s</Text>}
        </View>
        <View style={styles.goldContainer}><Text style={styles.goldIcon}>💰</Text><Text style={styles.goldText}>{player?.gold || 0}</Text></View>
      </View>
    </View>
  );

  const renderBattle = () => {
    if (!battleData) return null;
    const playerHpPct = (battleData.player.currentHP / battleData.player.maxHP) * 100;
    const oppHpPct = (battleData.opponent.currentHP / battleData.opponent.maxHP) * 100;

    return (
      <Animated.View style={[styles.battleContainer, { transform: [{ translateX: screenShake }] }]}>
        <View style={styles.turnBanner}><Text style={styles.turnText}>{turnIndicator === 'player' ? '⚔️ YOUR TURN' : '👹 ENEMY TURN'}</Text></View>
        <View style={styles.hpSection}>
          <Text style={styles.hpName}>{battleData.opponent.name} Lv.{battleData.opponent.level}</Text>
          <View style={styles.hpBarOuter}><View style={[styles.hpBarInner, { width: `${Math.max(0, oppHpPct)}%`, backgroundColor: getHealthColor(oppHpPct) }]} /></View>
          <Text style={styles.hpText}>{Math.max(0, battleData.opponent.currentHP)} / {battleData.opponent.maxHP}</Text>
        </View>
        <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.arena}>
          <View style={styles.charLeft}>
            <GameCharacter characterClass={player?.characterClass || 'warrior'} isPlayer={true} isAttacking={playerAttacking} isHit={playerHit} isCritical={playerCritical} isDefending={playerDefending} isDead={battleData.player.currentHP <= 0} />
          </View>
          <View style={styles.charRight}>
            <GameCharacter characterClass={battleData.opponent.characterClass} isPlayer={false} isAttacking={opponentAttacking} isHit={opponentHit} isCritical={opponentCritical} isDefending={false} isDead={battleData.opponent.currentHP <= 0} />
          </View>
        </LinearGradient>
        <View style={styles.hpSection}>
          <Text style={styles.hpName}>You Lv.{player?.level || 1}</Text>
          <View style={styles.hpBarOuter}><View style={[styles.hpBarInner, { width: `${Math.max(0, playerHpPct)}%`, backgroundColor: getHealthColor(playerHpPct) }]} /></View>
          <Text style={styles.hpText}>{Math.max(0, battleData.player.currentHP)} / {battleData.player.maxHP}</Text>
        </View>
        {battleResult && (
          <View style={styles.resultOverlay}>
            <View style={[styles.resultCard, battleResult.victory ? styles.victoryCard : styles.defeatCard]}>
              <Text style={styles.resultTitle}>{battleResult.victory ? '🏆 VICTORY!' : '💀 DEFEAT'}</Text>
              {battleResult.victory && (
                <View style={styles.rewards}>
                  <Text style={styles.rewardText}>+{battleResult.rewards.xp} XP</Text>
                  <Text style={styles.rewardText}>+{battleResult.rewards.gold} Gold</Text>
                  {battleResult.leveledUp && <Text style={styles.levelUpText}>🎉 LEVEL UP! Lv.{battleResult.newLevel}</Text>}
                </View>
              )}
              <TouchableOpacity style={styles.continueBtn} onPress={exitBattle}><Text style={styles.continueBtnText}>CONTINUE</Text></TouchableOpacity>
            </View>
          </View>
        )}
        {!battleResult && (
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actionBtn, styles.attackBtn, (turnIndicator !== 'player' || isProcessing) && styles.disabledBtn]} onPress={() => performAction('attack')} disabled={turnIndicator !== 'player' || isProcessing}>
              <Text style={styles.actionIcon}>⚔️</Text><Text style={styles.actionLabel}>ATTACK</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.defendBtn, (turnIndicator !== 'player' || isProcessing) && styles.disabledBtn]} onPress={() => performAction('defend')} disabled={turnIndicator !== 'player' || isProcessing}>
              <Text style={styles.actionIcon}>🛡️</Text><Text style={styles.actionLabel}>DEFEND</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.specialBtn, (turnIndicator !== 'player' || isProcessing) && styles.disabledBtn]} onPress={() => performAction('special')} disabled={turnIndicator !== 'player' || isProcessing}>
              <Text style={styles.actionIcon}>✨</Text><Text style={styles.actionLabel}>SPECIAL</Text>
            </TouchableOpacity>
          </View>
        )}
        <ScrollView style={styles.logContainer}>{battleLog.slice(-3).map((log, i) => <Text key={i} style={styles.logEntry}>{log.message}</Text>)}</ScrollView>
      </Animated.View>
    );
  };

  const renderLobby = () => (
    <ScrollView style={styles.tabContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Text style={styles.sectionTitle}>🎮 Challenge Opponents</Text>
      <Text style={styles.sectionSubtitle}>15 stamina per battle</Text>
      {opponents.map(opp => (
        <TouchableOpacity key={opp.id} style={[styles.oppCard, opp.isBoss && styles.bossCard]} onPress={() => startBattle(opp)} disabled={!player || player.stamina < 15}>
          <View style={styles.oppLeft}>
            <View style={[styles.oppAvatar, { backgroundColor: CLASS_COLORS[opp.characterClass]?.primary || '#666' }]}><Text style={styles.oppAvatarText}>{opp.characterClass.charAt(0).toUpperCase()}</Text></View>
            <View style={styles.oppInfo}>
              <Text style={styles.oppName}>{opp.name} {opp.isBoss && '👑'}</Text>
              <Text style={styles.oppClass}>{opp.characterClass} • Lv.{opp.level}</Text>
              <Text style={styles.oppPower}>⚡ Power: {opp.power}</Text>
            </View>
          </View>
          <View style={styles.oppRight}>
            <Text style={styles.rewardValue}>+{opp.rewards.xp} XP</Text>
            <Text style={styles.rewardValue}>+{opp.rewards.gold} 💰</Text>
            <View style={[styles.fightBtn, (!player || player.stamina < 15) && styles.disabledBtn]}><Text style={styles.fightText}>FIGHT</Text></View>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderStats = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>📊 Stats - {player?.characterClass?.toUpperCase()}</Text>
      {player && player.skillPoints > 0 && <View style={styles.skillBanner}><Text style={styles.skillLabel}>🎯 {player.skillPoints} Skill Points Available!</Text></View>}
      <View style={styles.statsGrid}>
        {[{ key: 'strength', icon: '💪', val: player?.stats.strength || 10 }, { key: 'agility', icon: '🏃', val: player?.stats.agility || 10 }, { key: 'vitality', icon: '❤️', val: player?.stats.vitality || 10 }, { key: 'crit_chance', icon: '🎯', val: player?.stats.critChance || 10 }, { key: 'crit_damage', icon: '💥', val: player?.stats.critDamage || 150 }].map(s => (
          <TouchableOpacity key={s.key} style={[styles.statCard, player?.skillPoints && player.skillPoints > 0 ? styles.upgradableStat : null]} onPress={() => upgradeStat(s.key)} disabled={!player?.skillPoints}>
            <Text style={styles.statIcon}>{s.icon}</Text><Text style={styles.statValue}>{s.val}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.record}>
        <View style={styles.recordItem}><Text style={styles.recordVal}>{player?.battleStats.battlesWon || 0}</Text><Text style={styles.recordLbl}>Wins</Text></View>
        <View style={styles.recordItem}><Text style={styles.recordVal}>{player?.battleStats.battlesLost || 0}</Text><Text style={styles.recordLbl}>Losses</Text></View>
        <View style={styles.recordItem}><Text style={styles.recordVal}>{player?.battleStats.bestWinStreak || 0}</Text><Text style={styles.recordLbl}>Best Streak</Text></View>
      </View>
    </ScrollView>
  );

  const renderItems = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>🎒 Equipment</Text>
      {inventory?.inventory.map(item => (
        <TouchableOpacity key={item.id} style={[styles.itemCard, { borderLeftColor: RARITY_COLORS[item.rarity] }]} onPress={() => equipItem(item.id)}>
          <Text style={[styles.itemName, { color: RARITY_COLORS[item.rarity] }]}>{item.name}</Text>
          <Text style={item.equipped ? styles.equippedTag : styles.equipBtn}>{item.equipped ? 'EQUIPPED' : 'EQUIP'}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderQuests = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>📜 Quests</Text>
      {quests.map(q => (
        <View key={q.id} style={[styles.questCard, q.completed && styles.questDone]}>
          <Text style={styles.questName}>{q.name} {q.isDaily && <Text style={styles.dailyTag}>DAILY</Text>}</Text>
          <Text style={styles.questDesc}>{q.description}</Text>
          <View style={styles.questProgOuter}><View style={[styles.questProgInner, { width: `${q.progressPercent}%` }]} /></View>
          <Text style={styles.questProgText}>{q.progress} / {q.targetValue}</Text>
          <Text style={styles.questReward}>+{q.rewards.xp} XP • +{q.rewards.gold} 💰</Text>
          {q.completed && !q.claimed && <TouchableOpacity style={styles.claimBtn} onPress={() => claimQuest(q.id)}><Text style={styles.claimText}>✅ CLAIM</Text></TouchableOpacity>}
        </View>
      ))}
    </ScrollView>
  );

  if (loading) return <SafeAreaProvider><SafeAreaView style={styles.container}><View style={styles.loadingContainer}><Text style={styles.loadingText}>Loading game...</Text></View></SafeAreaView></SafeAreaProvider>;

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#0f0c29" />
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={['#0f0c29', '#302b63', '#24243e']} style={styles.gradient}>
          {renderTopBar()}
          {inBattle ? renderBattle() : (
            <>
              {activeTab === 'lobby' && renderLobby()}
              {activeTab === 'stats' && renderStats()}
              {activeTab === 'items' && renderItems()}
              {activeTab === 'quests' && renderQuests()}
              <View style={styles.bottomNav}>
                {[{ key: 'lobby', icon: '🎮', label: 'LOBBY' }, { key: 'stats', icon: '📊', label: 'STATS' }, { key: 'items', icon: '🎒', label: 'ITEMS' }, { key: 'quests', icon: '📜', label: 'QUESTS' }].map(t => (
                  <TouchableOpacity key={t.key} style={[styles.navTab, activeTab === t.key && styles.activeTab]} onPress={() => setActiveTab(t.key as GameTab)}>
                    <Text style={styles.navIcon}>{t.icon}</Text><Text style={[styles.navLabel, activeTab === t.key && styles.activeLabel]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </LinearGradient>
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0c29' },
  gradient: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', fontSize: 18 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  levelCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFD700', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  levelNumber: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  xpBarContainer: { flex: 1, marginRight: 10 },
  xpBarOuter: { height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden' },
  xpBarInner: { height: '100%', backgroundColor: '#4CAF50', borderRadius: 3 },
  xpText: { color: '#aaa', fontSize: 9, marginTop: 2 },
  topBarRight: { flexDirection: 'row', alignItems: 'center' },
  staminaContainer: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  staminaIcon: { fontSize: 14 },
  staminaText: { color: '#fff', fontSize: 12, fontWeight: 'bold', marginLeft: 2 },
  staminaTimer: { color: '#aaa', fontSize: 9, marginLeft: 4 },
  goldContainer: { flexDirection: 'row', alignItems: 'center' },
  goldIcon: { fontSize: 14 },
  goldText: { color: '#FFD700', fontSize: 12, fontWeight: 'bold', marginLeft: 2 },
  tabContent: { flex: 1, padding: 16 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  sectionSubtitle: { color: '#aaa', fontSize: 11, marginBottom: 12 },
  oppCard: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 14, marginBottom: 10 },
  bossCard: { borderWidth: 2, borderColor: '#FFD700' },
  oppLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  oppAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  oppAvatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  oppInfo: { flex: 1 },
  oppName: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  oppClass: { color: '#aaa', fontSize: 11, marginTop: 2 },
  oppPower: { color: '#4CAF50', fontSize: 11, marginTop: 2 },
  oppRight: { alignItems: 'flex-end' },
  rewardValue: { color: '#fff', fontSize: 11 },
  fightBtn: { backgroundColor: '#E53935', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6, marginTop: 6 },
  fightText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  disabledBtn: { backgroundColor: '#666', opacity: 0.6 },
  skillBanner: { backgroundColor: 'rgba(76,175,80,0.3)', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#4CAF50' },
  skillLabel: { color: '#4CAF50', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statCard: { width: '48%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 14, marginBottom: 10, alignItems: 'center' },
  upgradableStat: { borderWidth: 2, borderColor: '#4CAF50' },
  statIcon: { fontSize: 22, marginBottom: 6 },
  statValue: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  record: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 14, marginTop: 12 },
  recordItem: { alignItems: 'center' },
  recordVal: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  recordLbl: { color: '#aaa', fontSize: 10, marginTop: 4 },
  itemCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 14, marginBottom: 8, borderLeftWidth: 4 },
  itemName: { fontSize: 13, fontWeight: 'bold' },
  equippedTag: { color: '#4CAF50', fontSize: 11, fontWeight: 'bold' },
  equipBtn: { color: '#2196F3', fontSize: 11, fontWeight: 'bold' },
  questCard: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 14, marginBottom: 10 },
  questDone: { borderWidth: 2, borderColor: '#4CAF50' },
  questName: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  dailyTag: { color: '#FF9800', fontSize: 10 },
  questDesc: { color: '#aaa', fontSize: 11, marginTop: 6 },
  questProgOuter: { height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, marginTop: 10, overflow: 'hidden' },
  questProgInner: { height: '100%', backgroundColor: '#4CAF50', borderRadius: 3 },
  questProgText: { color: '#aaa', fontSize: 9, marginTop: 4 },
  questReward: { color: '#FFD700', fontSize: 11, marginTop: 6 },
  claimBtn: { backgroundColor: '#4CAF50', borderRadius: 6, padding: 10, marginTop: 10, alignItems: 'center' },
  claimText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  bottomNav: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.5)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  navTab: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  activeTab: { borderTopWidth: 2, borderTopColor: '#FFD700' },
  navIcon: { fontSize: 18 },
  navLabel: { color: '#aaa', fontSize: 9, marginTop: 2 },
  activeLabel: { color: '#FFD700' },
  battleContainer: { flex: 1 },
  turnBanner: { backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 6, alignItems: 'center' },
  turnText: { color: '#FFD700', fontSize: 14, fontWeight: 'bold' },
  hpSection: { paddingHorizontal: 16, paddingVertical: 6 },
  hpName: { color: '#fff', fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
  hpBarOuter: { height: 10, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 5, overflow: 'hidden' },
  hpBarInner: { height: '100%', borderRadius: 5 },
  hpText: { color: '#aaa', fontSize: 9, marginTop: 2, textAlign: 'right' },
  arena: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, minHeight: 180 },
  charLeft: { flex: 1, alignItems: 'flex-start' },
  charRight: { flex: 1, alignItems: 'flex-end' },
  resultOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  resultCard: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 24, alignItems: 'center', width: '80%' },
  victoryCard: { borderWidth: 3, borderColor: '#FFD700' },
  defeatCard: { borderWidth: 3, borderColor: '#F44336' },
  resultTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  rewards: { alignItems: 'center', marginBottom: 16 },
  rewardText: { color: '#4CAF50', fontSize: 16, fontWeight: 'bold', marginVertical: 2 },
  levelUpText: { color: '#FFD700', fontSize: 16, fontWeight: 'bold', marginTop: 8 },
  continueBtn: { backgroundColor: '#4CAF50', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 20 },
  continueBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  actions: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10, paddingHorizontal: 8 },
  actionBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, marginHorizontal: 4, borderRadius: 10 },
  attackBtn: { backgroundColor: '#E53935' },
  defendBtn: { backgroundColor: '#2196F3' },
  specialBtn: { backgroundColor: '#9C27B0' },
  actionIcon: { fontSize: 22 },
  actionLabel: { color: '#fff', fontSize: 10, fontWeight: 'bold', marginTop: 2 },
  logContainer: { maxHeight: 60, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8 },
  logEntry: { color: '#aaa', fontSize: 10, marginVertical: 2 },
  defendAura: { position: 'absolute', width: 110, height: 140, borderRadius: 55, borderWidth: 2, borderColor: '#64B5F6', backgroundColor: 'rgba(100,181,246,0.2)' },
  criticalAura: { position: 'absolute', width: 120, height: 150, borderRadius: 60, backgroundColor: 'rgba(255,215,0,0.3)', borderWidth: 2, borderColor: '#FFD700' },
  hitOverlay: { position: 'absolute', width: 100, height: 130, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.4)' },
});

export default App;
