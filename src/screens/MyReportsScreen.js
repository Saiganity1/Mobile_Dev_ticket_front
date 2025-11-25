import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Button, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const API_BASE = Platform.OS === 'web'
  ? `http://${window.location.hostname}:8000/api`
  : 'http://10.0.2.2:8000/api';

export default function MyReportsScreen({ navigation }) {
  const [tickets, setTickets] = useState([]);
  const [nextPage, setNextPage] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadPage = async (url) => {
    setLoading(true);
    const token = await AsyncStorage.getItem('authToken');
    try {
      // If no url provided, fetch and aggregate all paginated pages so the user sees all reports.
      if (!url) {
        let pageUrl = `${API_BASE}/tickets/my/`;
        let aggregated = [];
        while (pageUrl) {
          const res = await fetch(pageUrl, { headers: token ? { Authorization: `Token ${token}` } : {} });
          if (!res.ok) break;
          const data = await res.json();
          const list = data.results || data;
          aggregated = aggregated.concat(list);
          // follow DRF pagination 'next' link (or stop if API is not paginated)
          pageUrl = data.next || null;
        }
        setTickets(aggregated);
        setNextPage(null);
      } else {
        const res = await fetch(url, { headers: token ? { Authorization: `Token ${token}` } : {} });
        if (res.ok) {
          const data = await res.json();
          const list = data.results || data;
          setTickets(prev => url ? [...prev, ...list] : list);
          setNextPage(data.next);
        }
      }
    } catch (e) {
      console.log('Failed load my reports', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPage(); }, []);

  return (
    <View style={{ flex: 1, padding: 12 }}>
      <Text style={{ fontWeight: 'bold', fontSize: 18 }}>My Reports</Text>
      {tickets.length === 0 && <Text>No reports yet</Text>}
      <FlatList data={tickets} keyExtractor={(t) => String(t.uid)} renderItem={({ item }) => (
        <TouchableOpacity onPress={() => navigation.navigate('Chat', { ticketUid: item.uid })} style={{ padding: 8, borderBottomWidth: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontWeight: 'bold' }}>{item.title} {item.unread_count ? `(${item.unread_count} new)` : ''}</Text>
            {!item.is_open && <Text style={{ color: 'green', fontWeight: 'bold' }}>Completed</Text>}
          </View>
          <Text>{item.first_name} {item.last_name}</Text>
        </TouchableOpacity>
      )} />
      {nextPage && <Button title={loading ? 'Loading...' : 'Load more'} onPress={() => loadPage(nextPage)} disabled={loading} />}
    </View>
  );
}
