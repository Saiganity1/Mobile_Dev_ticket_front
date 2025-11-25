import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, Button, FlatList, Platform, TouchableOpacity, Linking, Alert, ToastAndroid, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = Platform.OS === 'web' ? `http://${window.location.hostname}:8000/api` : 'http://10.0.2.2:8000/api';

export default function ChatScreen({ route, navigation }) {
  const { ticketUid } = route.params || {};
  const [messages, setMessages] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [ticketMeta, setTicketMeta] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const timerRef = useRef(null);

  const fetchMessages = async () => {
    if (!ticketUid) return;
    try {
  const token = await AsyncStorage.getItem('authToken');
  if (!token) { navigation.replace('Login'); return; }
  const isAdminVal = (await AsyncStorage.getItem('isAdmin')) === '1';
  setIsAdmin(isAdminVal);
      const url = isAdmin ? `${API_BASE}/admin/tickets/${ticketUid}/` : `${API_BASE}/tickets/${ticketUid}/`;
      const headers = token ? { Authorization: `Token ${token}` } : {};
      const res = await fetch(url, { headers });
      if (res.status === 401 || res.status === 403) {
        // not authorized
        console.log('Chat fetch unauthorized', res.status);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setAttachments(data.attachments || []);
        // capture ticket meta like is_open
        setTicketMeta({ is_open: data.is_open, uid: data.uid });
      } else {
        console.log('Failed to fetch chat', res.status);
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchMessages();
    timerRef.current = setInterval(fetchMessages, 3000);
    return () => clearInterval(timerRef.current);
  }, [ticketUid]);

  // update header button when meta or admin status changes
  useEffect(() => {
    if (!navigation) return;
    if (!isAdmin) {
      navigation.setOptions({ headerRight: () => null });
      return;
    }
    // show button for admins
    navigation.setOptions({
      headerRight: () => (
        <Button title={ticketMeta && ticketMeta.is_open === false ? 'Reopen Report' : 'Mark Report Complete'} onPress={() => {
          const action = (ticketMeta && ticketMeta.is_open === false) ? 'reopen' : 'close';
          const msg = action === 'close' ? 'Mark this report complete? Users will be unable to send further messages.' : 'Reopen this report? Users will be able to send messages again.';
          if (Platform.OS === 'web') {
            if (window.confirm(msg)) adminToggleComplete();
          } else {
            Alert.alert('Confirm', msg, [
              { text: 'Cancel', style: 'cancel' },
              { text: action === 'close' ? 'Close' : 'Reopen', onPress: () => adminToggleComplete() }
            ]);
          }
        }} />
      )
    });
  }, [navigation, isAdmin, ticketMeta]);

  const send = async () => {
    if (!text) return;
    // prevent sending if ticket closed (for both admin and user)
    if (ticketMeta && ticketMeta.is_open === false) return;
    setSending(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
  const isAdminVal = (await AsyncStorage.getItem('isAdmin')) === '1';
      const sender = isAdminVal ? 'admin' : 'user';
      const res = await fetch(`${API_BASE}/messages/create/`, {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: `Token ${token}` } : {}),
        body: JSON.stringify({ ticket_uid: ticketUid, sender, content: text }),
      });
      if (res.ok) {
        setText('');
        fetchMessages();
      }
    } catch (e) {
      // ignore
    } finally {
      setSending(false);
    }
  };

  const openAttachment = async (filePath) => {
    if (!filePath) return;
    let url = filePath;
    if (!/^https?:\/\//i.test(filePath)) {
      // make absolute against API base
      if (filePath.startsWith('/')) url = `${API_BASE}${filePath}`;
      else url = `${API_BASE}/${filePath}`;
    }
    try {
      await Linking.openURL(url);
    } catch (e) {
      console.log('Failed to open attachment', e);
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

  const adminToggleComplete = async () => {
    if (!ticketMeta || !ticketMeta.uid) return;
    const token = await AsyncStorage.getItem('authToken');
    const action = ticketMeta.is_open ? 'close' : 'reopen';
    try {
      const res = await fetch(`${API_BASE}/admin/tickets/${ticketMeta.uid}/action/`, {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: `Token ${token}` } : {}),
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        // flip locally and refresh messages
  setTicketMeta(m => ({ ...m, is_open: !m.is_open }));
  fetchMessages();
  if (Platform.OS === 'android') ToastAndroid.show('Action performed', ToastAndroid.SHORT);
  else Alert.alert('Success', 'Action performed');
      } else {
  if (Platform.OS === 'android') ToastAndroid.show('Action failed', ToastAndroid.SHORT);
  else Alert.alert('Error', 'Action failed');
      }
    } catch (e) {
  console.log('admin action failed', e);
  if (Platform.OS === 'android') ToastAndroid.show('Action failed', ToastAndroid.SHORT);
  else Alert.alert('Error', 'Action failed');
    }
  };

  return (
    <View style={{ flex: 1, padding: 12 }}>
      <Text>Ticket: {ticketUid}</Text>
      {ticketMeta && ticketMeta.is_open === false && !isAdmin && (
        <View style={{ padding: 8, backgroundColor: '#f0f0f0', borderRadius: 6, marginVertical: 8 }}>
          <Text style={{ color: '#333', fontWeight: 'bold' }}>This report has been marked completed by an admin. You can no longer send messages.</Text>
        </View>
      )}
      <FlatList data={messages} keyExtractor={(item) => String(item.id)} renderItem={({ item }) => (
        <View style={{ padding: 8, borderBottomWidth: 1 }}>
          <Text style={{ fontWeight: 'bold' }}>{item.sender}</Text>
          <Text>{item.content}</Text>
        </View>
      )} />

      <Text style={{ marginTop: 8, fontWeight: 'bold' }}>Attachments</Text>
      {attachments.length === 0 && <Text>No attachments</Text>}
      {attachments.map((a) => (
        <TouchableOpacity key={a.id} onPress={() => openAttachment(a.file)} style={{ paddingVertical: 6 }}>
          <Text selectable style={{ color: 'blue' }}>{a.filename || a.file}</Text>
          <Text style={{ color: '#666', fontSize: 12 }}>{fmtSize(a.size)}</Text>
        </TouchableOpacity>
      ))}

  <TextInput value={text} onChangeText={setText} placeholder="Message" style={{ borderWidth: 1, marginVertical: 8 }} editable={!(ticketMeta && ticketMeta.is_open === false && !isAdmin)} />
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <Button title={sending ? 'Sending...' : 'Send'} onPress={send} disabled={sending || (ticketMeta && ticketMeta.is_open === false && !isAdmin)} />
    {sending ? <ActivityIndicator style={{ marginLeft: 8 }} size="small" /> : null}
  </View>
    </View>
  );
}
