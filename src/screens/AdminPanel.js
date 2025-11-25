import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Button, TouchableOpacity, TextInput, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const API_BASE = Platform.OS === 'web' ? `http://${window.location.hostname}:8000/api` : 'http://10.0.2.2:8000/api';

export default function AdminPanel({ navigation }) {
  const [tickets, setTickets] = useState([]);
  const [replyMap, setReplyMap] = useState({});
  const [debug, setDebug] = useState({ token: false, me: null, pendingCount: 0, allCount: 0, pendingBody: null, allBody: null });

  const load = async () => {
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

    // try pending tickets endpoint first
    try {
      const res = await fetch(`${API_BASE}/admin/tickets/pending/`, { headers });
      const bodyText = await res.text();
      let pendingData = [];
      try { pendingData = JSON.parse(bodyText); } catch (e) { pendingData = []; }
      setDebug(d => ({ ...d, pendingCount: Array.isArray(pendingData) ? pendingData.length : 0, pendingBody: bodyText }));
      if (res.status === 401 || res.status === 403) {
        Alert.alert('Not authorized', 'You need admin credentials to view tickets');
        return;
      }
      if (res.ok && Array.isArray(pendingData) && pendingData.length > 0) {
        const sorted = pendingData.sort((a,b) => (b.unread_count || 0) - (a.unread_count || 0));
        const mapped = sorted.map(t => ({ uid: t.uid, title: t.title, first_name: t.first_name, last_name: t.last_name, unread_count: t.unread_count || 0, created_at: t.created_at, last_message: (t.messages && t.messages.length) ? t.messages[t.messages.length-1].content : '' }));
        setTickets(mapped);
        return;
      }
    } catch (e) {
      console.log('pending fetch failed', e);
    }

    // fallback: fetch all admin tickets
    try {
      const resAll = await fetch(`${API_BASE}/admin/tickets/`, { headers });
      const allText = await resAll.text();
      let allData = [];
      try { allData = JSON.parse(allText); } catch (e) { allData = []; }
      setDebug(d => ({ ...d, allCount: Array.isArray(allData) ? allData.length : 0, allBody: allText }));
      if (resAll.ok && Array.isArray(allData) && allData.length > 0) {
        const sorted = allData.sort((a,b) => (b.unread_count || 0) - (a.unread_count || 0));
        const mapped = sorted.map(t => ({ uid: t.uid, title: t.title, first_name: t.first_name, last_name: t.last_name, unread_count: t.unread_count || 0, created_at: t.created_at, last_message: (t.messages && t.messages.length) ? t.messages[t.messages.length-1].content : '' }));
        setTickets(mapped);
        return;
      }
      setTickets([]);
    } catch (e) {
      console.log('admin all fetch failed', e);
      Alert.alert('Failed to load admin tickets');
    }
  };

  useEffect(() => { load(); }, []);

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

  const doAction = async (ticketUid, action, assign_user_id) => {
    const token = await AsyncStorage.getItem('authToken');
    const body = { action };
    if (assign_user_id) body.assign_user_id = assign_user_id;
    const res = await fetch(`${API_BASE}/admin/tickets/${ticketUid}/action/`, {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'}, token ? { Authorization: `Token ${token}` } : {}),
      body: JSON.stringify(body),
    });
    if (res.ok) {
      Alert.alert('Action performed');
      load();
    } else {
      Alert.alert('Action failed');
    }
  };

  return (
    <View style={{ flex: 1, padding: 12 }}>
      <Text style={{ fontWeight: 'bold', fontSize: 18 }}>Admin - Pending Tickets</Text>
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
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            <Button title="Close" onPress={() => doAction(item.uid, 'close')} />
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
