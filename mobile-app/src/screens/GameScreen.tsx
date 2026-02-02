/**
 * GameScreen - Main game hub with tabs for Lobby, Stats, Items, Quests
 * Mobile-first fighting game with Mortal Kombat-style animations
 */

import { Logger } from '../utils/Logger';
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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import gameAPI, {
  Player,
  Opponent,
  Quest,
  Inventory,
  BattleData,
  BattleLogEntry,
  BattleResult,
} from '../services/GameService';
import GameCharacter from '../components/game/GameCharacter';
import BattleArena from '../components/game/BattleArena';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type GameTab = 'lobby' | 'stats' | 'items' | 'quests';

const CLASS_COLORS: Record<string, { primary: string; secondary: string }> = {
  warrior: { primary: '#E53935', secondary: '#FFCDD2' },
  mage: { primary: '#7B1FA2', secondary: '#E1BEE7' },
  rogue: { primary: '#455A64', secondary: '#CFD8DC' },
  paladin: { primary: '#FFC107', secondary: '#FFF8E1' },
  berserker: { primary: '#FF5722', secondary: '#FFCCBC' },
  archer: { primary: '#4CAF50', secondary: '#C8E6C9' },
};

const RARITY_COLORS: Record<string, string> = {
  common: '#9E9E9E',
  rare: '#2196F3',
  epic: '#9C27B0',
  legendary: '#FF9800',
};

const CHARACTER_CLASSES_INFO = [
  { id: 'warrior', name: 'Воин', icon: '⚔️', desc: 'Силен и издръжлив боец с меч и щит', stats: 'STR+, VIT+' },
  { id: 'mage', name: 'Магьосник', icon: '🔮', desc: 'Владее магически сили и заклинания', stats: 'INT+, CRIT+' },
  { id: 'rogue', name: 'Разбойник', icon: '🗡️', desc: 'Бърз и смъртоносен с двойни кинжали', stats: 'AGI+, CRIT+' },
  { id: 'paladin', name: 'Паладин', icon: '🛡️', desc: 'Свещен воин с тежка броня', stats: 'VIT+, STR+' },
  { id: 'berserker', name: 'Берсерк', icon: '🪓', desc: 'Яростен боец с огромна секира', stats: 'STR++, CRIT DMG+' },
  { id: 'archer', name: 'Стрелец', icon: '🏹', desc: 'Прецизен стрелец от дистанция', stats: 'AGI+, CRIT%+' },
];

const GameScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState<GameTab>('lobby');
  const [player, setPlayer] = useState<Player | null>(null);
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCharacterSelect, setShowCharacterSelect] = useState(false);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [creatingCharacter, setCreatingCharacter] = useState(false);
  
  const [inBattle, setInBattle] = useState(false);
  const [battleData, setBattleData] = useState<BattleData | null>(null);
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [staminaTimer, setStaminaTimer] = useState(0);

  useEffect(() => {
    checkPlayer();
  }, []);

  const checkPlayer = async () => {
    setLoading(true);
    Logger.debug('🎮 Checking player...');
    const response = await gameAPI.getPlayer();
    Logger.debug('🎮 Player check response:', JSON.stringify(response));
    if (response.success && response.data) {
      setPlayer(response.data);
      await loadGameData();
    } else {
      // New player - show character selection
      setShowCharacterSelect(true);
    }
    setLoading(false);
  };

  const createCharacter = async () => {
    if (!selectedClass) {
      Alert.alert('Грешка', 'Моля изберете клас');
      return;
    }
    setCreatingCharacter(true);
    
    try {
      // First get/create player
      const playerResponse = await gameAPI.getPlayer();
      
      if (playerResponse.success && playerResponse.data) {
        // Change class to selected
        const classResponse = await gameAPI.changeClass(selectedClass);
        
        if (classResponse.success && classResponse.data) {
          setPlayer(classResponse.data);
          setShowCharacterSelect(false);
          await loadGameData();
        } else {
          // If class change failed, still use the player data
          setPlayer(playerResponse.data);
          setShowCharacterSelect(false);
          await loadGameData();
        }
      } else {
        Alert.alert('Грешка', playerResponse.error?.message || 'Неуспешно създаване на играч');
      }
    } catch (error: any) {
      Alert.alert('Грешка', error.message || 'Възникна грешка');
    }
    
    setCreatingCharacter(false);
  };

  const loadGameData = async () => {
    await Promise.all([loadOpponents(), loadQuests(), loadInventory()]);
  };

  useEffect(() => {
    if (player && player.stamina < player.maxStamina) {
      setStaminaTimer(player.secondsUntilNextStamina);
      const interval = setInterval(() => {
        setStaminaTimer(prev => {
          if (prev <= 1) {
            loadPlayer();
            return 60;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [player?.stamina]);

  const loadData = async () => {
    setLoading(true);
    // Must load player first, then others (opponents needs player level)
    await loadPlayer();
    await Promise.all([loadOpponents(), loadQuests(), loadInventory()]);
    setLoading(false);
  };

  const loadPlayer = async () => {
    Logger.debug('🎮 Loading player...');
    const response = await gameAPI.getPlayer();
    Logger.debug('🎮 Player response:', JSON.stringify(response));
    if (response.success && response.data) setPlayer(response.data);
  };

  const loadOpponents = async () => {
    Logger.debug('🎮 Loading opponents...');
    const response = await gameAPI.getOpponents();
    Logger.debug('🎮 Opponents response:', JSON.stringify(response));
    if (response.success && response.data) setOpponents(response.data);
  };

  const loadQuests = async () => {
    const response = await gameAPI.getQuests();
    if (response.success && response.data) setQuests(response.data);
  };

  const loadInventory = async () => {
    const response = await gameAPI.getInventory();
    if (response.success && response.data) setInventory(response.data);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const startBattle = async (opponent: Opponent) => {
    if (!player || player.stamina < 15) return;
    const response = await gameAPI.startBattle(opponent.id);
    if (response.success && response.data) {
      setBattleData(response.data);
      setInBattle(true);
      setBattleResult(null);
      setPlayer(prev => prev ? { ...prev, stamina: prev.stamina - 15 } : null);
    }
  };

  const handleBattleEnd = (result: BattleResult) => {
    setBattleResult(result);
    setPlayer(result.player);
  };

  const exitBattle = () => {
    setInBattle(false);
    setBattleData(null);
    setBattleResult(null);
    loadOpponents();
    loadQuests();
  };

  const upgradeStat = async (stat: string) => {
    if (!player || player.skillPoints < 1) return;
    const response = await gameAPI.upgradeStats(stat, 1);
    if (response.success && response.data) setPlayer(response.data);
  };

  const equipItem = async (itemId: number) => {
    const response = await gameAPI.equipItem(itemId);
    if (response.success && response.data) setInventory(response.data);
  };

  const claimQuest = async (questId: number) => {
    const response = await gameAPI.claimQuest(questId);
    if (response.success) {
      loadPlayer();
      loadQuests();
    }
  };

  const renderTopBar = () => (
    <View style={styles.topBar}>
      <View style={styles.topBarLeft}>
        <View style={styles.levelCircle}>
          <Text style={styles.levelNumber}>{player?.level || 1}</Text>
        </View>
        <View style={styles.xpBarContainer}>
          <View style={styles.xpBarOuter}>
            <View style={[styles.xpBarInner, { width: `${player?.xpProgress || 0}%` }]} />
          </View>
          <Text style={styles.xpText}>{player?.xp || 0} / {player?.xpForNextLevel || 150} XP</Text>
        </View>
      </View>
      <View style={styles.topBarRight}>
        <View style={styles.staminaContainer}>
          <Text style={styles.staminaIcon}>⚡</Text>
          <Text style={styles.staminaText}>{player?.stamina || 0}/{player?.maxStamina || 100}</Text>
          {player && player.stamina < player.maxStamina && (
            <Text style={styles.staminaTimer}>+1 in {staminaTimer}s</Text>
          )}
        </View>
        <View style={styles.goldContainer}>
          <Text style={styles.goldIcon}>💰</Text>
          <Text style={styles.goldText}>{player?.gold || 0}</Text>
        </View>
      </View>
    </View>
  );

  const renderLobby = () => (
    <ScrollView style={styles.tabContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Text style={styles.sectionTitle}>🎮 Challenge Opponents</Text>
      <Text style={styles.sectionSubtitle}>15 stamina per battle</Text>
      {opponents.map(opponent => (
        <TouchableOpacity
          key={opponent.id}
          style={[styles.opponentCard, opponent.isBoss && styles.bossCard]}
          onPress={() => startBattle(opponent)}
          disabled={!player || player.stamina < 15}
        >
          <View style={styles.opponentLeft}>
            <View style={[styles.opponentAvatar, { backgroundColor: CLASS_COLORS[opponent.characterClass]?.primary || '#666' }]}>
              <Text style={styles.opponentAvatarText}>{opponent.characterClass.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.opponentInfo}>
              <View style={styles.opponentNameRow}>
                <Text style={styles.opponentName}>{opponent.name}</Text>
                {opponent.isBoss && <Text style={styles.bossTag}>👑 BOSS</Text>}
              </View>
              <Text style={styles.opponentClass}>{opponent.characterClass} • Lv.{opponent.level}</Text>
              <Text style={styles.opponentPower}>⚡ Power: {opponent.power}</Text>
            </View>
          </View>
          <View style={styles.opponentRight}>
            <Text style={styles.rewardLabel}>Rewards</Text>
            <Text style={styles.rewardValue}>+{opponent.rewards.xp} XP</Text>
            <Text style={styles.rewardValue}>+{opponent.rewards.gold} 💰</Text>
            <View style={[styles.challengeButton, (!player || player.stamina < 15) && styles.disabledButton]}>
              <Text style={styles.challengeText}>FIGHT</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderStats = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>📊 Character Stats</Text>
      <View style={styles.classSection}>
        <Text style={styles.subsectionTitle}>Class: {player?.characterClass?.toUpperCase()}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {Object.keys(CLASS_COLORS).map(cls => (
            <TouchableOpacity
              key={cls}
              style={[styles.classOption, { backgroundColor: CLASS_COLORS[cls].primary }, player?.characterClass === cls && styles.selectedClass]}
              onPress={async () => {
                const response = await gameAPI.changeClass(cls);
                if (response.success && response.data) setPlayer(response.data);
              }}
            >
              <Text style={styles.classOptionText}>{cls.charAt(0).toUpperCase()}</Text>
              <Text style={styles.classOptionName}>{cls}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      {player && player.skillPoints > 0 && (
        <View style={styles.skillPointsBanner}>
          <Text style={styles.skillPointsLabel}>🎯 {player.skillPoints} Skill Points Available!</Text>
        </View>
      )}
      <View style={styles.statsGrid}>
        {[
          { key: 'strength', label: 'Strength', icon: '💪', value: player?.stats.strength || 10 },
          { key: 'agility', label: 'Agility', icon: '🏃', value: player?.stats.agility || 10 },
          { key: 'vitality', label: 'Vitality', icon: '❤️', value: player?.stats.vitality || 10 },
          { key: 'crit_chance', label: 'Crit %', icon: '🎯', value: player?.stats.critChance || 10 },
          { key: 'crit_damage', label: 'Crit DMG', icon: '💥', value: player?.stats.critDamage || 150 },
        ].map(stat => (
          <TouchableOpacity
            key={stat.key}
            style={[styles.statCard, player?.skillPoints && player.skillPoints > 0 ? styles.upgradableStat : null]}
            onPress={() => upgradeStat(stat.key)}
            disabled={!player?.skillPoints || player.skillPoints < 1}
          >
            <Text style={styles.statIcon}>{stat.icon}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
            <Text style={styles.statValue}>{stat.value}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.battleRecord}>
        <View style={styles.recordItem}>
          <Text style={styles.recordValue}>{player?.battleStats.battlesWon || 0}</Text>
          <Text style={styles.recordLabel}>Wins</Text>
        </View>
        <View style={styles.recordItem}>
          <Text style={styles.recordValue}>{player?.battleStats.battlesLost || 0}</Text>
          <Text style={styles.recordLabel}>Losses</Text>
        </View>
        <View style={styles.recordItem}>
          <Text style={styles.recordValue}>{player?.battleStats.bestWinStreak || 0}</Text>
          <Text style={styles.recordLabel}>Best Streak</Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderItems = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>🎒 Equipment</Text>
      <Text style={styles.subsectionTitle}>Equipped</Text>
      <View style={styles.equippedGrid}>
        {['weapon', 'armor', 'helmet', 'ring', 'boots'].map(slot => {
          const item = inventory?.equipped[slot];
          return (
            <View key={slot} style={[styles.equipSlot, item && { borderColor: RARITY_COLORS[item.rarity] }]}>
              {item ? (
                <>
                  <Text style={[styles.itemName, { color: RARITY_COLORS[item.rarity] }]}>{item.name}</Text>
                  <Text style={styles.itemStats}>+{item.stats.strength || item.stats.agility || item.stats.vitality}</Text>
                </>
              ) : (
                <Text style={styles.emptySlot}>{slot.toUpperCase()}</Text>
              )}
            </View>
          );
        })}
      </View>
      <Text style={styles.subsectionTitle}>Inventory</Text>
      {inventory?.inventory.map(item => (
        <TouchableOpacity key={item.id} style={[styles.inventoryItem, { borderLeftColor: RARITY_COLORS[item.rarity] }]} onPress={() => equipItem(item.id)}>
          <View style={styles.itemInfo}>
            <Text style={[styles.itemName, { color: RARITY_COLORS[item.rarity] }]}>{item.name}</Text>
            <Text style={styles.itemSlot}>{item.slot.toUpperCase()}</Text>
          </View>
          <Text style={item.equipped ? styles.equippedTag : styles.equipButton}>{item.equipped ? 'EQUIPPED' : 'EQUIP'}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderQuests = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>📜 Quests</Text>
      {quests.map(quest => (
        <View key={quest.id} style={[styles.questCard, quest.completed && styles.questCompleted]}>
          <View style={styles.questHeader}>
            <Text style={styles.questName}>{quest.name}</Text>
            {quest.isDaily && <Text style={styles.dailyTag}>DAILY</Text>}
          </View>
          <Text style={styles.questDescription}>{quest.description}</Text>
          <View style={styles.questProgressOuter}>
            <View style={[styles.questProgressInner, { width: `${quest.progressPercent}%` }]} />
          </View>
          <Text style={styles.questProgressText}>{quest.progress} / {quest.targetValue}</Text>
          <View style={styles.questRewards}>
            {quest.rewards.xp > 0 && <Text style={styles.questReward}>+{quest.rewards.xp} XP</Text>}
            {quest.rewards.gold > 0 && <Text style={styles.questReward}>+{quest.rewards.gold} 💰</Text>}
          </View>
          {quest.completed && !quest.claimed && (
            <TouchableOpacity style={styles.claimButton} onPress={() => claimQuest(quest.id)}>
              <Text style={styles.claimButtonText}>✅ CLAIM</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </ScrollView>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={['#0f0c29', '#302b63', '#24243e']} style={styles.gradient}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingEmoji}>⚔️</Text>
            <Text style={styles.loadingText}>Зареждане...</Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // Character Selection Screen for new players
  if (showCharacterSelect) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={['#0f0c29', '#302b63', '#24243e']} style={styles.gradient}>
          <ScrollView contentContainerStyle={styles.charSelectContainer}>
            <Text style={styles.charSelectTitle}>⚔️ ИЗБЕРИ ГЕРОЙ</Text>
            <Text style={styles.charSelectSubtitle}>Избери своя клас боец</Text>
            
            <View style={styles.classGrid}>
              {CHARACTER_CLASSES_INFO.map(cls => (
                <TouchableOpacity
                  key={cls.id}
                  style={[
                    styles.classCard,
                    selectedClass === cls.id && styles.classCardSelected,
                    { borderColor: CLASS_COLORS[cls.id]?.primary || '#666' }
                  ]}
                  onPress={() => setSelectedClass(cls.id)}
                >
                  <Text style={styles.classIcon}>{cls.icon}</Text>
                  <Text style={[styles.className, { color: CLASS_COLORS[cls.id]?.primary }]}>{cls.name}</Text>
                  <Text style={styles.classDesc}>{cls.desc}</Text>
                  <Text style={styles.classStats}>{cls.stats}</Text>
                  {selectedClass === cls.id && (
                    <View style={[styles.selectedBadge, { backgroundColor: CLASS_COLORS[cls.id]?.primary }]}>
                      <Text style={styles.selectedBadgeText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.createButton, !selectedClass && styles.createButtonDisabled]}
              onPress={createCharacter}
              disabled={!selectedClass || creatingCharacter}
            >
              <Text style={styles.createButtonText}>
                {creatingCharacter ? '⏳ Създаване...' : '🎮 ЗАПОЧНИ ИГРАТА'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#0f0c29', '#302b63', '#24243e']} style={styles.gradient}>
        {renderTopBar()}
        {inBattle && battleData ? (
          <BattleArena
            battleData={battleData}
            playerClass={player?.characterClass || 'warrior'}
            playerLevel={player?.level || 1}
            onBattleEnd={handleBattleEnd}
            onExit={exitBattle}
            battleResult={battleResult}
          />
        ) : (
          <>
            {activeTab === 'lobby' && renderLobby()}
            {activeTab === 'stats' && renderStats()}
            {activeTab === 'items' && renderItems()}
            {activeTab === 'quests' && renderQuests()}
            <View style={styles.bottomNav}>
              {[
                { key: 'lobby', icon: '🎮', label: 'LOBBY' },
                { key: 'stats', icon: '📊', label: 'STATS' },
                { key: 'items', icon: '🎒', label: 'ITEMS' },
                { key: 'quests', icon: '📜', label: 'QUESTS' },
              ].map(tab => (
                <TouchableOpacity key={tab.key} style={[styles.navTab, activeTab === tab.key && styles.activeTab]} onPress={() => setActiveTab(tab.key as GameTab)}>
                  <Text style={styles.navIcon}>{tab.icon}</Text>
                  <Text style={[styles.navLabel, activeTab === tab.key && styles.activeTabLabel]}>{tab.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0c29' },
  gradient: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingEmoji: { fontSize: 48, marginBottom: 16 },
  loadingText: { color: '#fff', fontSize: 18 },
  // Character Selection Styles
  charSelectContainer: { flexGrow: 1, padding: 20, alignItems: 'center', justifyContent: 'center' },
  charSelectTitle: { color: '#FFD700', fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  charSelectSubtitle: { color: '#aaa', fontSize: 16, textAlign: 'center', marginBottom: 24 },
  classGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 24 },
  classCard: { width: '45%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 16, margin: '2.5%', alignItems: 'center', borderWidth: 2, position: 'relative' },
  classCardSelected: { backgroundColor: 'rgba(255,255,255,0.2)', transform: [{ scale: 1.02 }] },
  classIcon: { fontSize: 40, marginBottom: 8 },
  className: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  classDesc: { color: '#aaa', fontSize: 11, textAlign: 'center', marginBottom: 8 },
  classStats: { color: '#4CAF50', fontSize: 12, fontWeight: 'bold' },
  selectedBadge: { position: 'absolute', top: -8, right: -8, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  selectedBadgeText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  createButton: { backgroundColor: '#4CAF50', paddingHorizontal: 40, paddingVertical: 16, borderRadius: 12, marginTop: 16 },
  createButtonDisabled: { backgroundColor: '#666' },
  createButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  levelCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFD700', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  levelNumber: { color: '#000', fontSize: 18, fontWeight: 'bold' },
  xpBarContainer: { flex: 1, marginRight: 10 },
  xpBarOuter: { height: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4, overflow: 'hidden' },
  xpBarInner: { height: '100%', backgroundColor: '#4CAF50', borderRadius: 4 },
  xpText: { color: '#aaa', fontSize: 10, marginTop: 2 },
  topBarRight: { flexDirection: 'row', alignItems: 'center' },
  staminaContainer: { flexDirection: 'row', alignItems: 'center', marginRight: 15 },
  staminaIcon: { fontSize: 16, marginRight: 4 },
  staminaText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  staminaTimer: { color: '#aaa', fontSize: 10, marginLeft: 4 },
  goldContainer: { flexDirection: 'row', alignItems: 'center' },
  goldIcon: { fontSize: 16, marginRight: 4 },
  goldText: { color: '#FFD700', fontSize: 14, fontWeight: 'bold' },
  tabContent: { flex: 1, padding: 16 },
  sectionTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  sectionSubtitle: { color: '#aaa', fontSize: 12, marginBottom: 16 },
  subsectionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginTop: 20, marginBottom: 12 },
  opponentCard: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 16, marginBottom: 12 },
  bossCard: { borderWidth: 2, borderColor: '#FFD700', backgroundColor: 'rgba(255,215,0,0.1)' },
  opponentLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  opponentAvatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  opponentAvatarText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  opponentInfo: { flex: 1 },
  opponentNameRow: { flexDirection: 'row', alignItems: 'center' },
  opponentName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  bossTag: { color: '#FFD700', fontSize: 12, marginLeft: 8 },
  opponentClass: { color: '#aaa', fontSize: 12, marginTop: 2 },
  opponentPower: { color: '#4CAF50', fontSize: 12, marginTop: 4 },
  opponentRight: { alignItems: 'flex-end' },
  rewardLabel: { color: '#aaa', fontSize: 10 },
  rewardValue: { color: '#fff', fontSize: 12 },
  challengeButton: { backgroundColor: '#E53935', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, marginTop: 8 },
  disabledButton: { backgroundColor: '#666' },
  challengeText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  classSection: { marginBottom: 16 },
  classOption: { width: 60, height: 70, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  selectedClass: { borderWidth: 3, borderColor: '#FFD700' },
  classOptionText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  classOptionName: { color: '#fff', fontSize: 10, marginTop: 4 },
  skillPointsBanner: { backgroundColor: 'rgba(76,175,80,0.3)', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#4CAF50' },
  skillPointsLabel: { color: '#4CAF50', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statCard: { width: '48%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 16, marginBottom: 12, alignItems: 'center' },
  upgradableStat: { borderWidth: 2, borderColor: '#4CAF50' },
  statIcon: { fontSize: 24, marginBottom: 8 },
  statLabel: { color: '#aaa', fontSize: 12 },
  statValue: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 4 },
  battleRecord: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 16, marginTop: 16 },
  recordItem: { alignItems: 'center' },
  recordValue: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  recordLabel: { color: '#aaa', fontSize: 12, marginTop: 4 },
  equippedGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  equipSlot: { width: '48%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 2, borderColor: 'transparent', minHeight: 70, justifyContent: 'center' },
  itemName: { fontSize: 12, fontWeight: 'bold' },
  itemStats: { color: '#aaa', fontSize: 10, marginTop: 4 },
  emptySlot: { color: '#666', fontSize: 12, textAlign: 'center' },
  inventoryItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 16, marginBottom: 10, borderLeftWidth: 4 },
  itemInfo: { flex: 1 },
  itemSlot: { color: '#aaa', fontSize: 10, marginTop: 4 },
  equippedTag: { color: '#4CAF50', fontSize: 12, fontWeight: 'bold' },
  equipButton: { color: '#2196F3', fontSize: 12, fontWeight: 'bold' },
  questCard: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 16, marginBottom: 12 },
  questCompleted: { borderWidth: 2, borderColor: '#4CAF50' },
  questHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  questName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  dailyTag: { color: '#FF9800', fontSize: 10, fontWeight: 'bold', backgroundColor: 'rgba(255,152,0,0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  questDescription: { color: '#aaa', fontSize: 12, marginTop: 8 },
  questProgressOuter: { height: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4, marginTop: 12, overflow: 'hidden' },
  questProgressInner: { height: '100%', backgroundColor: '#4CAF50', borderRadius: 4 },
  questProgressText: { color: '#aaa', fontSize: 10, marginTop: 4 },
  questRewards: { flexDirection: 'row', marginTop: 12 },
  questReward: { color: '#FFD700', fontSize: 12, marginRight: 12 },
  claimButton: { backgroundColor: '#4CAF50', borderRadius: 8, padding: 12, marginTop: 12, alignItems: 'center' },
  claimButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  bottomNav: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.5)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  navTab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  activeTab: { borderTopWidth: 2, borderTopColor: '#FFD700' },
  navIcon: { fontSize: 20 },
  navLabel: { color: '#aaa', fontSize: 10, marginTop: 4 },
  activeTabLabel: { color: '#FFD700' },
});

export default GameScreen;
