import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { fetchAllMedicines, fetchInventoryCounts } from '../db';
import { MedicineEntry } from '../types';
import { formatCurrency, getExpiryStatus, getStatusBadgeText, primaryColor } from '../utils';

const statusColors = {
  expired: '#dc2626',
  warning: '#f59e0b',
  ok: '#16a34a',
};

export default function InventoryScreen() {
  const isFocused = useIsFocused();
  const [medicines, setMedicines] = useState<MedicineEntry[]>([]);
  const [search, setSearch] = useState('');
  const [showExpiring, setShowExpiring] = useState(false);
  const [showLowStock, setShowLowStock] = useState(false);
  const [counts, setCounts] = useState({ total: 0, expiring30: 0, expired: 0, lowStock: 0 });

  useEffect(() => {
    if (!isFocused) return;
    fetchAllMedicines().then(setMedicines).catch(console.error);
    fetchInventoryCounts().then(setCounts).catch(console.error);
  }, [isFocused]);

  const filtered = useMemo(() => {
    return medicines.filter(item => {
      const lower = search.trim().toLowerCase();
      const matchesSearch =
        !lower ||
        item.name.toLowerCase().includes(lower) ||
        item.batch.toLowerCase().includes(lower) ||
        item.mfg.toLowerCase().includes(lower);
      if (!matchesSearch) return false;

      const expiryStatus = getExpiryStatus(item.expiry);
      const expiryDate = new Date(item.expiry ? `${item.expiry.split('/')[1]}-${item.expiry.split('/')[0]}-01` : '');
      const today = new Date();
      const lastDay = new Date(expiryDate.getFullYear(), expiryDate.getMonth() + 1, 0);
      const isExpiringWithin30 = lastDay >= today && lastDay <= new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

      if (showExpiring && !isExpiringWithin30) return false;
      if (showLowStock && item.low_stock !== 1) return false;
      return true;
    });
  }, [medicines, search, showExpiring, showLowStock]);

  const renderCard = (label: string, value: number) => (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.statsRow}>
        {renderCard('Total medicines', counts.total)}
        {renderCard('Expiring <30d', counts.expiring30)}
      </View>
      <View style={styles.statsRow}>
        {renderCard('Already expired', counts.expired)}
        {renderCard('Low stock', counts.lowStock)}
      </View>
      <View style={styles.searchRow}>
        <TextInput
          placeholder="Search by name, batch or manufacturer"
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
        />
      </View>
      <View style={styles.filterRow}>
        <Pressable style={[styles.filterButton, showExpiring && styles.filterButtonActive]} onPress={() => setShowExpiring(prev => !prev)}>
          <Text style={[styles.filterText, showExpiring && styles.filterTextActive]}>Expiring</Text>
        </Pressable>
        <Pressable style={[styles.filterButton, showLowStock && styles.filterButtonActive]} onPress={() => setShowLowStock(prev => !prev)}>
          <Text style={[styles.filterText, showLowStock && styles.filterTextActive]}>Low Stock</Text>
        </Pressable>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No medicines found.</Text>}
        renderItem={({ item }) => {
          const status = getExpiryStatus(item.expiry);
          return (
            <View style={styles.itemCard}>
              <View style={styles.itemRow}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={[styles.badge, { backgroundColor: statusColors[status] }]}>{getStatusBadgeText(status)}</Text>
              </View>
              <Text style={styles.itemDetail}>Batch: {item.batch || '--'}</Text>
              <View style={styles.rowGroup}>
                <Text style={[styles.itemDetail, item.qty < 20 ? styles.lowQty : null]}>Qty: {item.qty}</Text>
                <Text style={styles.itemDetail}>MRP: {formatCurrency(item.mrp)}</Text>
              </View>
              <View style={styles.rowGroup}>
                <Text style={styles.itemDetail}>
                  Rate: {formatCurrency(item.rate)}{item.rate_changed === 1 ? ' ↑' : ''}
                </Text>
                <Text style={styles.itemDetail}>Expiry: {item.expiry || '--'}</Text>
              </View>
              <Text style={styles.itemDetail}>Mfg: {item.mfg || '--'}</Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9f5', padding: 16 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 16, marginHorizontal: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  statValue: { fontSize: 24, fontWeight: '700', color: primaryColor },
  statLabel: { color: '#6b7280', marginTop: 6 },
  searchRow: { marginBottom: 12 },
  searchInput: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: '#e5e7eb', color: '#111827' },
  filterRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  filterButton: { flex: 1, backgroundColor: '#fff', borderRadius: 999, paddingVertical: 10, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center' },
  filterButtonActive: { backgroundColor: primaryColor, borderColor: primaryColor },
  filterText: { color: '#374151', fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  listContent: { paddingBottom: 24 },
  itemCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, elevation: 1 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  itemName: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 1, marginRight: 8 },
  badge: { color: '#fff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, fontSize: 12, overflow: 'hidden' },
  itemDetail: { color: '#475569' },
  lowQty: { color: '#dc2626', fontWeight: '700' },
  rowGroup: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  emptyText: { marginTop: 24, textAlign: 'center', color: '#64748b' },
});
