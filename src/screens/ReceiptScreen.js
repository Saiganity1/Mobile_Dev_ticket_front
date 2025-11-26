import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Share, Platform, TextInput, ScrollView } from 'react-native';
import styles, { useThemedStyles, colors } from '../styles';
import Loading from '../components/Loading';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = Platform.OS === 'web' ? `http://${window.location.hostname}:8000/api` : 'http://10.0.2.2:8000/api';

export default function ReceiptScreen({ route, navigation }) {
  const { ticketNumber, ticketUid } = route.params || {};
  const { s } = useThemedStyles();
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [needNames, setNeedNames] = useState(false);
  const [firstNameInput, setFirstNameInput] = useState('');
  const [lastNameInput, setLastNameInput] = useState('');

  useEffect(() => { fetchReceipt(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const fetchReceipt = async (opts = {}) => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      let url = '';
      if (ticketNumber) url = `${API_BASE}/tickets/${ticketNumber}/receipt/`;
      else if (ticketUid) url = `${API_BASE}/tickets/${ticketUid}/receipt/`;
      else { Alert.alert('Missing ticket id'); setLoading(false); return; }
      const params = [];
      const fn = opts.first_name || firstNameInput;
      const ln = opts.last_name || lastNameInput;
      if (fn) params.push(`first_name=${encodeURIComponent(fn)}`);
      if (ln) params.push(`last_name=${encodeURIComponent(ln)}`);
      const finalUrl = params.length ? `${url}?${params.join('&')}` : url;
      const res = await fetch(finalUrl, { headers: token ? { Authorization: `Token ${token}` } : {} });
      if (res.status === 401) { setNeedNames(true); setReceipt(null); setLoading(false); return; }
      if (!res.ok) { Alert.alert('Failed to load receipt'); setLoading(false); return; }
      const data = await res.json();
      setReceipt(data);
      setNeedNames(false);
    } catch (e) { Alert.alert('Failed to load receipt', String(e)); }
    finally { setLoading(false); }
  };

  const onShare = async () => {
    if (!receipt) return;
    const txt = `Ticket #${receipt.ticket_number}\nName: ${receipt.first_name} ${receipt.last_name}\nIssue: ${receipt.title}\nDescription: ${receipt.description}\nCreated: ${receipt.created_at}`;
    try {
      if (Platform.OS === 'web') { await navigator.clipboard.writeText(txt); Alert.alert('Copied', 'Receipt copied to clipboard'); }
      else { await Share.share({ message: txt }); }
    } catch (e) { Alert.alert('Share failed', String(e)); }
  };

  const onDownloadPdf = async () => {
    if (!receipt) return;
    const token = await AsyncStorage.getItem('authToken');
    const url = `${API_BASE}/tickets/${receipt.ticket_number}/receipt.pdf`;
    const fn = firstNameInput || receipt.first_name || '';
    const ln = lastNameInput || receipt.last_name || '';
    const body = new URLSearchParams(); if (fn) body.append('first_name', fn); if (ln) body.append('last_name', ln);
    try {
      if (Platform.OS === 'web') {
        const res = await fetch(url, { method: 'POST', headers: token ? { Authorization: `Token ${token}` } : {}, body });
        if (!res.ok) { Alert.alert('Download failed'); return; }
        const blob = await res.blob(); const blobUrl = window.URL.createObjectURL(blob); window.open(blobUrl, '_blank'); return;
      }
      const res = await fetch(url, { method: 'POST', headers: token ? { Authorization: `Token ${token}` } : {}, body });
      if (!res.ok) { Alert.alert('Download failed'); return; }
      const blob = await res.blob(); const fileReader = new FileReader();
      fileReader.onload = async () => { const base64 = fileReader.result; try { await Share.share({ url: base64 }); } catch (e) { Alert.alert('Share failed', String(e)); } };
      fileReader.readAsDataURL(blob);
    } catch (e) { Alert.alert('Download failed', String(e)); }
  };

  if (loading) return <View style={s.container}><Loading /></View>;
  if (!receipt) {
    return (
      <View style={s.container}>
        {needNames ? (
          <View>
            <Text style={s.subHeader}>Enter your name to view the receipt</Text>
            <Text style={s.subText}>First name</Text>
            <TextInput value={firstNameInput} onChangeText={setFirstNameInput} style={s.input} placeholder="First name" />
            <Text style={s.subText}>Last name</Text>
            <TextInput value={lastNameInput} onChangeText={setLastNameInput} style={s.input} placeholder="Last name" />
            <TouchableOpacity onPress={() => fetchReceipt({ first_name: firstNameInput, last_name: lastNameInput })} style={s.button}><Text style={s.buttonText}>Submit</Text></TouchableOpacity>
          </View>
        ) : (
          <View>
            <Text style={s.subText}>No receipt</Text>
            <TouchableOpacity onPress={() => fetchReceipt()} style={s.button}><Text style={s.buttonText}>Retry</Text></TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  const statusText = receipt.is_open ? 'Currently Solving' : 'Solved';
  const statusColor = receipt.is_open ? '#fb923c' : '#22c55e';

  return (
    <ScrollView style={s.container} contentContainerStyle={{ alignItems: 'center', paddingVertical: 18 }}>
      <View style={{ width: '100%', maxWidth: 720, paddingHorizontal: 12, alignItems: 'center' }}>
        <Text style={[s.header, { alignSelf: 'center' }]}>Receipt</Text>

        <View style={{ width: '100%', maxWidth: 480, marginTop: 8 }}>
          <View style={{
            backgroundColor: '#fff',
            borderRadius: 12,
            padding: 12,
            position: 'relative',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 6,
            borderWidth: 1,
            borderColor: '#eef2f7'
          }}>

            {/* Header row */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontWeight: '800', fontSize: 16, color: '#0f172a' }}>Chat Support System</Text>
              <View style={{ flex: 1 }} />
              {/* status badge positioned inside the row to overlay top-right visually */}
              <View style={{ backgroundColor: statusColor, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, alignSelf: 'flex-start' }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{statusText}</Text>
              </View>
            </View>

            <Text style={[s.subText, { marginTop: 10, color: '#475569' }]}>Ticket #{receipt.ticket_number}</Text>
            <Text style={[s.subText, { marginTop: 6, color: '#475569' }]}>Name: {receipt.first_name} {receipt.last_name}</Text>
            <Text style={[s.subText, { marginTop: 8, fontWeight: '700', color: '#0f172a' }]}>Issue: {receipt.title}</Text>
            <Text style={[s.subText, { marginTop: 6, color: '#334155' }]} numberOfLines={6}>{receipt.description}</Text>
            <Text style={[s.subText, { marginTop: 8, color: '#64748b' }]}>Created: {receipt.created_at}</Text>

            <View style={{ marginTop: 12 }} />
            <TouchableOpacity onPress={onShare} style={{ backgroundColor: '#0f172a', paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: '700' }}>Copy/Share</Text></TouchableOpacity>
            <View style={{ height: 8 }} />
            <TouchableOpacity onPress={onDownloadPdf} style={{ backgroundColor: '#0f172a', paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: '700' }}>Download PDF</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
