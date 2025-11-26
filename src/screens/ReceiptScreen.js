import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Share, Platform, TextInput } from 'react-native';
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

  useEffect(() => {
    fetchReceipt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchReceipt = async (opts = {}) => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      let url = '';
      if (ticketNumber) url = `${API_BASE}/tickets/${ticketNumber}/receipt/`;
      else if (ticketUid) url = `${API_BASE}/tickets/${ticketUid}/receipt/`;
      else { Alert.alert('Missing ticket id'); setLoading(false); return; }
      // append query params if supplied
      const params = [];
      const fn = opts.first_name || firstNameInput;
      const ln = opts.last_name || lastNameInput;
      if (fn) params.push(`first_name=${encodeURIComponent(fn)}`);
      if (ln) params.push(`last_name=${encodeURIComponent(ln)}`);
      const finalUrl = params.length ? `${url}?${params.join('&')}` : url;
      const res = await fetch(finalUrl, { headers: token ? { Authorization: `Token ${token}` } : {} });
      if (res.status === 401) {
        // show inline prompt for names
        setNeedNames(true);
        setReceipt(null);
        setLoading(false);
        return;
      }
      if (!res.ok) { Alert.alert('Failed to load receipt'); setLoading(false); return; }
      const data = await res.json();
      setReceipt(data);
      setNeedNames(false);
    } catch (e) {
      Alert.alert('Failed to load receipt', String(e));
    } finally { setLoading(false); }
  };


  const onShare = async () => {
    if (!receipt) return;
    const txt = `Ticket #${receipt.ticket_number}\nName: ${receipt.first_name} ${receipt.last_name}\nIssue: ${receipt.title}\nDescription: ${receipt.description}\nCreated: ${receipt.created_at}`;
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(txt);
        Alert.alert('Copied', 'Receipt copied to clipboard');
      } else {
        await Share.share({ message: txt });
      }
    } catch (e) {
      Alert.alert('Share failed', String(e));
    }
  };

  const onDownloadPdf = async () => {
    if (!receipt) return;
    const token = await AsyncStorage.getItem('authToken');
    const url = `${API_BASE}/tickets/${receipt.ticket_number}/receipt.pdf`;
    // prefer explicit inputs, fallback to receipt names when available
    const fn = firstNameInput || receipt.first_name || '';
    const ln = lastNameInput || receipt.last_name || '';
    const body = new URLSearchParams();
    if (fn) body.append('first_name', fn);
    if (ln) body.append('last_name', ln);
    try {
      if (Platform.OS === 'web') {
        const res = await fetch(url, { method: 'POST', headers: token ? { Authorization: `Token ${token}` } : {}, body });
        if (!res.ok) { Alert.alert('Download failed'); return; }
        const blob = await res.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        return;
      }

      const res = await fetch(url, { method: 'POST', headers: token ? { Authorization: `Token ${token}` } : {}, body });
      if (!res.ok) { Alert.alert('Download failed'); return; }
      const blob = await res.blob();
      const fileReader = new FileReader();
      fileReader.onload = async () => {
        const base64 = fileReader.result;
        try { await Share.share({ url: base64 }); } catch (e) { Alert.alert('Share failed', String(e)); }
      };
      fileReader.readAsDataURL(blob);
    } catch (e) {
      Alert.alert('Download failed', String(e));
    }
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

  return (
    <View style={s.container}>
      <Text style={s.header}>Receipt</Text>
      <View style={s.card}>
        <Text style={{ fontWeight: '800' }}>Ticket #{receipt.ticket_number}</Text>
        <Text style={s.subText}>Name: {receipt.first_name} {receipt.last_name}</Text>
        <Text style={[s.subText, { marginTop: 6 }]}>Issue: {receipt.title}</Text>
        <Text style={[s.subText, { marginTop: 6 }]}>{receipt.description}</Text>
        <Text style={[s.subText, { marginTop: 8 }]}>Created: {receipt.created_at}</Text>
      </View>
  <TouchableOpacity onPress={onShare} style={s.button}><Text style={s.buttonText}>Copy/Share</Text></TouchableOpacity>
  <View style={{ height: 8 }} />
  <TouchableOpacity onPress={onDownloadPdf} style={s.button}><Text style={s.buttonText}>Download PDF</Text></TouchableOpacity>
    </View>
  );
}
