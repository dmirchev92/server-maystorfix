/**
 * GameCharacter - Animated character component with sprite-based rendering
 * Supports animated idle poses (breathing animation) and action states
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Image, ImageSourcePropType } from 'react-native';

// Sprite mappings for each skin (all skins have same abilities, just different looks)
const SKIN_SPRITES: Record<string, Record<string, ImageSourcePropType[]>> = {
  warrior: {
    idle: [
      require('../../assets/skins/warrior/idle/image_1.png'),
      require('../../assets/skins/warrior/idle/image_2.png'),
      require('../../assets/skins/warrior/idle/image_3.png'),
      require('../../assets/skins/warrior/idle/image_4.png'),
    ],
  },
};

// Default skin to use when skin not found
const DEFAULT_SKIN = 'warrior';

const SKIN_COLORS: Record<string, { primary: string; secondary: string; accent: string }> = {
  warrior: { primary: '#E53935', secondary: '#FFCDD2', accent: '#B71C1C' },
};

interface GameCharacterProps {
  characterClass: string; // This is now treated as 'skin'
  isPlayer: boolean;
  isAttacking: boolean;
  isHit: boolean;
  isCritical: boolean;
  isDefending: boolean;
  isDead: boolean;
  size?: number;
}

const GameCharacter: React.FC<GameCharacterProps> = ({
  characterClass,
  isPlayer,
  isAttacking,
  isHit,
  isCritical,
  isDefending,
  isDead,
  size = 120,
}) => {
  const skinKey = SKIN_SPRITES[characterClass] ? characterClass : DEFAULT_SKIN;
  const colors = SKIN_COLORS[skinKey] || SKIN_COLORS[DEFAULT_SKIN];
  const sprites = SKIN_SPRITES[skinKey] || SKIN_SPRITES[DEFAULT_SKIN];
  
  const [currentFrame, setCurrentFrame] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const rotation = useRef(new Animated.Value(0)).current;

  // Idle breathing animation - cycle through frames
  useEffect(() => {
    if (isDead || isAttacking) return;
    
    const frameCount = sprites.idle?.length || 1;
    const interval = setInterval(() => {
      setCurrentFrame(prev => (prev + 1) % frameCount);
    }, 200); // 200ms per frame for smooth breathing
    
    return () => clearInterval(interval);
  }, [isDead, isAttacking, sprites.idle?.length]);

  // Attack animation
  useEffect(() => {
    if (isAttacking) {
      const dashDistance = isPlayer ? 60 : -60;
      Animated.sequence([
        Animated.timing(translateX, { toValue: dashDistance, duration: 150, useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.15, duration: 80, useNativeDriver: true }),
          Animated.timing(rotation, { toValue: isPlayer ? 15 : -15, duration: 80, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.timing(rotation, { toValue: 0, duration: 100, useNativeDriver: true }),
        ]),
        Animated.timing(translateX, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [isAttacking]);

  // Hit animation
  useEffect(() => {
    if (isHit) {
      const recoilDistance = isPlayer ? -12 : 12;
      Animated.sequence([
        Animated.timing(translateX, { toValue: recoilDistance, duration: 80, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [isHit]);

  // Death animation
  useEffect(() => {
    if (isDead) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0.3, duration: 500, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.7, duration: 500, useNativeDriver: true }),
        Animated.timing(rotation, { toValue: isPlayer ? -30 : 30, duration: 500, useNativeDriver: true }),
      ]).start();
    }
  }, [isDead]);

  const rotateInterpolate = rotation.interpolate({
    inputRange: [-30, 0, 30],
    outputRange: ['-30deg', '0deg', '30deg'],
  });

  // Get current sprite based on state
  const getCurrentSprite = () => {
    const idleSprites = sprites.idle || [];
    if (idleSprites.length > 0) {
      return idleSprites[currentFrame % idleSprites.length];
    }
    return null;
  };

  const currentSprite = getCurrentSprite();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            { translateX },
            { scale },
            { rotate: rotateInterpolate },
            { scaleX: isPlayer ? -1 : 1 }, // Player faces right, enemy faces left
          ],
          opacity,
        },
      ]}
    >
      {isDefending && <View style={[styles.defendAura, { borderColor: colors.secondary }]} />}
      {isCritical && <View style={styles.criticalAura} />}
      {isHit && <View style={styles.hitOverlay} />}
      
      {currentSprite ? (
        <Image
          source={currentSprite}
          style={[styles.characterImage, { width: size, height: size * 1.4 }]}
          resizeMode="contain"
        />
      ) : (
        <View style={[styles.placeholder, { width: size, height: size * 1.4, backgroundColor: colors.primary }]}>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  characterImage: {
    // Image sizing handled by props
  },
  placeholder: {
    borderRadius: 10,
    opacity: 0.5,
  },
  defendAura: {
    position: 'absolute',
    width: 140,
    height: 180,
    borderRadius: 70,
    borderWidth: 3,
    backgroundColor: 'rgba(100,181,246,0.2)',
  },
  criticalAura: {
    position: 'absolute',
    width: 150,
    height: 190,
    borderRadius: 75,
    backgroundColor: 'rgba(255,215,0,0.3)',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  hitOverlay: {
    position: 'absolute',
    width: 130,
    height: 170,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
});

export default GameCharacter;
