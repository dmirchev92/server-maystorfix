import { Logger } from '../utils/Logger';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Animated,
  Easing,
  Alert,
  ScrollView,
  Image,
  ActivityIndicator
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import SocketIOService from '../services/SocketIOService';
import ApiService from '../services/ApiService';
import { useNavigation } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

interface JobAlertData {
  id: string; // notification ID
  caseId: string;
  category: string;
  location: string;
  distance: string;
  budget: string;
  description: string;
  timeoutSeconds: number;
  biddingEnabled?: boolean;
  screenshots?: Array<{ url: string }>;
}

const BUDGET_RANGES = [
  { value: '1-125', label: '1-125 €' },
  { value: '126-250', label: '126-250 €' },
  { value: '251-400', label: '251-400 €' },
  { value: '401-500', label: '401-500 €' },
  { value: '501-1000', label: '501-1000 €' },
  { value: '1001-1500', label: '1001-1500 €' },
  { value: '1501-2000', label: '1501-2000 €' },
  { value: '2001-2500', label: '2001-2500 €' },
  { value: '2501-3000', label: '2501-3000 €' },
  { value: '3001-3500', label: '3001-3500 €' },
  { value: '3501-4000', label: '3501-4000 €' },
  { value: '4001-4500', label: '4001-4500 €' },
  { value: '4501-5000', label: '4501-5000 €' },
  { value: '5000+', label: '5000+ €' },
];

const JobAlertModal = () => {
  const [visible, setVisible] = useState(false);
  const [jobData, setJobData] = useState<JobAlertData | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [proposedBudget, setProposedBudget] = useState('');
  const [caseImages, setCaseImages] = useState<string[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [estimatedPoints, setEstimatedPoints] = useState<number | null>(null);
  const navigation = useNavigation<any>();
  
  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    // Listen for incoming jobs
    const unsubscribe = SocketIOService.getInstance().onJobIncoming((data) => {
      Logger.debug('📱 JobAlertModal - Received job:', data);
      setJobData(data);
      setTimeLeft(data.timeoutSeconds || 300);
      setVisible(true);
      
      // Extract screenshots from notification data if available
      if (data.screenshots && Array.isArray(data.screenshots)) {
        const imageUrls = data.screenshots.map((s: any) => s.url || s);
        Logger.debug('📷 Extracted screenshots from notification:', imageUrls);
        setCaseImages(imageUrls);
      } else {
        // Fallback: fetch case details if screenshots not in notification
        fetchCaseDetails(data.caseId);
      }
      
      // Start animations
      startPulseAnimation();
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 20,
        friction: 7
      }).start();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (visible && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [visible, timeLeft]);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ])
    ).start();
  };

  const fetchCaseDetails = async (caseId: string) => {
    try {
      setLoadingImages(true);
      const response = await ApiService.getInstance().getCase(caseId);
      if (response.success && response.data) {
        // Extract screenshots from case data
        const screenshots = response.data.screenshots || [];
        const imageUrls = screenshots.map((s: any) => s.url);
        Logger.debug('📷 Fetched case screenshots:', imageUrls);
        setCaseImages(imageUrls);
      }
    } catch (error) {
      Logger.error('Error fetching case details:', error);
    } finally {
      setLoadingImages(false);
    }
  };

  const handleTimeout = () => {
    setVisible(false);
    setProposedBudget('');
    Alert.alert('Времето изтече', 'Заявката вече е достъпна за всички специалисти.');
  };

  const handleIgnore = () => {
    Animated.timing(slideAnim, {
      toValue: height,
      duration: 300,
      useNativeDriver: true
    }).start(() => {
      setVisible(false);
      setJobData(null);
      setProposedBudget('');
    });
  };

  // Calculate point cost based on budget range (matching BidModal logic)
  // Uses new budget ranges matching backend PointsService
  const calculatePointCost = (budgetRange: string): number => {
    // Points costs for Normal tier (most common) - matches database subscription_tiers.limits
    const pointsCosts: { [key: string]: number } = {
      '1-250': 15,
      '251-500': 25,
      '501-750': 35,
      '751-1000': 45,
      '1001-2000': 70,
      '2001-3000': 100,
      '3001-4000': 140,
      '4001-5000': 180,
      '5001-6000': 220,
      '6001-7000': 260,
      '7001-8000': 300,
      '8001-9000': 340,
      '9001-10000': 380,
      '10000+': 380,
    };
    
    return pointsCosts[budgetRange] || 0;
  };

  const handleSubmitBid = async () => {
    if (!jobData || !proposedBudget.trim()) {
      Alert.alert('Грешка', 'Моля изберете ценови диапазон.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await ApiService.getInstance().placeBid(
        jobData.caseId,
        proposedBudget
      );

      if (response.success) {
        setVisible(false);
        const message = (response as any).message || 'Офертата е подадена успешно!';
        Alert.alert(
          'Успех!',
          `✅ ${message}\n\nВие сте наддавач #${response.data?.bid_order}\nКлиентът ще избере изпълнител.`
        );
      } else {
        Alert.alert('Грешка', response.error?.message || 'Неуспешно изпращане на офертата.');
      }
    } catch (error) {
      Alert.alert('Грешка', 'Възникна проблем при свързването със сървъра.');
    } finally {
      setSubmitting(false);
      setProposedBudget('');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (!jobData) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleIgnore}
    >
      <View style={styles.overlay}>
        <Animated.View 
          style={[
            styles.container,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <View style={styles.header}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>НОВА ЗАЯВКА</Text>
            </View>
            <Text style={styles.timer}>{formatTime(timeLeft)}</Text>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.content}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <Text style={styles.icon}>🔔</Text>
              </Animated.View>
              
              <Text style={styles.category}>{jobData.category}</Text>
              <Text style={styles.location}>📍 {jobData.location}</Text>
              <Text style={styles.distance}>🚗 {jobData.distance} км от вас</Text>
              
              <View style={styles.budgetContainer}>
                <Text style={styles.budgetLabel}>Бюджет на клиента</Text>
                <Text style={styles.budget}>{jobData.budget} €</Text>
              </View>

              <Text style={styles.description} numberOfLines={3}>
                "{jobData.description}"
              </Text>

              {/* Case Images */}
              {caseImages.length > 0 && (
                <View style={styles.imagesContainer}>
                  <Text style={styles.imagesTitle}>Снимки:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {caseImages.map((imageUrl, index) => (
                      <Image
                        key={index}
                        source={{ uri: imageUrl }}
                        style={styles.caseImage}
                        resizeMode="cover"
                      />
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Bidding Form - Always Visible */}
              <View style={styles.bidInputContainer}>
                <Text style={styles.bidInputTitle}>Предложете своя цена</Text>
                <Text style={styles.bidHint}>Клиентът ще избере измежду до 3 оферти</Text>
                
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={proposedBudget}
                    onValueChange={(value) => {
                      setProposedBudget(value);
                      if (value) {
                        setEstimatedPoints(calculatePointCost(value));
                      } else {
                        setEstimatedPoints(null);
                      }
                    }}
                    style={styles.picker}
                  >
                    <Picker.Item label="Изберете ценови диапазон..." value="" />
                    {BUDGET_RANGES.map((range) => (
                      <Picker.Item
                        key={range.value}
                        label={range.label}
                        value={range.value}
                      />
                    ))}
                  </Picker>
                </View>
                
                {estimatedPoints && estimatedPoints > 0 && (
                  <Text style={styles.estimatedPoints}>
                    ⭐ Цена при спечелване: {estimatedPoints} точк{estimatedPoints > 1 ? 'и' : 'а'}
                  </Text>
                )}
              </View>
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity 
              style={[styles.button, styles.ignoreButton]}
              onPress={handleIgnore}
              disabled={submitting}
            >
              <Text style={styles.ignoreText}>Игнорирай</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.button, styles.bidButton]}
              onPress={handleSubmitBid}
              disabled={submitting}
            >
              <Text style={styles.bidButtonText}>
                {submitting ? 'Изпращане...' : 'ИЗПРАТИ'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: height * 0.6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  badge: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  timer: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#DC2626',
    fontVariant: ['tabular-nums'],
  },
  content: {
    alignItems: 'center',
    marginBottom: 32,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  category: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  location: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 4,
    textAlign: 'center',
  },
  distance: {
    fontSize: 16,
    color: '#4B5563',
    fontWeight: '600',
    marginBottom: 24,
  },
  budgetContainer: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  budgetLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  budget: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#059669',
  },
  description: {
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButton: {
    backgroundColor: '#F3F4F6',
  },
  acceptButton: {
    backgroundColor: '#059669',
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  declineText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
  },
  acceptText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  scrollContent: {
    maxHeight: height * 0.5,
  },
  imagesContainer: {
    width: '100%',
    marginTop: 16,
    marginBottom: 16,
  },
  imagesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  caseImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
    marginRight: 8,
  },
  bidInputContainer: {
    width: '100%',
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  bidInputTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  bidHint: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    marginTop: 8,
    marginBottom: 8,
  },
  picker: {
    height: 50,
    color: '#1f2937',
  },
  estimatedPoints: {
    fontSize: 14,
    color: '#F59E0B',
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  ignoreButton: {
    backgroundColor: '#F3F4F6',
    flex: 1,
  },
  ignoreText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
  },
  bidButton: {
    backgroundColor: '#059669',
    flex: 2,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  bidButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
});

export default JobAlertModal;
