import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SurveyModalProps {
  visible: boolean;
  onClose: () => void;
  caseId: string;
  providerId: string;
  providerName: string;
}

export default function SurveyModal({
  visible,
  onClose,
  caseId,
  providerId,
  providerName,
}: SurveyModalProps) {
  const [loading, setLoading] = useState(false);
  const [surveyData, setsurveyData] = useState({
    communication: 0,
    quality: 0,
    timeliness: 0,
    valueForMoney: 0,
    rating: 0, // Overall rating (auto-calculated)
    comment: '',
  });

  // Auto-calculate overall rating
  const calculateOverallRating = () => {
    const ratings = [
      surveyData.communication,
      surveyData.quality,
      surveyData.timeliness,
      surveyData.valueForMoney,
    ].filter(r => r > 0);

    if (ratings.length === 0) return 0;
    return Math.round(ratings.reduce((sum, r) => sum + r, 0) / ratings.length);
  };

  const handleStarClick = (field: string, value: number) => {
    const newData = { ...surveyData, [field]: value };
    
    // Auto-calculate overall rating
    if (field !== 'rating') {
      const ratings = [
        newData.communication,
        newData.quality,
        newData.timeliness,
        newData.valueForMoney,
      ].filter(r => r > 0);

      if (ratings.length > 0) {
        newData.rating = Math.round(ratings.reduce((sum, r) => sum + r, 0) / ratings.length);
      }
    }

    setsurveyData(newData);
  };

  const renderStars = (field: string, value: number) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => handleStarClick(field, star)}
            style={styles.starButton}
          >
            <Text style={[
              styles.star,
              star <= value && styles.starFilled
            ]}>
              ⭐
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.ratingValue}>{value}/5</Text>
      </View>
    );
  };

  const handleSubmit = async () => {
    // Validation
    if (surveyData.rating === 0) {
      Alert.alert('Грешка', 'Моля поставете поне една оценка от категориите по-долу');
      return;
    }

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('auth_token');

      // Get current user
      const userResponse = await fetch('https://maystorfix.com/api/v1/users/me', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const userData: any = await userResponse.json();
      const user = userData.data?.user || userData.data;

      // Submit review
      const payload = {
        caseId,
        providerId,
        customerId: user.id,
        rating: surveyData.rating,
        communication: surveyData.communication,
        quality: surveyData.quality,
        timeliness: surveyData.timeliness,
        valueForMoney: surveyData.valueForMoney,
        comment: surveyData.comment,
      };

      console.log('📤 Submitting review:', payload);

      const response = await fetch('https://maystorfix.com/api/v1/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result: any = await response.json();

      if (result.success) {
        Alert.alert(
          'Благодарим!',
          'Вашият отзив беше изпратен успешно!',
          [{ text: 'OK', onPress: () => {
            onClose();
            // Reset form
            setsurveyData({
              communication: 0,
              quality: 0,
              timeliness: 0,
              valueForMoney: 0,
              rating: 0,
              comment: '',
            });
          }}]
        );
      } else {
        throw new Error(result.error?.message || 'Failed to submit review');
      }
    } catch (error: any) {
      console.error('❌ Error submitting review:', error);
      Alert.alert('Грешка', error.message || 'Неуспешно изпращане на отзива');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>⭐ Оценете услугата</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.providerName}>Оценка за: {providerName}</Text>

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                💡 <Text style={styles.infoBold}>Как работи:</Text> Оценете всяка категория по-долу и общата оценка ще се изчисли автоматично като средна стойност.
              </Text>
            </View>

            {/* Overall Rating (Auto-calculated) */}
            <View style={styles.ratingSection}>
              <Text style={styles.ratingLabel}>Обща оценка</Text>
              <View style={styles.overallRating}>
                <Text style={styles.overallRatingText}>{surveyData.rating}/5</Text>
                <Text style={styles.overallRatingStars}>
                  {'⭐'.repeat(surveyData.rating)}{'☆'.repeat(5 - surveyData.rating)}
                </Text>
              </View>
              <Text style={styles.autoCalculated}>Изчислява се автоматично</Text>
            </View>

            {/* Communication */}
            <View style={styles.ratingSection}>
              <Text style={styles.ratingLabel}>Комуникация</Text>
              {renderStars('communication', surveyData.communication)}
            </View>

            {/* Quality */}
            <View style={styles.ratingSection}>
              <Text style={styles.ratingLabel}>Качество на работата</Text>
              {renderStars('quality', surveyData.quality)}
            </View>

            {/* Timeliness */}
            <View style={styles.ratingSection}>
              <Text style={styles.ratingLabel}>Спазване на срокове</Text>
              {renderStars('timeliness', surveyData.timeliness)}
            </View>

            {/* Value for Money */}
            <View style={styles.ratingSection}>
              <Text style={styles.ratingLabel}>Съотношение цена-качество</Text>
              {renderStars('valueForMoney', surveyData.valueForMoney)}
            </View>

            {/* Comment */}
            <View style={styles.commentSection}>
              <Text style={styles.ratingLabel}>Коментар (по избор)</Text>
              <TextInput
                style={styles.commentInput}
                value={surveyData.comment}
                onChangeText={(text) => setsurveyData({ ...surveyData, comment: text })}
                placeholder="Споделете вашето мнение..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Requirements */}
            <View style={styles.requirementsBox}>
              <Text style={styles.requirementsTitle}>📋 Изисквания:</Text>
              <Text style={[
                styles.requirement,
                surveyData.rating > 0 && styles.requirementMet
              ]}>
                • Поне една оценка от категориите
              </Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>🌟 Изпрати отзив</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#94A3B8',
    fontWeight: '600',
  },
  modalContent: {
    padding: 20,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#CBD5E1',
    marginBottom: 16,
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 13,
    color: '#93C5FD',
    lineHeight: 18,
  },
  infoBold: {
    fontWeight: '700',
  },
  ratingSection: {
    marginBottom: 20,
  },
  ratingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starButton: {
    padding: 4,
  },
  star: {
    fontSize: 32,
    color: '#64748B',
  },
  starFilled: {
    color: '#FBBF24',
  },
  ratingValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#CBD5E1',
    marginLeft: 12,
  },
  overallRating: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  overallRatingText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FBBF24',
    marginBottom: 8,
  },
  overallRatingStars: {
    fontSize: 24,
  },
  autoCalculated: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  commentSection: {
    marginBottom: 20,
  },
  commentInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#FFFFFF',
    height: 100,
    textAlignVertical: 'top',
  },
  requirementsBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  requirement: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 4,
  },
  requirementMet: {
    color: '#10B981',
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#6366F1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
