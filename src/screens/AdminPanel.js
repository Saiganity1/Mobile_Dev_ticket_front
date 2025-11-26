import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Alert, ToastAndroid, Platform } from 'react-native';
import Loading from '../components/Loading';
import styles, { PillToggle, global, colors } from '../styles';
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
  const mapped = sorted.map(t => ({ uid: t.uid, ticket_number: t.ticket_number || t.id, title: t.title, first_name: t.first_name, last_name: t.last_name, unread_count: t.unread_count || 0, created_at: t.created_at, last_message: (t.messages && t.messages.length) ? t.messages[t.messages.length-1].content : '', is_open: t.is_open }));
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
  const mapped = sorted.map(t => ({ uid: t.uid, ticket_number: t.ticket_number || t.id, title: t.title, first_name: t.first_name, last_name: t.last_name, unread_count: t.unread_count || 0, created_at: t.created_at, last_message: (t.messages && t.messages.length) ? t.messages[t.messages.length-1].content : '', is_open: t.is_open, closed_by: t.closed_by, closed_at: t.closed_at }));
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
    <View style={global.container}>
      <Text style={global.header}>Admin - Tickets</Text>
      <View style={{ marginTop: 8, marginBottom: 8 }}>
        <PillToggle options={[{ value: 'not_complete', label: 'Not Complete' }, { value: 'all', label: 'All' }, { value: 'completed', label: 'Completed' }]} value={filter} onChange={setFilter} />
  {loading ? <Loading text="Loading..." /> : null}
      </View>
      {debug.me && <Text style={global.smallText}>Logged as: {debug.me.username} (staff: {String(debug.me.is_staff)})</Text>}

      <View style={{ marginVertical: 8 }}>
        <TouchableOpacity onPress={load} style={{ alignSelf: 'flex-start', paddingVertical: 6 }}>
          <Text style={{ color: colors.primary }}>Refresh</Text>
        </TouchableOpacity>
        <Text style={global.smallText}>Pending: {debug.pendingCount} | All: {debug.allCount}</Text>
      </View>

      <FlatList data={tickets} keyExtractor={(t) => String(t.uid)} renderItem={({ item }) => (
        <View style={global.card}>
            <TouchableOpacity onPress={() => navigation.navigate('Chat', { ticketUid: item.uid })}>
            <Text style={{ fontWeight: '700' }}>#{item.ticket_number} {item.title} {item.unread_count ? `(${item.unread_count} new)` : ''}</Text>
            <Text style={global.subText}>{item.first_name} {item.last_name}</Text>
            <Text style={{ color: '#555' }}>{item.last_message}</Text>
            <Text style={global.smallText}>{item.created_at}</Text>
            {!item.is_open && <Text style={{ color: colors.success, fontWeight: 'bold' }}>Completed</Text>}
            {item.closed_by ? <Text style={global.smallText}>Closed by: {item.closed_by} at {formatTimestamp(item.closed_at)}</Text> : null}
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            <TouchableOpacity onPress={() => doAction(item.uid, item.is_open ? 'close' : 'reopen')} style={{ marginRight: 8 }}>
              <Text style={{ color: colors.primary }}>{item.is_open ? 'Mark Complete' : 'Reopen'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={async () => { const id = await AsyncStorage.getItem('userId'); doAction(item.uid, 'assign', id); }}>
              <Text style={{ color: colors.primary }}>Assign to me</Text>
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: 8 }}>
            <TextInput value={replyMap[item.uid] || ''} onChangeText={(v) => setReplyMap(m => ({ ...m, [item.uid]: v }))} placeholder="Write reply..." style={global.input} />
            <TouchableOpacity onPress={() => sendReply(item.uid)} style={global.button}>
              <Text style={global.buttonText}>Send Reply</Text>
            </TouchableOpacity>
          </View>
        </View>
      )} />
    </View>
  );
}
