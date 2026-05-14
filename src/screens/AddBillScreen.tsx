import React, { useState } from 'react';
import { Alert, FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import { hasAnthropicApiKey, parseBillImageAsync } from '../ai';
import { MedicineEntry } from '../types';
import { saveMedicine } from '../db';
import { formatCurrency, primaryColor, parseFloatSafe, parseIntSafe } from '../utils';

const defaultRow: MedicineEntry = {
  name: '',
  batch: '',
  qty: 0,
  mrp: 0,
  rate: 0,
  expiry: '',
  mfg: '',
  hsn: '',
};

export default function AddBillScreen() {
  const [uploading, setUploading] = useState(false);
  const [rows, setRows] = useState<MedicineEntry[]>([]);
  const [manualEntry, setManualEntry] = useState<MedicineEntry>(defaultRow);
  const [toast, setToast] = useState<string>('');
  const anthropicEnabled = hasAnthropicApiKey();

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
    if (Platform.OS === 'android') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ToastAndroid = require('react-native').ToastAndroid;
      ToastAndroid.show(message, ToastAndroid.SHORT);
    }
  };

  const handleImageResult = async (result: ImagePicker.ImagePickerResult) => {
    if (result.cancelled) return;
    const imageInfo = result as ImagePicker.ImageInfo;
    if (!imageInfo.base64) {
      Alert.alert('Image Error', 'Unable to read image data.');
      return;
    }
    setUploading(true);
    try {
      const parsed = await parseBillImageAsync(imageInfo.base64);
      const normalized = parsed.map((item: any) => ({
        name: item.name ?? '',
        batch: item.batch ?? '',
        qty: parseIntSafe(String(item.qty)),
        mrp: parseFloatSafe(String(item.mrp)),
        rate: parseFloatSafe(String(item.rate)),
        expiry: item.expiry ?? '',
        mfg: item.mfg ?? '',
        hsn: '',
      }));
      setRows(normalized);
    } catch (error: any) {
      Alert.alert('AI Extraction Failed', error.message || 'Unable to parse bill image.');
    } finally {
      setUploading(false);
    }
  };

  const pickImage = async () => {
    if (!anthropicEnabled) {
      Alert.alert('API key required', 'Bill image parsing requires ANTHROPIC_API_KEY. Use manual entry instead.');
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Camera roll permission is required to upload bill images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7, allowsEditing: false });
    await handleImageResult(result);
  };

  const takePhoto = async () => {
    if (!anthropicEnabled) {
      Alert.alert('API key required', 'Bill image parsing requires ANTHROPIC_API_KEY. Use manual entry instead.');
      return;
    }
    const permission = await Camera.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Camera permission is required to scan bill images.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7, allowsEditing: false });
    await handleImageResult(result);
  };

  const updateRow = (index: number, key: keyof MedicineEntry, value: string) => {
    setRows(current => {
      const updated = [...current];
      const row = { ...updated[index] };
      if (key === 'qty') row.qty = parseIntSafe(value);
      else if (key === 'mrp' || key === 'rate') row[key] = parseFloatSafe(value);
      else row[key] = value;
      updated[index] = row;
      return updated;
    });
  };

  const saveParsedRows = async () => {
    if (!rows.length) {
      Alert.alert('No rows', 'Please upload a bill image and parse medicine items first.');
      return;
    }

    for (const row of rows) {
      if (!row.name || !row.qty || !row.mrp || !row.rate) {
        Alert.alert('Validation', 'All parsed rows must include name, qty, mrp, and rate.');
        return;
      }
    }

    setUploading(true);
    try {
      for (const row of rows) {
        const result = await saveMedicine(row);
        showToast(result.message);
      }
      setRows([]);
    } catch (error: any) {
      Alert.alert('Save Failed', error.message || 'Unable to save parsed medicines.');
    } finally {
      setUploading(false);
    }
  };

  const saveManualEntry = async () => {
    if (!manualEntry.name.trim() || !manualEntry.qty || !manualEntry.mrp || !manualEntry.rate) {
      Alert.alert('Validation error', 'Please enter medicine name, quantity, MRP, and rate.');
      return;
    }
    try {
      const result = await saveMedicine(manualEntry);
      showToast(result.message);
      setManualEntry(defaultRow);
    } catch (error: any) {
      Alert.alert('Save Failed', error.message || 'Unable to save medicine.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.uploadCard}>
        <Text style={styles.sectionTitle}>Upload bill image</Text>
        <Pressable style={[styles.uploadDropzone, !anthropicEnabled && styles.disabledZone]} onPress={pickImage} disabled={!anthropicEnabled}>
          <Text style={styles.uploadTitle}>Tap to upload bill</Text>
          <Text style={styles.uploadHint}>Supports photo library or camera</Text>
        </Pressable>
        <Pressable style={[styles.cameraButton, !anthropicEnabled && styles.disabledButton]} onPress={takePhoto} disabled={!anthropicEnabled}>
          <Text style={styles.cameraButtonText}>Use Camera</Text>
        </Pressable>
        {!anthropicEnabled ? (
          <Text style={styles.warningText}>No Anthropic key found. Manual entry is available.</Text>
        ) : uploading ? (
          <Text style={styles.loadingText}>Working on the bill...</Text>
        ) : null}
      </View>

      {rows.length > 0 && (
        <View style={styles.tableCard}>
          <Text style={styles.sectionTitle}>Parsed items</Text>
          <FlatList
            data={rows}
            keyExtractor={(_, index) => String(index)}
            renderItem={({ item, index }) => (
              <View style={styles.parsedRow}>
                <TextInput
                  style={styles.input}
                  placeholder="Name"
                  value={item.name}
                  onChangeText={value => updateRow(index, 'name', value)}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Batch"
                  value={item.batch}
                  onChangeText={value => updateRow(index, 'batch', value)}
                />
                <View style={styles.rowGroup}>
                  <TextInput
                    style={[styles.input, styles.smallInput]}
                    placeholder="Qty"
                    keyboardType="numeric"
                    value={String(item.qty)}
                    onChangeText={value => updateRow(index, 'qty', value)}
                  />
                  <TextInput
                    style={[styles.input, styles.smallInput]}
                    placeholder="MRP"
                    keyboardType="decimal-pad"
                    value={item.mrp ? String(item.mrp) : ''}
                    onChangeText={value => updateRow(index, 'mrp', value)}
                  />
                  <TextInput
                    style={[styles.input, styles.smallInput]}
                    placeholder="Rate"
                    keyboardType="decimal-pad"
                    value={item.rate ? String(item.rate) : ''}
                    onChangeText={value => updateRow(index, 'rate', value)}
                  />
                </View>
                <View style={styles.rowGroup}>
                  <TextInput
                    style={[styles.input, styles.smallInput]}
                    placeholder="Expiry MM/YYYY"
                    value={item.expiry}
                    onChangeText={value => updateRow(index, 'expiry', value)}
                  />
                  <TextInput
                    style={[styles.input, styles.smallInput]}
                    placeholder="Mfg"
                    value={item.mfg}
                    onChangeText={value => updateRow(index, 'mfg', value)}
                  />
                </View>
              </View>
            )}
          />
          <Pressable style={styles.primaryButton} onPress={saveParsedRows}>
            <Text style={styles.primaryButtonText}>Confirm & Save</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>Manual entry</Text>
        <TextInput
          style={styles.input}
          placeholder="Medicine name"
          value={manualEntry.name}
          onChangeText={value => setManualEntry(prev => ({ ...prev, name: value }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Batch number"
          value={manualEntry.batch}
          onChangeText={value => setManualEntry(prev => ({ ...prev, batch: value }))}
        />
        <View style={styles.rowGroup}>
          <TextInput
            style={[styles.input, styles.smallInput]}
            placeholder="Quantity"
            keyboardType="numeric"
            value={manualEntry.qty ? String(manualEntry.qty) : ''}
            onChangeText={value => setManualEntry(prev => ({ ...prev, qty: parseIntSafe(value) }))}
          />
          <TextInput
            style={[styles.input, styles.smallInput]}
            placeholder="MRP"
            keyboardType="decimal-pad"
            value={manualEntry.mrp ? String(manualEntry.mrp) : ''}
            onChangeText={value => setManualEntry(prev => ({ ...prev, mrp: parseFloatSafe(value) }))}
          />
          <TextInput
            style={[styles.input, styles.smallInput]}
            placeholder="Rate"
            keyboardType="decimal-pad"
            value={manualEntry.rate ? String(manualEntry.rate) : ''}
            onChangeText={value => setManualEntry(prev => ({ ...prev, rate: parseFloatSafe(value) }))}
          />
        </View>
        <TextInput
          style={styles.input}
          placeholder="Expiry MM/YYYY"
          value={manualEntry.expiry}
          onChangeText={value => setManualEntry(prev => ({ ...prev, expiry: value }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Manufacturer"
          value={manualEntry.mfg}
          onChangeText={value => setManualEntry(prev => ({ ...prev, mfg: value }))}
        />
        <TextInput
          style={styles.input}
          placeholder="HSN code"
          value={manualEntry.hsn}
          onChangeText={value => setManualEntry(prev => ({ ...prev, hsn: value }))}
        />
        <Pressable style={styles.primaryButton} onPress={saveManualEntry}>
          <Text style={styles.primaryButtonText}>Save manual entry</Text>
        </Pressable>
      </View>
      {toast ? <View style={styles.toast}><Text style={styles.toastText}>{toast}</Text></View> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9f5' },
  content: { padding: 16, paddingBottom: 24 },
  uploadCard: { marginBottom: 16, padding: 16, backgroundColor: '#fff', borderRadius: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 },
  uploadDropzone: { minHeight: 160, borderWidth: 2, borderColor: '#d1d5db', borderStyle: 'dashed', borderRadius: 14, justifyContent: 'center', alignItems: 'center', padding: 12, backgroundColor: '#f8fafc' },
  uploadTitle: { fontSize: 16, fontWeight: '600', color: '#0F6E56' },
  uploadHint: { color: '#6b7280', marginTop: 4, textAlign: 'center' },
  cameraButton: { marginTop: 12, backgroundColor: primaryColor, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  disabledButton: { backgroundColor: '#94a3b8' },
  cameraButtonText: { color: '#fff', fontWeight: '700' },
  loadingText: { marginTop: 12, textAlign: 'center', color: '#475569' },
  disabledZone: { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' },
  warningText: { marginTop: 12, color: '#b45309', textAlign: 'center' },
  tableCard: { marginBottom: 16, padding: 16, backgroundColor: '#fff', borderRadius: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  parsedRow: { marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingBottom: 12 },
  input: { backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, color: '#111827' },
  rowGroup: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  smallInput: { flex: 1, marginRight: 8 },
  primaryButton: { marginTop: 8, backgroundColor: primaryColor, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  formCard: { marginBottom: 24, padding: 16, backgroundColor: '#fff', borderRadius: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  toast: { position: 'absolute', bottom: 24, left: 16, right: 16, backgroundColor: '#111827', padding: 12, borderRadius: 12, alignItems: 'center' },
  toastText: { color: '#fff', fontWeight: '600' },
});
