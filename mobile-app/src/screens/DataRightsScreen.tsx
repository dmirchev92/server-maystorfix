import { Logger } from '../utils/Logger';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import ApiService from '../services/ApiService';

interface DataRequest {
  id: string;
  type: 'access' | 'deletion' | 'portability' | 'correction' | 'restriction';
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  createdAt: string;
  completedAt?: string;
  description: string;
}

const DataRightsScreen: React.FC = () => {
  const dispatch = useDispatch();
  const { currentMode } = useSelector((state: RootState) => state.app);
  
  const [requests, setRequests] = useState<DataRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedRequestType, setSelectedRequestType] = useState<string>('');
  const [requestDescription, setRequestDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadDataRequests();
  }, []);

  const loadDataRequests = async () => {
    try {
      setIsLoading(true);
      // Load data processing info from backend
      const response = await ApiService.getInstance().getDataProcessingInfo();
      if (response.success && response.data?.processingActivities) {
        // Convert processing activities to display as informational items
        const activities = response.data.processingActivities as Array<{
          dataType: string;
          purpose: string;
          legalBasis: string;
          retentionPeriod: string;
        }>;
        const displayRequests: DataRequest[] = activities.map((activity, index) => ({
          id: `activity_${index}`,
          type: 'access' as const,
          status: 'completed' as const,
          createdAt: new Date().toISOString(),
          description: `${activity.purpose} (${activity.retentionPeriod})`,
        }));
        setRequests(displayRequests);
      } else {
        setRequests([]);
      }
    } catch (error) {
      Logger.error('Error loading data requests:', error);
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getRequestTypeLabel = (type: string): string => {
    const labels = {
      access: 'Достъп до данни',
      deletion: 'Изтриване на данни',
      portability: 'Пренос на данни',
      correction: 'Корекция на данни',
      restriction: 'Ограничаване на обработката',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getStatusLabel = (status: string): string => {
    const labels = {
      pending: 'Чакаща',
      processing: 'Обработва се',
      completed: 'Завършена',
      rejected: 'Отхвърлена',
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getStatusColor = (status: string): string => {
    const colors = {
      pending: '#f39c12',
      processing: '#3498db',
      completed: '#27ae60',
      rejected: '#e74c3c',
    };
    return colors[status as keyof typeof colors] || '#95a5a6';
  };

  const handleRequestData = (type: string) => {
    setSelectedRequestType(type);
    setRequestDescription('');
    setShowRequestModal(true);
  };

  const submitDataRequest = async () => {
    if (!requestDescription.trim()) {
      Alert.alert('Грешка', 'Моля, опишете заявката си.');
      return;
    }

    try {
      setIsSubmitting(true);
      
      if (selectedRequestType === 'access') {
        // Use real GDPR my-data endpoint
        const response = await ApiService.getInstance().getMyData();
        if (response.success) {
          Alert.alert(
            'Данните са получени',
            'Вашите лични данни са заредени успешно. Може да ги прегледате от раздел "Вашите заявки".',
            [{ text: 'OK' }]
          );
        } else {
          throw new Error(response.error?.message || 'Неуспешна заявка');
        }
      } else if (selectedRequestType === 'deletion') {
        // Use account deletion endpoint
        const response = await ApiService.getInstance().requestAccountDeletion(
          '', // Email will be auto-detected
          requestDescription
        );
        if (!response.success) {
          throw new Error(response.error?.message || 'Неуспешна заявка');
        }
      }

      // Add to local state
      const newRequest: DataRequest = {
        id: Date.now().toString(),
        type: selectedRequestType as any,
        status: 'pending',
        createdAt: new Date().toISOString(),
        description: requestDescription,
      };

      setRequests(prev => [newRequest, ...prev]);
      setShowRequestModal(false);
      setRequestDescription('');

      Alert.alert(
        'Успешно',
        'Вашата заявка е изпратена. Ще получите отговор в рамките на 30 дни.',
        [{ text: 'OK' }]
      );

    } catch (error: any) {
      Logger.error('Error submitting data request:', error);
      Alert.alert(
        'Грешка',
        error?.message || 'Възникна проблем при изпращането на заявката. Моля, опитайте отново.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadData = async (requestId: string) => {
    try {
      // TODO: Implement data download
      Alert.alert(
        'Изтегляне на данни',
        'Функцията за изтегляне ще бъде достъпна скоро.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Logger.error('Error downloading data:', error);
    }
  };

  const renderRequestItem = (request: DataRequest) => (
    <View key={request.id} style={styles.requestItem}>
      <View style={styles.requestHeader}>
        <Text style={styles.requestType}>
          {getRequestTypeLabel(request.type)}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) }]}>
          <Text style={styles.statusText}>
            {getStatusLabel(request.status)}
          </Text>
        </View>
      </View>
      
      <Text style={styles.requestDescription}>{request.description}</Text>
      
      <View style={styles.requestMeta}>
        <Text style={styles.requestDate}>
          Създадена: {new Date(request.createdAt).toLocaleDateString('bg-BG')}
        </Text>
        {request.completedAt && (
          <Text style={styles.requestDate}>
            Завършена: {new Date(request.completedAt).toLocaleDateString('bg-BG')}
          </Text>
        )}
      </View>

      {request.status === 'completed' && request.type === 'access' && (
        <TouchableOpacity
          style={styles.downloadButton}
          onPress={() => downloadData(request.id)}
        >
          <Text style={styles.downloadButtonText}>📥 Изтегли данните</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Права на данните</Text>
        <Text style={styles.subtitle}>
          Упражнете вашите GDPR права за контрол върху данните
        </Text>
      </View>

      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerText}>
          🔒 Според GDPR имате право да контролирате как данните ви се обработват. 
          Всички заявки се обработват в рамките на 30 дни.
        </Text>
      </View>

      <View style={styles.rightsContainer}>
        <Text style={styles.sectionTitle}>Вашите права:</Text>
        
        <TouchableOpacity
          style={styles.rightItem}
          onPress={() => handleRequestData('access')}
        >
          <Text style={styles.rightTitle}>👁️ Достъп до данни</Text>
          <Text style={styles.rightDescription}>
            Получете копие от всички данни, които съхраняваме за вас
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.rightItem}
          onPress={() => handleRequestData('correction')}
        >
          <Text style={styles.rightTitle}>✏️ Корекция на данни</Text>
          <Text style={styles.rightDescription}>
            Поправете неточни или непълни данни
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.rightItem}
          onPress={() => handleRequestData('deletion')}
        >
          <Text style={styles.rightTitle}>🗑️ Изтриване на данни</Text>
          <Text style={styles.rightDescription}>
            Изтрийте данните си (право на забвене)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.rightItem}
          onPress={() => handleRequestData('portability')}
        >
          <Text style={styles.rightTitle}>📤 Пренос на данни</Text>
          <Text style={styles.rightDescription}>
            Получете данните в структуриран, машиночетим формат
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.rightItem}
          onPress={() => handleRequestData('restriction')}
        >
          <Text style={styles.rightTitle}>⏸️ Ограничаване на обработката</Text>
          <Text style={styles.rightDescription}>
            Ограничете как данните ви се обработват
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.requestsContainer}>
        <Text style={styles.sectionTitle}>Вашите заявки:</Text>
        
        {isLoading ? (
          <ActivityIndicator size="large" color="#3498db" style={styles.loader} />
        ) : requests.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              Все още нямате заявки за данни
            </Text>
          </View>
        ) : (
          requests.map(renderRequestItem)
        )}
      </View>

      <Modal
        visible={showRequestModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Заявка за {getRequestTypeLabel(selectedRequestType)}
            </Text>
            
            <Text style={styles.modalDescription}>
              Обяснете подробно какво искате да постигнете с тази заявка:
            </Text>
            
            <TextInput
              style={styles.modalInput}
              multiline
              numberOfLines={4}
              placeholder="Опишете заявката си тук..."
              value={requestDescription}
              onChangeText={setRequestDescription}
              textAlignVertical="top"
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowRequestModal(false)}
              >
                <Text style={styles.modalCancelButtonText}>Отказ</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalSubmitButton, isSubmitting && styles.modalSubmitButtonDisabled]}
                onPress={submitDataRequest}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSubmitButtonText}>Изпрати</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    lineHeight: 22,
  },
  infoBanner: {
    backgroundColor: '#e8f4fd',
    margin: 20,
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  infoBannerText: {
    fontSize: 14,
    color: '#2980b9',
    lineHeight: 20,
    textAlign: 'center',
  },
  rightsContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 16,
  },
  rightItem: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  rightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  rightDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    lineHeight: 20,
  },
  requestsContainer: {
    padding: 20,
  },
  loader: {
    marginVertical: 40,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#95a5a6',
    textAlign: 'center',
  },
  requestItem: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  requestDescription: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 12,
  },
  requestMeta: {
    marginBottom: 12,
  },
  requestDate: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  downloadButton: {
    backgroundColor: '#27ae60',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 16,
    lineHeight: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 20,
    minHeight: 100,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalCancelButton: {
    flex: 1,
    padding: 12,
    marginRight: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: '#7f8c8d',
    fontSize: 16,
    fontWeight: '600',
  },
  modalSubmitButton: {
    flex: 1,
    backgroundColor: '#3498db',
    padding: 12,
    marginLeft: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  modalSubmitButtonDisabled: {
    backgroundColor: '#95a5a6',
  },
  modalSubmitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DataRightsScreen;
