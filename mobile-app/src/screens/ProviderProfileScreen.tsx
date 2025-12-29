import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Image } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import ApiService from '../services/ApiService';

const Field = React.memo(({ label, value, onChangeText, multiline=false }: any) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={[styles.input, multiline && styles.multiline]}
      value={value}
      onChangeText={onChangeText}
      multiline={multiline}
      blurOnSubmit={false}
      textAlignVertical={multiline ? 'top' : 'center'}
    />
  </View>
));

export default function ProviderProfileScreen() {
  const [form, setForm] = useState({
    userId: '',
    businessName: '',
    serviceCategory: '',
    description: '',
    experienceYears: '',
    hourlyRate: '',
    city: '',
    neighborhood: '',
    phoneNumber: '',
    email: '',
    profileImageUrl: '',
  });
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [certificates, setCertificates] = useState<string>('');
  const [profileUrl, setProfileUrl] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);

  React.useEffect(() => {
    (async () => {
      try {
        // Load service categories
        const res = await ApiService.getInstance().getServiceCategories();
        if (res.success && res.data) {
          const arr = (res.data as any[]).map((c: any) => ({ id: c.id || c.name, name: c.name || c.nameEn || c.id }));
          setCategories(arr);
        }

        // Load current user ID and existing profile
        const userRes = await ApiService.getInstance().getCurrentUser();
        if (userRes.success && userRes.data) {
          const userId = (userRes.data as any)?.user?.id || (userRes.data as any)?.id;
          if (userId) {
            setForm(prev => ({ ...prev, userId }));
            console.log('🔄 Loaded user ID for profile sync:', userId);
          }
        }
      } catch (error) {
        console.error('Error loading profile data:', error);
      }
    })();
  }, []);

  const handleSave = async () => {
    if (!form.userId) {
      Alert.alert('Грешка', 'Потребителският идентификатор не е намерен');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        userId: form.userId,
        profile: {
          ...form,
          experienceYears: Number(form.experienceYears) || 0,
          hourlyRate: Number(form.hourlyRate) || 0,
        },
        gallery: galleryUrls,
        certificates: certificates.split('\n').map(line => ({ title: line.trim() }))
      };

      console.log(' Saving provider profile with marketplace sync:', payload);
      const response = await ApiService.getInstance().upsertProviderProfile(payload);
      
      if (response.success) {
        console.log(' Profile updated successfully - marketplace sync triggered');
        Alert.alert(
          'Успех', 
          'Профилът е обновен успешно!\n\nПромените ще се появят в търсачката след моменти.',
          [{ text: 'OK', style: 'default' }]
        );
      } else {
        console.error(' Profile update failed:', response.error);
        Alert.alert('Грешка', response.error?.message || 'Неуспешно обновяване на профила');
      }
    } catch (error) {
      console.error(' Error saving profile:', error);
      Alert.alert('Грешка', 'Неуспешно запазване на профила. Проверете връзката си и опитайте отново.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="always">
      <View style={styles.headerCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {profileUrl ? <Image source={{ uri: profileUrl }} style={styles.avatarLarge} /> : <View style={[styles.avatarLarge, { backgroundColor: '#eaeaea' }]} />}
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.headerTitle}>{form.businessName || 'Име на бизнес'}</Text>
            <Text style={styles.headerSubtitle}>{form.serviceCategory || 'Категория услуга'}</Text>
          </View>
          <TouchableOpacity style={styles.headerAction} onPress={async () => {
            try {
              const me = await ApiService.getInstance().getCurrentUser();
              const userId = (me.data as any)?.user?.id || (me.data as any)?.id || 'public';
              Alert.prompt?.('Поставете base64 изображение', undefined, async (base64) => {
                if (!base64) return;
                const res = await fetch('https://snapfix.bg/api/v1/uploads/image', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId, filename: 'avatar.jpg', data: base64 })
                });
                const json = await res.json() as any;
                if (json.success) {
                  setProfileUrl(`https://snapfix.bg${json.data.url}`);
                  setForm({ ...form, profileImageUrl: `https://snapfix.bg${json.data.url}` });
                } else {
                  Alert.alert('Грешка', 'Качването неуспешно');
                }
              });
            } catch (e) {
              Alert.alert('Грешка', 'Качването неуспешно');
            }
          }}>
            <Text style={styles.headerActionText}>Качи снимка</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Основна информация</Text>
        <Field label="Име на бизнес" value={form.businessName} onChangeText={(t: string) => setForm({ ...form, businessName: t })} />
        <Text style={styles.label}>Категория бизнес</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={form.serviceCategory}
            onValueChange={(val: string) => setForm({ ...form, serviceCategory: val })}
          >
            <Picker.Item label="Изберете категория" value="" />
            {categories.map(c => (
              <Picker.Item key={c.id} label={c.name} value={c.id} />
            ))}
          </Picker>
        </View>
        <Field label="Описание" value={form.description} onChangeText={(t: string) => setForm({ ...form, description: t })} multiline />
        <Field label="Години опит" value={form.experienceYears} onChangeText={(t: string) => setForm({ ...form, experienceYears: t })} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Локация</Text>
        <View style={styles.row}>
          <View style={styles.col}>
            <Field label="Град" value={form.city} onChangeText={(t: string) => setForm({ ...form, city: t })} />
          </View>
          <View style={styles.col}>
            <Field label="Квартал" value={form.neighborhood} onChangeText={(t: string) => setForm({ ...form, neighborhood: t })} />
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Контакти</Text>
        <Field label="Телефон" value={form.phoneNumber} onChangeText={(t: string) => setForm({ ...form, phoneNumber: t })} />
        <Field label="Имейл" value={form.email} onChangeText={(t: string) => setForm({ ...form, email: t })} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Галерия</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          {galleryUrls.map((u, i) => (
            <Image key={i} source={{ uri: u }} style={styles.galleryImage} />
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.secondaryButton} onPress={async () => {
          try {
            const me = await ApiService.getInstance().getCurrentUser();
            const userId = (me.data as any)?.user?.id || (me.data as any)?.id || 'public';
            Alert.prompt?.('Поставете base64 изображение', undefined, async (base64) => {
              if (!base64) return;
              const res = await fetch('https://snapfix.bg/api/v1/uploads/image', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, filename: `gallery_${Date.now()}.jpg`, data: base64 })
              });
              const json = await res.json() as any;
              if (json.success) {
                const url = `https://snapfix.bg${json.data.url}`;
                setGalleryUrls(prev => [...prev, url]);
              } else {
                Alert.alert('Грешка', 'Качването неуспешно');
              }
            });
          } catch (e) {
            Alert.alert('Грешка', 'Качването неуспешно');
          }
        }}>
          <Text style={styles.secondaryButtonText}>Добави снимка към галерия</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Сертификати</Text>
        <Field label="Списък (по едно заглавие на ред)" value={certificates} onChangeText={setCertificates} multiline />
      </View>

      <TouchableOpacity style={[styles.saveFab, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveFabText}>{saving ? 'Запазване...' : 'Запази промените'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F9FC', padding: 16 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  headerCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  headerSubtitle: { fontSize: 13, color: '#6b7280' },
  headerAction: { backgroundColor: '#eef3ff', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  headerActionText: { color: '#2c5cff', fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8, color: '#111827' },
  field: { marginBottom: 12 },
  label: { fontSize: 14, color: '#555', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, color: '#000' },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  pickerWrapper: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, overflow: 'hidden', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },
  button: { backgroundColor: '#2E7D32', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryButton: { backgroundColor: '#eef3ff', borderRadius: 8, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#c9d7ff', marginBottom: 8 },
  secondaryButtonText: { color: '#2c5cff', fontSize: 14, fontWeight: '600' },
  avatar: { width: 96, height: 96, borderRadius: 48, marginBottom: 8, backgroundColor: '#eee' },
  avatarLarge: { width: 64, height: 64, borderRadius: 32 },
  galleryImage: { width: 96, height: 96, borderRadius: 8, marginRight: 8, backgroundColor: '#eee' },
  saveFab: { backgroundColor: '#2E7D32', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8, marginBottom: 24 },
  saveFabText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});


