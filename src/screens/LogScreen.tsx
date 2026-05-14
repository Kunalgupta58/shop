import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { fetchChangeLog } from '../db';
import { ChangeLogRow } from '../types';
import { formatTimestamp, primaryColor } from '../utils';

const borderColors: Record<string, string> = {
  new: '#2563eb',
  qty_add: '#2563eb',
  rate_update: '#16a34a',
  low_stock: '#f59e0b',
  rate_lower: '#f59e0b',
};

export default function LogScreen() {
  const [logs, setLogs] = useState<ChangeLogRow[]>([]);

  useEffect(() => {
    fetchChangeLog().then(setLogs).catch(console.error);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>Change Log</Text>
        <Text style={styles.headerSubtitle}>{logs.length} events</Text>
      </View>
      <FlatList
        data={logs}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No log events yet.</Text>}
        renderItem={({ item }) => (
          <View style={[styles.logCard, { borderLeftColor: borderColors[item.event_type] ?? primaryColor }]}>            
            <Text style={styles.logName}>{item.medicine_name}</Text>
            <Text style={styles.logMessage}>{item.message}</Text>
            <View style={styles.logMetaRow}>
              <Text style={styles.logMeta}>Old: {item.old_value || '--'}</Text>
              <Text style={styles.logMeta}>New: {item.new_value || '--'}</Text>
            </View>
            <Text style={styles.logTimestamp}>{formatTimestamp(item.timestamp)}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9f5', padding: 16 },
  headerCard: { padding: 18, backgroundColor: '#fff', borderRadius: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#111827' },
  headerSubtitle: { marginTop: 4, color: '#6b7280' },
  listContent: { paddingBottom: 24 },
  logCard: { backgroundColor: '#fff', borderLeftWidth: 5, borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, elevation: 1 },
  logName: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 6 },
  logMessage: { color: '#374151', marginBottom: 10 },
  logMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  logMeta: { color: '#6b7280', fontSize: 13 },
  logTimestamp: { color: '#9ca3af', fontSize: 13 },
  emptyText: { marginTop: 24, textAlign: 'center', color: '#64748b' },
});
