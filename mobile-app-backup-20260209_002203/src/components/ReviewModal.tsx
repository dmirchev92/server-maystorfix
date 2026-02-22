import { Logger } from '../utils/Logger';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import ApiService from '../services/ApiService';

interface ReviewModalProps {
  visible: boolean;
  onClose: () => void;
  caseId: string;
  providerId: string;
  providerName: string;
  onSubmitSuccess?: () => void;
}

interface SurveyData {
  rating: number;
  comment: string;
  communication: number;
  quality: number;
  timeliness: number;
  valueForMoney: number;
  wouldRecommend?: boolean;
}

export default function ReviewModal({
  visible,
  onClose,
  caseId,
  providerId,
  providerName,
  onSubmitSuccess,
}: ReviewModalProps) {
  const [surveyData, setSurveyData] = useState<SurveyData>({
    rating: 0,
    comment: '',
    communication: 0,
    quality: 0,
    timeliness: 0,
    valueForMoney: 0,
    wouldRecommend: undefined,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate overall rating based on individual ratings
  const calculateOverallRating = (
    communication: number,
    quality: number,
    timeliness: number,
    valueForMoney: number
  ) => {
    const ratings = [communication, quality, timeliness, valueForMoney].filter(r => r > 0);
    if (ratings.length === 0) return 0;
    const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    // Round to nearest 0.5
    return Math.round(average * 2) / 2;
  };

  const handleStarClick = (field: keyof SurveyData, value: number) => {
    setSurveyData(prev => {
      const newData = { ...prev, [field]: value };

      // If updating individual ratings, recalculate overall rating
      if (field !== 'rating') {
        const communication = field === 'communication' ? value : prev.communication || 0;
        const quality = field === 'quality' ? value : prev.quality || 0;
        const timeliness = field === 'timeliness' ? value : prev.timeliness || 0;
        const valueForMoney = field === 'valueForMoney' ? value : prev.valueForMoney || 0;

        const overallRating = calculateOverallRating(communication, quality, timeliness, valueForMoney);
        newData.rating = overallRating;
      }

      return newData;
    });
  };

  const renderStars = (field: keyof SurveyData, currentValue: number) => {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map(star => {
          const isSelected = star <= currentValue;
          return (
            <TouchableOpacity
              key={star}
              onPress={() => handleStarClick(field, star)}
              style={styles.starButton}
            >
              <Text style={[styles.star, isSelected && styles.starSelected]}>
                {isSelected ? '⭐' : '☆'}
              </Text>
            </TouchableOpacity>
          );
        })}
        {currentValue > 0 && (
          <Text style={styles.ratingValue}>{currentValue}/5</Text>
        )}
      </View>
    );
  };

  const renderOverallStars = (rating: number) => {
    const stars = [];
    const full = Math.floor(rating);
    const hasHalf = Math.abs(rating - full - 0.5) < 0.01;

    for (let i = 1; i <= 5; i++) {
      if (i <= full) {
        stars.push('⭐');
      } else if (i === full + 1 && hasHalf) {
        stars.push('⭐');
      } else {
        stars.push('☆');
      }
    }
    return stars.join('');
  };

  const handleSubmit = async () => {
    if (surveyData.rating === 0) {
      setError('Моля поставете поне една оценка от категориите по-долу');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const reviewPayload = {
        caseId,
        providerId,
        rating: surveyData.rating,
        comment: surveyData.comment,
        communication: surveyData.communication || undefined,
        serviceQuality: surveyData.quality || undefined,
        timeliness: surveyData.timeliness || undefined,
        valueForMoney: surveyData.valueForMoney || undefined,
        wouldRecommend: surveyData.wouldRecommend,
      };

      const response = await ApiService.getInstance().createReview(reviewPayload);

      if (response.success) {
        Alert.alert('Успех', 'Благодарим за вашата оценка!');
        onSubmitSuccess?.();
        onClose();
        // Reset form
        setSurveyData({
          rating: 0,
          comment: '',
          communication: 0,
          quality: 0,
          timeliness: 0,
          valueForMoney: 0,
          wouldRecommend: undefined,
        });
      } else {
        const errorMessage = response.error?.message || 'Възникна грешка при изпращането на оценката';
        if (errorMessage.includes('already exists') || errorMessage.includes('вече')) {
          setError('Вие вече сте оценили тази услуга.');
        } else {
          setError(errorMessage);
        }
      }
    } catch (err: any) {
      Logger.error('Error submitting review:', err);
      setError(err.message || 'Възникна грешка при изпращането на оценката');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setSurveyData({
      rating: 0,
      comment: '',
      communication: 0,
      quality: 0,
      timeliness: 0,
      valueForMoney: 0,
      wouldRecommend: undefined,
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Оценете услугата</Text>
                <Text style={styles.subtitle}>Как оценявате работата на {providerName}?</Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Overall Rating */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Обща оценка</Text>
              <View style={styles.overallRating}>
                <Text style={styles.overallStars}>{renderOverallStars(surveyData.rating)}</Text>
                <Text style={styles.overallValue}>
                  {surveyData.rating > 0 ? `${surveyData.rating}/5` : 'Не е оценено'}
                </Text>
              </View>
              <Text style={styles.hint}>
                Общата оценка се изчислява автоматично като средна стойност
              </Text>
            </View>

            {/* Detailed Ratings */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Детайлни оценки</Text>

              <View style={styles.ratingItem}>
                <Text style={styles.ratingLabel}>Комуникация</Text>
                {renderStars('communication', surveyData.communication)}
              </View>

              <View style={styles.ratingItem}>
                <Text style={styles.ratingLabel}>Качество на работата</Text>
                {renderStars('quality', surveyData.quality)}
              </View>

              <View style={styles.ratingItem}>
                <Text style={styles.ratingLabel}>Спазване на срокове</Text>
                {renderStars('timeliness', surveyData.timeliness)}
              </View>

              <View style={styles.ratingItem}>
                <Text style={styles.ratingLabel}>Цена</Text>
                {renderStars('valueForMoney', surveyData.valueForMoney)}
              </View>
            </View>

            {/* Would Recommend */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Бихте ли препоръчали този специалист?</Text>
              <View style={styles.recommendRow}>
                <TouchableOpacity
                  style={[
                    styles.recommendButton,
                    surveyData.wouldRecommend === true && styles.recommendButtonYes,
                  ]}
                  onPress={() => setSurveyData(prev => ({ ...prev, wouldRecommend: true }))}
                >
                  <Text style={[
                    styles.recommendButtonText,
                    surveyData.wouldRecommend === true && styles.recommendButtonTextActive,
                  ]}>👍 Да</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.recommendButton,
                    surveyData.wouldRecommend === false && styles.recommendButtonNo,
                  ]}
                  onPress={() => setSurveyData(prev => ({ ...prev, wouldRecommend: false }))}
                >
                  <Text style={[
                    styles.recommendButtonText,
                    surveyData.wouldRecommend === false && styles.recommendButtonTextActive,
                  ]}>👎 Не</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Comment */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Коментар (по желание)</Text>
              <TextInput
                style={styles.commentInput}
                value={surveyData.comment}
                onChangeText={text => setSurveyData(prev => ({ ...prev, comment: text }))}
                placeholder="Споделете вашето мнение за услугата..."
                placeholderTextColor="#64748b"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Action Buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleClose}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelButtonText}>Отказ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (isSubmitting || surveyData.rating === 0) && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={isSubmitting || surveyData.rating === 0}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Изпрати оценка</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    width: '100%',
    maxHeight: '90%',
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#94a3b8',
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 14,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 12,
  },
  overallRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  overallStars: {
    fontSize: 24,
    marginRight: 12,
  },
  overallValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  hint: {
    fontSize: 12,
    color: '#818cf8',
  },
  ratingItem: {
    marginBottom: 16,
  },
  ratingLabel: {
    fontSize: 14,
    color: '#cbd5e1',
    marginBottom: 8,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starButton: {
    padding: 4,
  },
  star: {
    fontSize: 28,
    color: '#64748b',
  },
  starSelected: {
    color: '#fbbf24',
  },
  ratingValue: {
    marginLeft: 12,
    fontSize: 14,
    color: '#94a3b8',
  },
  recommendRow: {
    flexDirection: 'row',
    gap: 12,
  },
  recommendButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'transparent',
  },
  recommendButtonYes: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderColor: 'rgba(34, 197, 94, 0.5)',
  },
  recommendButtonNo: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: 'rgba(239, 68, 68, 0.5)',
  },
  recommendButtonText: {
    fontSize: 16,
    color: '#94a3b8',
  },
  recommendButtonTextActive: {
    color: '#f8fafc',
  },
  commentInput: {
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    color: '#f8fafc',
    fontSize: 14,
    minHeight: 100,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#475569',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#e2e8f0',
  },
  submitButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#6366f1',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
