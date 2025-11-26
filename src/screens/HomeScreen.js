import React, { useState, useEffect, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, Text, Alert, Platform } from 'react-native';
import Loading from '../components/Loading';
import styles, { PillToggle, global, colors, useThemedStyles } from '../styles';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = Platform.OS === 'web'
  ? `http://${window.location.hostname}:8000/api`
  : 'http://10.0.2.2:8000/api'; // emulator host for Android

export default function HomeScreen({ navigation }) {
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [tickets, setTickets] = React.useState([]);
  const [openCount, setOpenCount] = React.useState(0);
  const { s } = useThemedStyles();

  React.useEffect(() => {
    (async () => {
      const v = await AsyncStorage.getItem('isAdmin');
      const admin = v === '1';
      setIsAdmin(admin);
      if (admin) {
  // load admin tickets for messenger view (respecting adminFilter)
  await loadAdminTickets(adminFilter);
      }
      else {
        // load user's own ongoing reports (open tickets)
        const token = await AsyncStorage.getItem('authToken');
        try {
          // fetch paginated open tickets to get count quickly
          const res = await fetch(`${API_BASE}/tickets/my/?is_open=true`, { headers: token ? { Authorization: `Token ${token}` } : {} });
          if (res.ok) {
            const data = await res.json();
            // if paginated, data.count is available
            const count = data.count != null ? data.count : (Array.isArray(data) ? data.length : 0);
            setOpenCount(count);
            const list = data.results || data;
            const open = list.map(t => ({ uid: t.uid, ticket_number: t.ticket_number || t.id, title: t.title, name: `${t.first_name} ${t.last_name}`, unread: t.unread_count || 0, last_at: t.updated_at }));
            setTickets(open);
          }
        } catch (e) { console.log('Failed load my tickets', e); }
      }
    })();
  }, []);

  const [adminFilter, setAdminFilter] = useState('not_complete'); // 'not_complete' | 'all' | 'completed'
  const [loadingAdmin, setLoadingAdmin] = useState(false);

  const loadAdminTickets = async (which = 'not_complete') => {
    setLoadingAdmin(true);
    const token = await AsyncStorage.getItem('authToken');
    const headers = token ? { Authorization: `Token ${token}` } : {};
    try {
      if (which === 'not_complete') {
        const res = await fetch(`${API_BASE}/admin/tickets/pending/`, { headers });
        if (!res.ok) { setTickets([]); setLoadingAdmin(false); return; }
        const data = await res.json();
        const open = Array.isArray(data) ? data.map(t => ({ uid: t.uid, title: t.title, name: `${t.first_name} ${t.last_name}`, unread: t.unread_count || 0, last_at: t.updated_at, is_open: t.is_open })) : [];
        setTickets(open.filter(t => t.is_open));
      } else {
        const res = await fetch(`${API_BASE}/admin/tickets/`, { headers });
        if (!res.ok) { setTickets([]); setLoadingAdmin(false); return; }
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        const filtered = which === 'completed' ? list.filter(t => t.is_open === false) : list;
        const mapped = filtered.map(t => ({ uid: t.uid, title: t.title, name: `${t.first_name} ${t.last_name}`, unread: t.unread_count || 0, last_at: t.updated_at, is_open: t.is_open }));
        setTickets(mapped);
      }
    } catch (e) {
      console.log('Failed load admin tickets', e);
      setTickets([]);
    } finally {
      setLoadingAdmin(false);
    }
  };

  // reload admin tickets when filter changes
  useEffect(() => {
    if (isAdmin) loadAdminTickets(adminFilter);
  }, [adminFilter, isAdmin]);

  const loadOpenCount = async () => {
    const token = await AsyncStorage.getItem('authToken');
    try {
      const res = await fetch(`${API_BASE}/tickets/my/?is_open=true`, { headers: token ? { Authorization: `Token ${token}` } : {} });
      if (res.ok) {
        const data = await res.json();
        const count = data.count != null ? data.count : (Array.isArray(data) ? data.length : 0);
        setOpenCount(count);
      }
    } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    const id = setInterval(loadOpenCount, 5000);
    loadOpenCount();
    return () => clearInterval(id);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOpenCount();
    }, [])
  );

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (res.type === 'success') {
      // ensure we have a size field; some platforms provide `size` directly
      let size = res.size;
      try {
        if (size == null && res.uri) {
          const r = await fetch(res.uri);
          const b = await r.blob();
          size = b.size;
        }
      } catch (e) {
        // ignore size fetch errors
      }
      setAttachments((s) => [...s, { ...res, size }]);
    }
  };

  const fmtSize = (bytes) => {
    if (!bytes && bytes !== 0) return '';
    const b = Number(bytes);
    if (isNaN(b)) return '';
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(2)} MB`;
  };

  const removeAttachment = (index) => {
    setAttachments((s) => s.filter((_, i) => i !== index));
  };

  const submit = async () => {
    if (!firstName || !lastName || !title || !description) {
      Alert.alert('All fields are required');
      return;
    }
    if (!attachments.length) {
      Alert.alert('At least one attachment is required');
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append('first_name', firstName);
      form.append('last_name', lastName);
      form.append('title', title);
      form.append('description', description);
      // append each selected file under the same key 'attachments'
      for (const a of attachments) {
        const fileUri = a.uri;
        const fileName = a.name || 'attachment';
        // Convert file URI to blob for reliable upload across platforms
        const resp = await fetch(fileUri);
        const blob = await resp.blob();
        form.append('attachments', blob, fileName);
      }

      const token = await AsyncStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/tickets/create/`, {
        method: 'POST',
        headers: token ? { Authorization: `Token ${token}` } : {},
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Error', JSON.stringify(data));
      } else {
        const idForAlert = data.ticket_number || data.id || data.uid;
        Alert.alert('Ticket created', `Your ticket id: ${idForAlert}`);
        navigation.navigate('Chat', { ticketUid: data.uid });
        try { loadOpenCount(); } catch (e) { /* ignore */ }
      }
    } catch (err) {
      Alert.alert('Network error', String(err));
    } finally {
      setLoading(false);
    }
  };

  // Admin messenger-style view
  if (isAdmin) {
    return (
      <View style={s.container}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <TouchableOpacity onPress={async () => { await AsyncStorage.removeItem('authToken'); await AsyncStorage.removeItem('isAdmin'); navigation.replace('Login'); }}>
            <Text style={{ color: colors.primary, fontWeight: '800' }}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={s.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <PillToggle options={[{ value: 'not_complete', label: 'Not Complete' }, { value: 'all', label: 'All' }, { value: 'completed', label: 'Completed' }]} value={adminFilter} onChange={setAdminFilter} />
            {loadingAdmin ? <Loading text="Loading..." /> : null}
          </View>
          <View style={{ height: 10 }} />
          <Text style={s.header}>Admin Notifications</Text>
        </View>

        {tickets.length === 0 ? (
          <Text style={s.subText}>No pending tickets</Text>
        ) : (
          tickets.map(t => (
            <View key={t.uid} style={s.card}>
              <TouchableTicket ticket={t} navigation={navigation} s={s} />
            </View>
          ))
        )}
      </View>
    );
  }

  // For regular users we keep a clean page; header has Open reports button

  return (
    <View style={s.container}>
      <View style={[s.userPanel, { justifyContent: 'space-between' }]}>
        <View style={s.row}>
          <View style={s.avatar} />
          <View>
            <Text style={s.userName}>Welcome</Text>
            <Text style={s.userMeta}>Open reports: <Text style={{ fontWeight: '800', color: colors.accent }}>{openCount}</Text></Text>
          </View>
        </View>
        <View style={s.row}>
          <TouchableOpacity onPress={async () => { await AsyncStorage.removeItem('authToken'); await AsyncStorage.removeItem('isAdmin'); navigation.replace('Login'); }} style={{ marginRight: 12 }}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Logout</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('MyReports')} style={{ backgroundColor: colors.highlight, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>My Reports</Text>
          </TouchableOpacity>
        </View>
      </View>

        <View style={{ marginTop: 8 }}>
          <TouchableOpacity onPress={() => navigation.navigate('BubbleSettings')}>
            <Text style={{ color: colors.primary, fontSize: 12 }}>Bubble settings</Text>
          </TouchableOpacity>
        </View>

    <View style={{ height: 14 }} />

      <Text style={s.subHeader}>Create a new report</Text>
      <View style={{ height: 10 }} />
      <Text style={s.subText}>First Name</Text>
      <TextInput value={firstName} onChangeText={setFirstName} style={s.input} />
      <Text style={s.subText}>Last Name</Text>
      <TextInput value={lastName} onChangeText={setLastName} style={s.input} />
      <Text style={s.subText}>Title</Text>
      <TextInput value={title} onChangeText={setTitle} style={s.input} />
      <Text style={s.subText}>Description</Text>
      <TextInput value={description} onChangeText={setDescription} style={[s.input, { height: 120 }]} multiline />

      <TouchableOpacity onPress={pickFile} style={[s.button, { marginTop: 6, marginBottom: 8 }]}>
        <Text style={s.buttonText}>Pick attachment</Text>
      </TouchableOpacity>

      {attachments.map((a, idx) => (
        <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
          <Text style={{ flex: 1 }}>{a.name} {a.size ? `(${fmtSize(a.size)})` : ''}</Text>
          <TouchableOpacity onPress={() => removeAttachment(idx)} style={{ padding: 8 }}>
            <Text style={{ color: colors.danger }}>Remove</Text>
          </TouchableOpacity>
        </View>
      ))}

      <View style={{ height: 12 }} />
      <TouchableOpacity onPress={submit} disabled={loading} style={[s.button, { opacity: loading ? 0.7 : 1 }]}>
        {loading ? <Loading text="Sending..." /> : <Text style={s.buttonText}>Submit</Text>}
      </TouchableOpacity>
    </View>
  );
}

function TouchableTicket({ ticket, navigation, s }) {
  return (
    <TouchableOpacity onPress={() => navigation.navigate('Chat', { ticketUid: ticket.uid })} style={{ padding: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ fontWeight: '800' }}>{ticket.title}</Text>
          <Text style={{ color: s ? s.subText.color : '#555' }}>{ticket.name}</Text>
        </View>
        {ticket.unread ? <View style={{ backgroundColor: colors.danger, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}><Text style={{ color: '#fff', fontWeight: '700' }}>{ticket.unread}</Text></View> : null}
      </View>
      <Text style={{ color: '#8b97a6', fontSize: 12, marginTop: 8 }}>{ticket.last_at}</Text>
    </TouchableOpacity>
  );
}
