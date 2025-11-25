import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, Button, FlatList, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = Platform.OS === 'web' ? `http://${window.location.hostname}:8000/api` : 'http://10.0.2.2:8000/api';

export default function ChatScreen({ route }) {
  const { ticketUid } = route.params || {};
  const [messages, setMessages] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  const fetchMessages = async () => {
    if (!ticketUid) return;
    try {
  const token = await AsyncStorage.getItem('authToken');
  if (!token) { navigation.replace('Login'); return; }
      const isAdmin = (await AsyncStorage.getItem('isAdmin')) === '1';
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

  const send = async () => {
    if (!text) return;
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const isAdmin = (await AsyncStorage.getItem('isAdmin')) === '1';
      const res = await fetch(`${API_BASE}/messages/create/`, {
        method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: `Token ${token}` } : {}),
        body: JSON.stringify({ ticket_uid: ticketUid, sender: isAdmin ? 'admin' : 'user', content: text }),
      });
      if (res.ok) {
        setText('');
        fetchMessages();
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 12 }}>
      <Text>Ticket: {ticketUid}</Text>
      <FlatList data={messages} keyExtractor={(item) => String(item.id)} renderItem={({ item }) => (
        <View style={{ padding: 8, borderBottomWidth: 1 }}>
          <Text style={{ fontWeight: 'bold' }}>{item.sender}</Text>
          <Text>{item.content}</Text>
        </View>
      )} />

      <Text style={{ marginTop: 8, fontWeight: 'bold' }}>Attachments</Text>
      {attachments.length === 0 && <Text>No attachments</Text>}
      {attachments.map((a) => (
        <View key={a.id} style={{ paddingVertical: 4 }}>
          <Text selectable>{a.file}</Text>
        </View>
      ))}

      <TextInput value={text} onChangeText={setText} placeholder="Message" style={{ borderWidth: 1, marginVertical: 8 }} />
      <Button title={loading ? 'Sending...' : 'Send'} onPress={send} disabled={loading} />
    </View>
  );
}
