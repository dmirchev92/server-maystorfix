/**
 * BattleArena - Battle screen with Mortal Kombat-style animations
 * Handles combat flow, animations, and visual effects
 */

import { Logger } from '../utils/Logger';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Vibration, Platform, ImageBackground } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

const ARENA_BACKGROUND = require('../../assets/game/background.png');
import GameCharacter from './GameCharacter';
import gameAPI, { BattleData, BattleLogEntry, BattleResult } from '../../services/GameService';

interface BattleArenaProps {
  battleData: BattleData;
  playerClass: string;
  playerLevel: number;
  onBattleEnd: (result: BattleResult) => void;
  onExit: () => void;
  battleResult: BattleResult | null;
}

const BattleArena: React.FC<BattleArenaProps> = ({
  battleData: initialBattleData,
  playerClass,
  playerLevel,
  onBattleEnd,
  onExit,
  battleResult,
}) => {
  const [battleData, setBattleData] = useState<BattleData>(initialBattleData);
  const [battleLog, setBattleLog] = useState<BattleLogEntry[]>([]);
  const [turnIndicator, setTurnIndicator] = useState<'player' | 'enemy'>('player');
  const [playerAttacking, setPlayerAttacking] = useState(false);
  const [opponentAttacking, setOpponentAttacking] = useState(false);
  const [playerHit, setPlayerHit] = useState(false);
  const [opponentHit, setOpponentHit] = useState(false);
  const [playerCritical, setPlayerCritical] = useState(false);
  const [opponentCritical, setOpponentCritical] = useState(false);
  const [playerDefending, setPlayerDefending] = useState(false);
  const [playerCharging, setPlayerCharging] = useState(false);
  const [damageNumbers, setDamageNumbers] = useState<Array<{ id: number; damage: number; critical: boolean; isPlayer: boolean }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Dynamic positioning from DB settings
  const [charPosition, setCharPosition] = useState({ marginBottom: -30, paddingHorizontal: 40 });

  const screenShake = useRef(new Animated.Value(0)).current;
  const damageIdCounter = useRef(0);
  
  // Fetch game settings for dynamic positioning
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await gameAPI.getSettings();
        if (response.success && response.data?.character_position) {
          setCharPosition(response.data.character_position);
        }
      } catch (e) {
        Logger.debug('Using default character position');
      }
    };
    loadSettings();
  }, []);

  const triggerScreenShake = (intensity: number = 5) => {
    Animated.sequence([
      Animated.timing(screenShake, { toValue: intensity, duration: 40, useNativeDriver: true }),
      Animated.timing(screenShake, { toValue: -intensity, duration: 40, useNativeDriver: true }),
      Animated.timing(screenShake, { toValue: intensity / 2, duration: 40, useNativeDriver: true }),
      Animated.timing(screenShake, { toValue: -intensity / 2, duration: 40, useNativeDriver: true }),
      Animated.timing(screenShake, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
    if (Platform.OS !== 'web') Vibration.vibrate(50);
  };

  const addDamageNumber = (damage: number, critical: boolean, isPlayer: boolean) => {
    const id = damageIdCounter.current++;
    setDamageNumbers(prev => [...prev, { id, damage, critical, isPlayer }]);
    setTimeout(() => setDamageNumbers(prev => prev.filter(d => d.id !== id)), 1000);
  };

  const performAction = async (action: 'attack' | 'defend' | 'charge' | 'release') => {
    if (isProcessing || battleData.battleEnded) return;
    setIsProcessing(true);
    setTurnIndicator('enemy');

    if (action === 'defend') {
      setPlayerDefending(true);
      setBattleLog(prev => [...prev, { actor: 'player', action: 'defend', damage: 0, dodged: false, critical: false, message: 'You take a defensive stance!' }]);
      // Call API with defend action so backend handles enemy attack with reduced damage
      setTimeout(async () => {
        const response = await gameAPI.performAction('defend', battleData);
        if (response.success && response.data) {
          const newData = response.data;
          const log = newData.battleLog || [];
          const enemyAction = log.find(l => l.actor === 'opponent');
          
          if (enemyAction) {
            setOpponentAttacking(true);
            setTimeout(() => {
              setOpponentAttacking(false);
              setBattleLog(prev => [...prev, enemyAction]);
              
              if (!enemyAction.dodged && enemyAction.damage > 0) {
                setPlayerHit(true);
                if (enemyAction.critical) {
                  setPlayerCritical(true);
                  triggerScreenShake(8);
                } else {
                  triggerScreenShake(3);
                }
                addDamageNumber(enemyAction.damage, enemyAction.critical, true);
                setTimeout(() => { setPlayerHit(false); setPlayerCritical(false); }, 200);
              } else if (enemyAction.dodged) {
                addDamageNumber(0, false, true);
              }
              
              setPlayerDefending(false);
              setBattleData(newData);
              if (newData.battleEnded) {
                endBattle(newData);
              } else {
                setTurnIndicator('player');
                setIsProcessing(false);
              }
            }, 400);
          }
        }
      }, 600);
      return;
    }

    if (action === 'charge') {
      // Charging up - show message and call API
      setBattleLog(prev => [...prev, { actor: 'player', action: 'charge', damage: 0, dodged: false, critical: false, message: '⚡ Charging up for a devastating blow!' }]);
      setTimeout(async () => {
        const response = await gameAPI.performAction('charge', battleData);
        if (response.success && response.data) {
          const newData = response.data;
          const log = newData.battleLog || [];
          const enemyAction = log.find(l => l.actor === 'opponent');
          
          if (enemyAction) {
            setOpponentAttacking(true);
            setTimeout(() => {
              setOpponentAttacking(false);
              setBattleLog(prev => [...prev, enemyAction]);
              
              if (!enemyAction.dodged && enemyAction.damage > 0) {
                setPlayerHit(true);
                triggerScreenShake(5);
                addDamageNumber(enemyAction.damage, enemyAction.critical, true);
                setTimeout(() => { setPlayerHit(false); }, 200);
              }
              
              setPlayerCharging(true);
              setBattleData(newData);
              if (newData.battleEnded) {
                endBattle(newData);
              } else {
                setTurnIndicator('player');
                setIsProcessing(false);
              }
            }, 400);
          }
        }
      }, 400);
      return;
    }

    // For attack and release actions
    setPlayerAttacking(true);
    setTimeout(async () => {
      setPlayerAttacking(false);
      
      // Reset charging state if releasing
      if (action === 'release') {
        setPlayerCharging(false);
      }
      
      const response = await gameAPI.performAction(action, battleData);
      if (response.success && response.data) {
        const newData = response.data;
        const log = newData.battleLog || [];
        const playerAction = log.find(l => l.actor === 'player');
        
        if (playerAction) {
          setBattleLog(prev => [...prev, playerAction]);
          if (!playerAction.dodged && playerAction.damage > 0) {
            setOpponentHit(true);
            if (playerAction.critical) {
              setOpponentCritical(true);
              triggerScreenShake(10);
            } else {
              triggerScreenShake(5);
            }
            addDamageNumber(playerAction.damage, playerAction.critical, false);
            setTimeout(() => { setOpponentHit(false); setOpponentCritical(false); }, 200);
          } else if (playerAction.dodged) {
            addDamageNumber(0, false, false);
          }
        }

        // Process enemy action from the same response (backend handles both turns)
        const enemyAction = log.find(l => l.actor === 'opponent');
        
        if (enemyAction && !newData.battleEnded) {
          // Delay enemy attack animation
          setTimeout(() => {
            setOpponentAttacking(true);
            setTimeout(() => {
              setOpponentAttacking(false);
              
              setBattleLog(prev => [...prev, enemyAction]);
              
              if (!enemyAction.dodged && enemyAction.damage > 0) {
                setPlayerHit(true);
                if (enemyAction.critical) {
                  setPlayerCritical(true);
                  triggerScreenShake(10);
                } else {
                  triggerScreenShake(5);
                }
                addDamageNumber(enemyAction.damage, enemyAction.critical, true);
                setTimeout(() => { setPlayerHit(false); setPlayerCritical(false); }, 200);
              } else if (enemyAction.dodged) {
                addDamageNumber(0, false, true);
              }
              
              setBattleData(newData);
              if (newData.battleEnded) {
                endBattle(newData);
              } else {
                setTurnIndicator('player');
                setIsProcessing(false);
              }
            }, 400);
          }, 600);
        } else {
          setBattleData(newData);
          if (newData.battleEnded) {
            endBattle(newData);
          } else {
            setTurnIndicator('player');
            setIsProcessing(false);
          }
        }
      }
    }, 400);
  };

  const endBattle = async (finalData: BattleData) => {
    const response = await gameAPI.endBattle(finalData);
    if (response.success && response.data) {
      onBattleEnd(response.data);
      if (response.data.victory && Platform.OS !== 'web') {
        Vibration.vibrate([0, 100, 50, 100, 50, 200]);
      }
    }
    setIsProcessing(false);
  };

  const getHealthColor = (percent: number) => {
    if (percent > 60) return '#4CAF50';
    if (percent > 30) return '#FFC107';
    return '#F44336';
  };

  const playerHpPercent = (battleData.player.currentHP / battleData.player.maxHP) * 100;
  const opponentHpPercent = (battleData.opponent.currentHP / battleData.opponent.maxHP) * 100;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateX: screenShake }] }]}>
      {/* Turn indicator */}
      <View style={styles.turnBanner}>
        <Text style={styles.turnText}>
          {turnIndicator === 'player' ? '⚔️ YOUR TURN' : '👹 ENEMY TURN'}
        </Text>
      </View>

      {/* Enemy HP bar */}
      <View style={styles.hpSection}>
        <View style={styles.hpHeader}>
          <Text style={styles.hpName}>{battleData.opponent.name}</Text>
          <View style={styles.levelBadge}><Text style={styles.levelText}>Lv.{battleData.opponent.level}</Text></View>
        </View>
        <View style={styles.hpBarOuter}>
          <View style={[styles.hpBarInner, { width: `${Math.max(0, opponentHpPercent)}%`, backgroundColor: getHealthColor(opponentHpPercent) }]} />
        </View>
        <Text style={styles.hpText}>{Math.max(0, battleData.opponent.currentHP)} / {battleData.opponent.maxHP}</Text>
      </View>

      {/* Battle arena */}
      <ImageBackground source={ARENA_BACKGROUND} style={[styles.arena, { paddingHorizontal: charPosition.paddingHorizontal }]} resizeMode="cover">
        <View style={[styles.characterLeft, { marginBottom: charPosition.marginBottom }]}>
          <GameCharacter
            characterClass={playerClass}
            isPlayer={true}
            isAttacking={playerAttacking}
            isHit={playerHit}
            isCritical={playerCritical}
            isDefending={playerDefending}
            isDead={battleData.player.currentHP <= 0}
          />
        </View>
        <View style={[styles.characterRight, { marginBottom: charPosition.marginBottom }]}>
          <GameCharacter
            characterClass={battleData.opponent.characterClass}
            isPlayer={false}
            isAttacking={opponentAttacking}
            isHit={opponentHit}
            isCritical={opponentCritical}
            isDefending={false}
            isDead={battleData.opponent.currentHP <= 0}
          />
        </View>
        {/* Damage numbers */}
        {damageNumbers.map(dn => (
          <DamageNumber key={dn.id} {...dn} />
        ))}
      </ImageBackground>

      {/* Player HP bar */}
      <View style={styles.hpSection}>
        <View style={styles.hpHeader}>
          <Text style={styles.hpName}>You</Text>
          <View style={styles.levelBadge}><Text style={styles.levelText}>Lv.{playerLevel}</Text></View>
        </View>
        <View style={styles.hpBarOuter}>
          <View style={[styles.hpBarInner, { width: `${Math.max(0, playerHpPercent)}%`, backgroundColor: getHealthColor(playerHpPercent) }]} />
        </View>
        <Text style={styles.hpText}>{Math.max(0, battleData.player.currentHP)} / {battleData.player.maxHP}</Text>
      </View>

      {/* Battle result overlay */}
      {battleResult && (
        <View style={styles.resultOverlay}>
          <View style={[styles.resultCard, battleResult.victory ? styles.victoryCard : styles.defeatCard]}>
            <Text style={styles.resultTitle}>{battleResult.victory ? '🏆 VICTORY!' : '💀 DEFEAT'}</Text>
            {battleResult.victory && (
              <View style={styles.rewards}>
                <Text style={styles.rewardText}>+{battleResult.rewards.xp} XP</Text>
                <Text style={styles.rewardText}>+{battleResult.rewards.gold} Gold</Text>
                {battleResult.leveledUp && (
                  <View style={styles.levelUpBanner}>
                    <Text style={styles.levelUpText}>🎉 LEVEL UP! Lv.{battleResult.newLevel}</Text>
                    <Text style={styles.skillPointsText}>+{battleResult.skillPointsGained} Skill Points</Text>
                  </View>
                )}
              </View>
            )}
            <TouchableOpacity style={styles.continueBtn} onPress={onExit}>
              <Text style={styles.continueBtnText}>CONTINUE</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Action buttons */}
      {!battleResult && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.attackBtn, (turnIndicator !== 'player' || isProcessing) && styles.disabledBtn]}
            onPress={() => performAction('attack')}
            disabled={turnIndicator !== 'player' || isProcessing}
          >
            <Text style={styles.actionIcon}>⚔️</Text>
            <Text style={styles.actionLabel}>ATTACK</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.defendBtn, (turnIndicator !== 'player' || isProcessing) && styles.disabledBtn]}
            onPress={() => performAction('defend')}
            disabled={turnIndicator !== 'player' || isProcessing}
          >
            <Text style={styles.actionIcon}>🛡️</Text>
            <Text style={styles.actionLabel}>DEFEND</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, playerCharging ? styles.releaseBtn : styles.chargeBtn, (turnIndicator !== 'player' || isProcessing) && styles.disabledBtn]}
            onPress={() => performAction(playerCharging ? 'release' : 'charge')}
            disabled={turnIndicator !== 'player' || isProcessing}
          >
            <Text style={styles.actionIcon}>{playerCharging ? '💥' : '⚡'}</Text>
            <Text style={styles.actionLabel}>{playerCharging ? 'RELEASE!' : 'CHARGE'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Battle log */}
      <ScrollView style={styles.logContainer} contentContainerStyle={styles.logContent}>
        {battleLog.slice(-4).map((log, i) => (
          <Text key={i} style={[styles.logEntry, log.critical && styles.criticalLog]}>{log.message}</Text>
        ))}
      </ScrollView>
    </Animated.View>
  );
};

const DamageNumber: React.FC<{ damage: number; critical: boolean; isPlayer: boolean }> = ({ damage, critical, isPlayer }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(critical ? 1.5 : 1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -50, duration: 800, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 800, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(scale, { toValue: critical ? 1.8 : 1.2, duration: 150, useNativeDriver: true }),
        Animated.timing(scale, { toValue: critical ? 1.3 : 1, duration: 650, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.damageNum, isPlayer ? styles.damageLeft : styles.damageRight, { transform: [{ translateY }, { scale }], opacity }]}>
      {critical && <Text style={styles.critLabel}>CRITICAL!</Text>}
      <Text style={[styles.damageText, critical && styles.critDamage, !isPlayer && styles.enemyDamage]}>
        {damage > 0 ? `-${damage}` : 'MISS'}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  turnBanner: { backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 8, alignItems: 'center' },
  turnText: { color: '#FFD700', fontSize: 16, fontWeight: 'bold' },
  hpSection: { paddingHorizontal: 16, paddingVertical: 8 },
  hpHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  hpName: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  levelBadge: { backgroundColor: '#FFD700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  levelText: { color: '#000', fontSize: 10, fontWeight: 'bold' },
  hpBarOuter: { height: 12, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 6, overflow: 'hidden' },
  hpBarInner: { height: '100%', borderRadius: 6 },
  hpText: { color: '#aaa', fontSize: 10, marginTop: 2, textAlign: 'right' },
  arena: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 40, paddingBottom: 0, minHeight: 250 },
  characterLeft: { alignItems: 'center', marginBottom: -30 },
  characterRight: { alignItems: 'center', marginBottom: -30 },
  resultOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  resultCard: { backgroundColor: '#1a1a2e', borderRadius: 20, padding: 30, alignItems: 'center', width: '85%' },
  victoryCard: { borderWidth: 3, borderColor: '#FFD700' },
  defeatCard: { borderWidth: 3, borderColor: '#F44336' },
  resultTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  rewards: { alignItems: 'center', marginBottom: 20 },
  rewardText: { color: '#4CAF50', fontSize: 18, fontWeight: 'bold', marginVertical: 4 },
  levelUpBanner: { backgroundColor: 'rgba(255,215,0,0.2)', borderRadius: 12, padding: 12, marginTop: 12, alignItems: 'center' },
  levelUpText: { color: '#FFD700', fontSize: 18, fontWeight: 'bold' },
  skillPointsText: { color: '#4CAF50', fontSize: 14, marginTop: 4 },
  continueBtn: { backgroundColor: '#4CAF50', paddingHorizontal: 40, paddingVertical: 14, borderRadius: 25 },
  continueBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  actions: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, paddingHorizontal: 8 },
  actionBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, marginHorizontal: 4, borderRadius: 12 },
  attackBtn: { backgroundColor: '#E53935' },
  defendBtn: { backgroundColor: '#2196F3' },
  chargeBtn: { backgroundColor: '#FF9800' },
  releaseBtn: { backgroundColor: '#9C27B0' },
  disabledBtn: { backgroundColor: '#666', opacity: 0.6 },
  actionIcon: { fontSize: 24 },
  actionLabel: { color: '#fff', fontSize: 12, fontWeight: 'bold', marginTop: 4 },
  logContainer: { maxHeight: 80, backgroundColor: 'rgba(0,0,0,0.5)' },
  logContent: { padding: 8 },
  logEntry: { color: '#aaa', fontSize: 11, marginVertical: 2 },
  criticalLog: { color: '#FFD700', fontWeight: 'bold' },
  damageNum: { position: 'absolute', top: '40%' },
  damageLeft: { left: '25%' },
  damageRight: { right: '25%' },
  damageText: { color: '#fff', fontSize: 24, fontWeight: 'bold', textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  critDamage: { color: '#FFD700', fontSize: 32 },
  enemyDamage: { color: '#F44336' },
  critLabel: { color: '#FFD700', fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
});

export default BattleArena;
