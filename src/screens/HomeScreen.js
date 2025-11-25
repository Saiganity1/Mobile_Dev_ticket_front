import React, { useState, useEffect, useCallback } from 'react';
import { View, TextInput, Button, Text, Alert, TouchableOpacity, Platform } from 'react-native';
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

  React.useEffect(() => {
    (async () => {
      const v = await AsyncStorage.getItem('isAdmin');
      const admin = v === '1';
      setIsAdmin(admin);
      if (admin) {
        // load admin tickets for messenger view
        const token = await AsyncStorage.getItem('authToken');
        try {
          const res = await fetch(`${API_BASE}/admin/tickets/`, { headers: token ? { Authorization: `Token ${token}` } : {} });
          if (res.ok) {
            const data = await res.json();
            // keep only open tickets and map preview
            const open = data.filter(t => t.is_open).map(t => ({ uid: t.uid, title: t.title, name: `${t.first_name} ${t.last_name}`, unread: t.unread_count || 0, last_at: t.updated_at }));
            setTickets(open);
          }
        } catch (e) { console.log('Failed load admin tickets', e); }
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
            const open = list.map(t => ({ uid: t.uid, title: t.title, name: `${t.first_name} ${t.last_name}`, unread: t.unread_count || 0, last_at: t.updated_at }));
            setTickets(open);
          }
        } catch (e) { console.log('Failed load my tickets', e); }
      }
    })();
  }, []);

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
      setAttachments((s) => [...s, res]);
    }
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
  Alert.alert('Ticket created', `Your ticket id: ${data.uid}`);
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
      <View style={{ flex: 1, padding: 12 }}>
        <Button title="Logout" onPress={async () => { await AsyncStorage.removeItem('authToken'); await AsyncStorage.removeItem('isAdmin'); navigation.replace('Login'); }} />
        <Text style={{ fontWeight: 'bold', marginTop: 8, marginBottom: 8 }}>Admin Notifications</Text>
        {tickets.length === 0 && <Text>No pending tickets</Text>}
        {tickets.map(t => (
          <TouchableTicket key={t.uid} ticket={t} navigation={navigation} />
        ))}
      </View>
    );
  }

  // For regular users show ongoing reports above the form
  const hasOngoing = tickets && tickets.length > 0;

  return (
    <View style={{ padding: 16 }}>
      {hasOngoing && (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Your ongoing reports</Text>
          {tickets.map(t => (
            <TouchableTicket key={t.uid} ticket={t} navigation={navigation} />
          ))}
          <View style={{ height: 8 }} />
          <Button title="View all reports" onPress={() => navigation.navigate('MyReports')} />
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Button title="Logout" onPress={async () => { await AsyncStorage.removeItem('authToken'); await AsyncStorage.removeItem('isAdmin'); navigation.replace('Login'); }} />
        <TouchableOpacity onPress={() => navigation.navigate('MyReports')} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontWeight: 'bold', marginRight: 8 }}>Open reports</Text>
          <View style={{ backgroundColor: 'red', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ color: 'white' }}>{openCount}</Text>
          </View>
        </TouchableOpacity>
      </View>
      <View style={{ height: 12 }} />
      <Text>First Name</Text>
      <TextInput value={firstName} onChangeText={setFirstName} style={{ borderWidth: 1, marginBottom: 8 }} />
      <Text>Last Name</Text>
      <TextInput value={lastName} onChangeText={setLastName} style={{ borderWidth: 1, marginBottom: 8 }} />
      <Text>Title</Text>
      <TextInput value={title} onChangeText={setTitle} style={{ borderWidth: 1, marginBottom: 8 }} />
      <Text>Description</Text>
      <TextInput value={description} onChangeText={setDescription} style={{ borderWidth: 1, marginBottom: 8, height: 100 }} multiline />

      <Button title={'Pick attachment'} onPress={pickFile} />
      {attachments.map((a, idx) => (
        <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
          <Text style={{ flex: 1 }}>{a.name}</Text>
          <Button title="Remove" onPress={() => removeAttachment(idx)} />
        </View>
      ))}

      <View style={{ height: 12 }} />
      <Button title={loading ? 'Sending...' : 'Submit'} onPress={submit} disabled={loading} />
    </View>
  );
}

function TouchableTicket({ ticket, navigation }) {
  return (
    <TouchableOpacity onPress={() => navigation.navigate('Chat', { ticketUid: ticket.uid })} style={{ padding: 12, borderBottomWidth: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: 'bold' }}>{ticket.title}</Text>
        {ticket.unread ? <Text style={{ color: 'red' }}>{ticket.unread} new</Text> : null}
      </View>
      <Text style={{ color: '#555' }}>{ticket.name}</Text>
      <Text style={{ color: '#999', fontSize: 12 }}>{ticket.last_at}</Text>
    </TouchableOpacity>
  );
}
