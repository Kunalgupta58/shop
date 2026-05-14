import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { queryMedicines } from '../db';
import { MedicineEntry, QueryFilter } from '../types';
import { formatCurrency, getExpiryStatus, getStatusBadgeText, primaryColor } from '../utils';

const chips: { label: string; value: QueryFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Expiring 7d', value: 'expiring7' },
  { label: 'Expiring 30d', value: 'expiring30' },
  { label: 'Expiring 90d', value: 'expiring90' },
  { label: 'Already Expired', value: 'expired' },
  { label: 'Low stock', value: 'low_stock' },
  { label: 'Rate increased', value: 'rate_changed' },
];

const statusColors = {
  expired: '#dc2626',
  warning: '#f59e0b',
  ok: '#16a34a',
};

export default function QueryScreen() {
  const [filter, setFilter] = useState<QueryFilter>('all');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<MedicineEntry[]>([]);

  const loadResults = async () => {
    const list = await queryMedicines(filter, search);
    setResults(list);
  };

  useEffect(() => {
    loadResults().catch(console.error);
  }, [filter, search]);

  return (
    <View style={styles.container}>
      <View style={styles.chipRow}>
        {chips.map(chip => {
          const active = chip.value === filter;
          return (
            <Pressable
              key={chip.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setFilter(chip.value)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        placeholder="Search name, batch or manufacturer"
        style={styles.searchInput}
        value={search}
        onChangeText={setSearch}
      />
      <FlatList
        data={results}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No results for this query.</Text>}
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
                <Text style={styles.itemDetail}>Qty: {item.qty}</Text>
                <Text style={styles.itemDetail}>MRP: {formatCurrency(item.mrp)}</Text>
              </View>
              <View style={styles.rowGroup}>
                <Text style={styles.itemDetail}>Rate: {formatCurrency(item.rate)}</Text>
                <Text style={styles.itemDetail}>Expiry: {item.expiry || '--'}</Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9f5', padding: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  chip: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, marginBottom: 8 },
  chipActive: { backgroundColor: primaryColor, borderColor: primaryColor },
  chipText: { color: '#374151', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  searchInput: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 12, color: '#111827' },
  listContent: { paddingBottom: 24 },
  itemCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, elevation: 1 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  itemName: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 1, marginRight: 8 },
  badge: { color: '#fff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, fontSize: 12, overflow: 'hidden' },
  itemDetail: { color: '#475569' },
  rowGroup: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  emptyText: { marginTop: 24, textAlign: 'center', color: '#64748b' },
});
