import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Alert, ToastAndroid, Platform, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = Platform.OS === 'web' ? `http://${window.location.hostname}:8000/api` : 'http://10.0.2.2:8000/api';

export default function AdminPanel({ navigation }) {
  const [tickets, setTickets] = useState([]);
  const [replyMap, setReplyMap] = useState({});
  const [filter, setFilter] = useState('not_complete'); // 'all' | 'not_complete' | 'completed'
  const [debug, setDebug] = useState({ token: false, me: null, pendingCount: 0, allCount: 0, pendingBody: null, allBody: null });
  const [loading, setLoading] = useState(false);

  const formatTimestamp = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch (e) {
      return iso;
    }
  };

  const load = async (which = filter) => {
    const token = await AsyncStorage.getItem('authToken');
    if (!token) {
      Alert.alert('Not authenticated', 'No auth token found. Please login in the app.');
      navigation.replace('Login');
      return;
    }
    const headers = { Authorization: `Token ${token}` };

    // check user info
    try {
      const who = await fetch(`${API_BASE}/auth/me/`, { headers });
      if (who.ok) {
        const info = await who.json();
        setDebug(d => ({ ...d, token: true, me: info }));
        if (!info.is_staff && !info.is_superuser) {
          Alert.alert('Not admin', 'Your account is not marked as staff/admin on the server. Please mark it as staff in Django admin.');
          return; // don't load tickets
        }
      }
    } catch (e) {
      console.log('me check failed', e);
    }

    try {
      setLoading(true);
      if (which === 'not_complete') {
        const res = await fetch(`${API_BASE}/admin/tickets/pending/`, { headers });
        const bodyText = await res.text();
        let pendingData = [];
        try { pendingData = JSON.parse(bodyText); } catch (e) { pendingData = []; }
        setDebug(d => ({ ...d, pendingCount: Array.isArray(pendingData) ? pendingData.length : 0, pendingBody: bodyText }));
        if (res.status === 401 || res.status === 403) {
          Alert.alert('Not authorized', 'You need admin credentials to view tickets');
          setLoading(false);
          return;
        }
        const list = Array.isArray(pendingData) ? pendingData : [];
        const sorted = list.sort((a,b) => (b.unread_count || 0) - (a.unread_count || 0));
        const mapped = sorted.map(t => ({ uid: t.uid, title: t.title, first_name: t.first_name, last_name: t.last_name, unread_count: t.unread_count || 0, created_at: t.created_at, last_message: (t.messages && t.messages.length) ? t.messages[t.messages.length-1].content : '', is_open: t.is_open }));
        setTickets(mapped);
        setLoading(false);
        return;
      }

      // for 'all' and 'completed' fetch all and filter client-side
  const resAll = await fetch(`${API_BASE}/admin/tickets/`, { headers });
      const allText = await resAll.text();
      let allData = [];
      try { allData = JSON.parse(allText); } catch (e) { allData = []; }
      setDebug(d => ({ ...d, allCount: Array.isArray(allData) ? allData.length : 0, allBody: allText }));
      if (resAll.status === 401 || resAll.status === 403) {
        Alert.alert('Not authorized', 'You need admin credentials to view tickets');
        return;
      }
      const list = Array.isArray(allData) ? allData : [];
      const filtered = which === 'completed' ? list.filter(t => t.is_open === false) : list;
      const sorted = filtered.sort((a,b) => (b.unread_count || 0) - (a.unread_count || 0));
      const mapped = sorted.map(t => ({ uid: t.uid, title: t.title, first_name: t.first_name, last_name: t.last_name, unread_count: t.unread_count || 0, created_at: t.created_at, last_message: (t.messages && t.messages.length) ? t.messages[t.messages.length-1].content : '', is_open: t.is_open, closed_by: t.closed_by, closed_at: t.closed_at }));
  setTickets(mapped);
  setLoading(false);
  return;
    } catch (e) {
      console.log('admin tickets fetch failed', e);
  setLoading(false);
  Alert.alert('Failed to load admin tickets');
    }
  };

  useEffect(() => { load(filter); }, [filter]);

  const sendReply = async (ticketUid) => {
    const content = replyMap[ticketUid] || '';
    if (!content) return;
    const token = await AsyncStorage.getItem('authToken');
    const res = await fetch(`${API_BASE}/messages/create/`, {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'}, token ? { Authorization: `Token ${token}` } : {}),
      body: JSON.stringify({ ticket_uid: ticketUid, sender: 'admin', content }),
    });
    if (res.ok) {
      setReplyMap(m => ({ ...m, [ticketUid]: '' }));
      load();
      Alert.alert('Reply sent');
    } else {
      Alert.alert('Reply failed');
    }
  };

  const doAction = async (ticketUid, action, assign_user_id, confirmed = false) => {
    if (action === 'close' && !confirmed) {
      // confirmation dialog; call doAction again with confirmed=true if accepted
      Alert.alert('Confirm', 'Mark this ticket as completed? Users will be unable to send further messages.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, close', onPress: () => doAction(ticketUid, action, assign_user_id, true) }
      ]);
      return;
    }
    const token = await AsyncStorage.getItem('authToken');
    const body = { action };
    if (assign_user_id) body.assign_user_id = assign_user_id;
    const res = await fetch(`${API_BASE}/admin/tickets/${ticketUid}/action/`, {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'}, token ? { Authorization: `Token ${token}` } : {}),
      body: JSON.stringify(body),
    });
    if (res.ok) {
      if (Platform.OS === 'android') ToastAndroid.show('Action performed', ToastAndroid.SHORT);
      else Alert.alert('Success', 'Action performed');
      load();
    } else {
      if (Platform.OS === 'android') ToastAndroid.show('Action failed', ToastAndroid.SHORT);
      else Alert.alert('Error', 'Action failed');
    }
  };

  return (
    <View style={{ flex: 1, padding: 12 }}>
      <Text style={{ fontWeight: 'bold', fontSize: 18 }}>Admin - Tickets</Text>
      <View style={{ flexDirection: 'row', marginTop: 8, marginBottom: 8, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', backgroundColor: '#eef', borderRadius: 20, padding: 4 }}>
          {['not_complete','all','completed'].map(k => (
            <TouchableOpacity key={k} onPress={() => setFilter(k)} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: filter === k ? '#007bff' : 'transparent', marginRight: 6 }}>
              <Text style={{ color: filter === k ? '#fff' : '#007bff', fontWeight: '600' }}>{k === 'not_complete' ? 'Not Complete' : (k === 'completed' ? 'Completed' : 'All')}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ width: 12 }} />
        {loading ? <ActivityIndicator size="small" /> : null}
      </View>
      {debug.me && <Text style={{ fontSize: 12, color: '#666' }}>Logged as: {debug.me.username} (staff: {String(debug.me.is_staff)})</Text>}
      <View style={{ marginVertical: 8 }}>
        <Button title="Refresh" onPress={load} />
        <Text style={{ fontSize: 12, color: '#666' }}>Pending: {debug.pendingCount} | All: {debug.allCount}</Text>
        {debug.pendingBody ? <Text numberOfLines={3} selectable style={{ fontSize: 11, color: '#999' }}>Pending raw: {debug.pendingBody}</Text> : null}
        {debug.allBody ? <Text numberOfLines={3} selectable style={{ fontSize: 11, color: '#999' }}>All raw: {debug.allBody}</Text> : null}
      </View>
      <FlatList data={tickets} keyExtractor={(t) => String(t.uid)} renderItem={({ item }) => (
        <View style={{ padding: 8, borderBottomWidth: 1 }}>
            <TouchableOpacity onPress={() => navigation.navigate('Chat', { ticketUid: item.uid })}>
            <Text style={{ fontWeight: 'bold' }}>{item.title} {item.unread_count ? `(${item.unread_count} new)` : ''}</Text>
            <Text>{item.first_name} {item.last_name}</Text>
            <Text style={{ color: '#555' }}>{item.last_message}</Text>
            <Text style={{ color: '#999', fontSize: 12 }}>{item.created_at}</Text>
            {!item.is_open && <Text style={{ color: 'green', fontWeight: 'bold' }}>Completed</Text>}
            {item.closed_by ? <Text style={{ fontSize: 12, color: '#666' }}>Closed by: {item.closed_by} at {formatTimestamp(item.closed_at)}</Text> : null}
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            <Button title={item.is_open ? 'Mark Complete' : 'Reopen'} onPress={() => doAction(item.uid, item.is_open ? 'close' : 'reopen')} />
            <View style={{ width: 8 }} />
            <Button title="Assign to me" onPress={async () => { const id = await AsyncStorage.getItem('userId'); doAction(item.uid, 'assign', id); }} />
          </View>

          <View style={{ marginTop: 8 }}>
            <TextInput value={replyMap[item.uid] || ''} onChangeText={(v) => setReplyMap(m => ({ ...m, [item.uid]: v }))} placeholder="Write reply..." style={{ borderWidth: 1, marginBottom: 8 }} />
            <Button title="Send Reply" onPress={() => sendReply(item.uid)} />
          </View>
        </View>
      )} />
    </View>
  );
}
