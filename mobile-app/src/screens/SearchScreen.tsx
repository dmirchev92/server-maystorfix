import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import ApiService from '../services/ApiService';
// Icon removed since react-native-vector-icons is not installed
// import Icon from 'react-native-vector-icons/Ionicons'; 

// Constants
const SERVICE_TYPES = [
  { value: 'electrician', label: 'Електротехник' },
  { value: 'plumber', label: 'Водопроводчик' },
  { value: 'hvac', label: 'Климатик' },
  { value: 'carpenter', label: 'Дърводелец' },
  { value: 'painter', label: 'Бояджия' },
  { value: 'locksmith', label: 'Ключар' },
  { value: 'cleaner', label: 'Почистване' },
  { value: 'gardener', label: 'Градинар' },
  { value: 'handyman', label: 'Майстор за всичко' },
  { value: 'appliance_repair', label: 'Ремонт на уреди' },
];

// Fallback cities (used while loading from API)
const FALLBACK_CITIES = [
  { value: 'София', label: 'София' },
  { value: 'Пловдив', label: 'Пловдив' },
  { value: 'Варна', label: 'Варна' },
  { value: 'Бургас', label: 'Бургас' },
];

const SearchScreen = () => {
  const navigation = useNavigation<any>();
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    category: '',
    city: '',
    neighborhood: '',
  });
  
  // Dynamic location data
  const [cities, setCities] = useState<{value: string; label: string}[]>(FALLBACK_CITIES);
  const [neighborhoods, setNeighborhoods] = useState<{value: string; label: string}[]>([]);

  // Load cities on mount
  useEffect(() => {
    const loadCities = async () => {
      try {
        const response = await ApiService.getInstance().getCities();
        if (response.success && response.data?.cities) {
          setCities(response.data.cities.slice(0, 30));
        }
      } catch (error) {
        console.error('Error loading cities:', error);
      }
    };
    loadCities();
  }, []);
  
  // Load neighborhoods when city changes
  useEffect(() => {
    if (filters.city) {
      const loadNeighborhoods = async () => {
        try {
          const response = await ApiService.getInstance().getNeighborhoods(filters.city);
          if (response.success && response.data?.neighborhoods) {
            setNeighborhoods(response.data.neighborhoods);
          } else {
            setNeighborhoods([]);
          }
        } catch (error) {
          console.error('Error loading neighborhoods:', error);
          setNeighborhoods([]);
        }
      };
      loadNeighborhoods();
    } else {
      setNeighborhoods([]);
    }
  }, [filters.city]);

  useEffect(() => {
    fetchProviders();
  }, [filters.category, filters.city, filters.neighborhood]);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 50, t: Date.now() };
      if (filters.category) params.category = filters.category;
      if (filters.city) params.city = filters.city;
      if (filters.neighborhood) params.neighborhood = filters.neighborhood;

      const response = await ApiService.getInstance().searchProviders(params);
      
      if (response.success && response.data) {
        // Filter valid providers
        const validProviders = Array.isArray(response.data) 
          ? response.data 
          : (response.data as any).data || [];
          
        setProviders(validProviders);
      } else {
        setProviders([]);
      }
    } catch (error) {
      console.error('Error fetching providers:', error);
      setProviders([]);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryLabel = (value: string) => {
    const type = SERVICE_TYPES.find(t => t.value === value);
    return type ? type.label : value;
  };

  const handleChat = (provider: any) => {
    navigation.navigate('ChatDetail', {
      conversationId: `new_${provider.id}`,
      providerName: provider.businessName || provider.name,
      providerId: provider.id
    });
  };

  const handleViewProfile = (provider: any) => {
     Alert.alert('Profile', 'Provider profile coming soon');
  };

  const renderProvider = ({ item }: { item: any }) => {
    const displayName = item.businessName || item.business_name || `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Specialist';
    const category = item.serviceCategory || item.service_category;
    const rating = item.rating || 0;
    const reviewCount = item.totalReviews || item.total_reviews || 0;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          {item.profileImageUrl ? (
            <Image source={{ uri: item.profileImageUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.headerInfo}>
            <Text style={styles.providerName} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.providerCategory}>{getCategoryLabel(category)}</Text>
          </View>
          <View style={styles.ratingBadge}>
            <Text style={styles.star}>⭐</Text>
            <Text style={styles.ratingText}>{Number(rating).toFixed(1)}</Text>
          </View>
        </View>

        {/* Categories Tags */}
        <View style={styles.tagsContainer}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{getCategoryLabel(category)}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
           <Text style={styles.statText}>📍 {item.city || 'София'}</Text>
           <Text style={styles.statText}>⭐ {rating} ({reviewCount})</Text>
        </View>

        <Text style={styles.description} numberOfLines={3}>
          {item.description || 'Професионални услуги с качество и гаранция.'}
        </Text>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.profileBtn} onPress={() => handleViewProfile(item)}>
             <Text style={styles.btnText}>Виж профил</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.chatBtn} onPress={() => handleChat(item)}>
             <Text style={styles.btnText}>Чат</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0f172a', '#1e293b', '#312e81']} style={styles.background}>
        <StatusBar barStyle="light-content" />
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Намерени Услуги</Text>
          <TouchableOpacity 
            style={styles.mapButton}
            onPress={() => navigation.navigate('MapSearch')}
          >
             <Text style={styles.mapButtonText}>🗺️ Карта</Text>
          </TouchableOpacity>
        </View>

        {/* Filters */}
        <View style={styles.filtersContainer}>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={filters.category}
              onValueChange={(val) => setFilters(prev => ({ ...prev, category: val }))}
              style={styles.picker}
              dropdownIconColor="white"
              mode="dropdown"
            >
              <Picker.Item label="Всички услуги" value="" color="#000" />
              {SERVICE_TYPES.map(t => <Picker.Item key={t.value} label={t.label} value={t.value} color="#000" />)}
            </Picker>
          </View>

          <View style={styles.row}>
            <View style={[styles.pickerWrapper, { flex: 1, marginRight: 8 }]}>
              <Picker
                selectedValue={filters.city}
                onValueChange={(val) => setFilters(prev => ({ ...prev, city: val, neighborhood: '' }))}
                style={styles.picker}
                dropdownIconColor="white"
              >
                <Picker.Item label="Град" value="" color="#000" />
                {cities.map(c => <Picker.Item key={c.value} label={c.label} value={c.value} color="#000" />)}
              </Picker>
            </View>

            {filters.city && neighborhoods.length > 0 && (
              <View style={[styles.pickerWrapper, { flex: 1 }]}>
                 <Picker
                  selectedValue={filters.neighborhood}
                  onValueChange={(val) => setFilters(prev => ({ ...prev, neighborhood: val }))}
                  style={styles.picker}
                  dropdownIconColor="white"
                >
                  <Picker.Item label="Квартал" value="" color="#000" />
                  {neighborhoods.map(n => <Picker.Item key={n.value} label={n.label} value={n.value} color="#000" />)}
                </Picker>
              </View>
            )}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsBar}>
           <Text style={styles.statsText}>📊 Намерени {providers.length} услуги</Text>
        </View>

        {/* List */}
        {loading ? (
          <ActivityIndicator size="large" color="#818cf8" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={providers}
            renderItem={renderProvider}
            keyExtractor={(item) => item.id || Math.random().toString()}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Няма намерени услуги.</Text>
                <Text style={styles.emptySubText}>Опитайте с други критерии.</Text>
              </View>
            }
          />
        )}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  mapButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  mapButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  filtersContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  pickerWrapper: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    height: 50,
    justifyContent: 'center',
  },
  picker: {
    color: 'white',
  },
  row: {
    flexDirection: 'row',
  },
  statsBar: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  statsText: {
    color: '#a5b4fc', // indigo-300
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4f46e5', // indigo-600
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  providerName: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  providerCategory: {
    color: '#cbd5e1', // slate-300
    fontSize: 14,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  star: {
    fontSize: 12,
    marginRight: 4,
  },
  ratingText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  tag: {
    backgroundColor: 'rgba(79, 70, 229, 0.2)', // indigo-500/20
    borderColor: 'rgba(129, 140, 248, 0.3)', // indigo-400/30
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 6,
  },
  tagText: {
    color: '#a5b4fc', // indigo-300
    fontSize: 12,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 12,
    justifyContent: 'space-between',
  },
  statText: {
    color: '#cbd5e1', // slate-300
    fontSize: 13,
  },
  description: {
    color: '#e2e8f0', // slate-200
    fontSize: 14,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 8,
    borderRadius: 8,
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  profileBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  chatBtn: {
    flex: 1,
    backgroundColor: '#4f46e5', // indigo-600
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubText: {
    color: '#94a3b8', // slate-400
    fontSize: 14,
  },
});

export default SearchScreen;
