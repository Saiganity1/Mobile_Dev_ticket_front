import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, FlatList, Platform, TouchableOpacity, Linking, Alert, ToastAndroid, Animated, StyleSheet } from 'react-native';
import Loading from '../components/Loading';
import AsyncStorage from '@react-native-async-storage/async-storage';
import styles, { useThemedStyles, colors } from '../styles';

const API_BASE = Platform.OS === 'web' ? `http://${window.location.hostname}:8000/api` : 'http://10.0.2.2:8000/api';

export default function ChatScreen({ route, navigation }) {
  const { ticketUid } = route.params || {};
  const [messages, setMessages] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [ticketMeta, setTicketMeta] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const { s } = useThemedStyles();
  const timerRef = useRef(null);
  const [bubbleUserBg, setBubbleUserBg] = useState(null);
  const [bubbleUserText, setBubbleUserText] = useState(null);
  const [bubbleAdminBg, setBubbleAdminBg] = useState(null);
  const [bubbleAdminText, setBubbleAdminText] = useState(null);

  const fetchMessages = async () => {
    if (!ticketUid) return;
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) { navigation.replace('Login'); return; }
      const isAdminVal = (await AsyncStorage.getItem('isAdmin')) === '1';
      setIsAdmin(isAdminVal);
      const url = isAdminVal ? `${API_BASE}/admin/tickets/${ticketUid}/` : `${API_BASE}/tickets/${ticketUid}/`;
      const headers = token ? { Authorization: `Token ${token}` } : {};
      const res = await fetch(url, { headers });
      if (res.status === 401 || res.status === 403) {
        console.log('Chat fetch unauthorized', res.status);
        return;
      }
      if (res.ok) {
        const data = await res.json();
  setMessages(data.messages || []);
  setAttachments(data.attachments || []);
  setTicketMeta({ is_open: data.is_open, uid: data.uid, ticket_number: data.ticket_number || data.id });
      }
    } catch (e) {
      console.log('fetchMessages error', e);
    }
  };

  useEffect(() => {
    fetchMessages();
    timerRef.current = setInterval(fetchMessages, 3000);
    return () => clearInterval(timerRef.current);
  }, [ticketUid]);

  useEffect(() => {
    (async () => {
      try {
        const ub = await AsyncStorage.getItem('bubbleUser');
        const ut = await AsyncStorage.getItem('bubbleUserText');
        const ab = await AsyncStorage.getItem('bubbleAdmin');
        const at = await AsyncStorage.getItem('bubbleAdminText');
        if (ub) setBubbleUserBg(ub);
        if (ut) setBubbleUserText(ut);
        if (ab) setBubbleAdminBg(ab);
        if (at) setBubbleAdminText(at);
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  // header actions intentionally removed; controls render under ticket title so they stay in the layout

  const send = async () => {
    if (!text) return;
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
      console.log('send error', e);
    } finally {
      setSending(false);
    }
  };

  const openAttachment = async (filePath) => {
    if (!filePath) return;
    let url = filePath;
    if (!/^https?:\/\//i.test(filePath)) {
      if (filePath.startsWith('/')) url = `${API_BASE}${filePath}`;
      else url = `${API_BASE}/${filePath}`;
    }
    try { await Linking.openURL(url); } catch (e) { console.log('Failed to open attachment', e); }
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

  const getInitials = (item) => {
    if (!item) return '';
    if (item.sender_name) return item.sender_name.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase();
    if (item.sender === 'admin') return 'AD';
    if (item.sender === 'user') return 'US';
    return String(item.sender || '?').slice(0,2).toUpperCase();
  };

  const MessageBubble = ({ item }) => {
    const meIsSender = (item.sender === 'admin') === isAdmin;
    const anim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }, []);

    const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });
    const opacity = anim;

    const userBg = bubbleUserBg || (s.chat && s.chat.bubbleIncoming && s.chat.bubbleIncoming.backgroundColor) || '#eef6ff';
    const userText = bubbleUserText || (s.chat && s.chat.bubbleIncoming && s.chat.bubbleIncoming.color) || '#0b2f6b';
    const adminBg = bubbleAdminBg || (s.chat && s.chat.bubbleOutgoing && s.chat.bubbleOutgoing.backgroundColor) || '#2b6cb0';
    const adminText = bubbleAdminText || '#fff';

    return (
      <Animated.View style={{ opacity, transform: [{ translateY }], flexDirection: 'row', justifyContent: meIsSender ? 'flex-end' : 'flex-start', paddingHorizontal: 8, marginVertical: 6 }}>
        {!meIsSender && (
          <View style={localStyles.avatarWrap}>
            <View style={localStyles.avatar}>
              <Text style={localStyles.avatarText}>{getInitials(item)}</Text>
            </View>
          </View>
        )}

        <View style={[{ maxWidth: '78%', borderRadius: 12, padding: 10, backgroundColor: meIsSender ? adminBg : userBg }]}> 
          <Text style={{ color: meIsSender ? adminText : userText, fontWeight: '600' }}>{item.content}</Text>
          <Text style={[s.chat.bubbleMeta, { color: meIsSender ? adminText : (s.chat && s.chat.bubbleIncoming && s.chat.bubbleIncoming.color) || '#666' }]}>{new Date(item.created_at || item.updated_at || item.sent_at || item.timestamp || '').toLocaleString()}</Text>
        </View>

        {meIsSender && (
          <View style={localStyles.avatarWrapRight}>
            <View style={[localStyles.avatar, { backgroundColor: adminBg }]}>
              <Text style={localStyles.avatarText}>{getInitials(item)}</Text>
            </View>
          </View>
        )}
      </Animated.View>
    );
  };

  return (
    <View style={s.container}>
      <Text style={s.header}>Ticket: {ticketMeta && ticketMeta.ticket_number ? `#${ticketMeta.ticket_number}` : ticketUid}</Text>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 }}>
        <View>
          <Text style={s.subText}>UID: {ticketMeta ? ticketMeta.uid : ticketUid}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => { if (!ticketMeta) return; navigation.navigate('Receipt', { ticketNumber: ticketMeta.ticket_number, ticketUid: ticketMeta.uid }); }} style={{ marginRight: 12 }}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Receipt</Text>
          </TouchableOpacity>
          {isAdmin && (
            <TouchableOpacity onPress={() => {
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
            }}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>{ticketMeta && ticketMeta.is_open === false ? 'Reopen' : 'Close'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {ticketMeta && ticketMeta.is_open === false && !isAdmin && (
        <View style={[s.card, { backgroundColor: '#fff6f6' }]}> 
          <Text style={{ color: colors.danger, fontWeight: '700' }}>This report has been marked completed by an admin. You can no longer send messages.</Text>
        </View>
      )}

  <FlatList data={messages} keyExtractor={(item) => String(item.id)} renderItem={({ item }) => <MessageBubble item={item} />} contentContainerStyle={{ paddingVertical: 12 }} style={{ flex: 1 }} />

      {attachments.length > 0 && (
        <View style={{ flexDirection: 'row', padding: 8 }}>
          {attachments.map(a => (
            <TouchableOpacity key={a.id} onPress={() => openAttachment(a.file)} style={s.chat.attachmentPreview}>
              <Text selectable style={{ color: colors.primary }}>{a.filename || a.file}</Text>
              <Text style={s.smallText}>{fmtSize(a.size)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={s.chat.inputBar}>
        <TextInput value={text} onChangeText={setText} placeholder="Message" style={s.chat.inputField} editable={!(ticketMeta && ticketMeta.is_open === false && !isAdmin)} />
        <TouchableOpacity onPress={send} style={s.chat.sendButton} disabled={sending || (ticketMeta && ticketMeta.is_open === false && !isAdmin)}>
          {sending ? <Loading /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Send</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  avatarWrap: { width: 40, paddingHorizontal: 6, justifyContent: 'center' },
  avatarWrapRight: { width: 40, paddingHorizontal: 6, justifyContent: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#999', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700' },
});

