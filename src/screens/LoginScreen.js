import React, { useState } from 'react';
import { View, TextInput, Button, Text, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const API_BASE = Platform.OS === 'web'
  ? `http://${window.location.hostname}:8000/api`
  : 'http://127.0.0.1:8000/api';

export default function LoginScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const login = async () => {
    if (!username || !password) {
      Alert.alert('Username and password required');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login/`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ username, password }),
      });
      const text = await res.text();
      let data = {};
      try { data = JSON.parse(text); } catch (e) { data = { detail: text }; }
      console.log('Login response', res.status, data);
      if (!res.ok) {
        setErrors(data);
      } else {
  await AsyncStorage.setItem('authToken', data.token);
  await AsyncStorage.setItem('isAdmin', data.is_admin ? '1' : '0');
  if (data.user_id) await AsyncStorage.setItem('userId', String(data.user_id));
  navigation.replace('Home');
      }
    } catch (e) {
      console.log('Login error', e);
      Alert.alert('Network error', String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 16 }}>
  <Text>Username</Text>
  <TextInput value={username} onChangeText={setUsername} style={{ borderWidth: 1, marginBottom: 8 }} />
  {errors.username && <Text style={{ color: 'red' }}>{Array.isArray(errors.username) ? errors.username.join(', ') : String(errors.username)}</Text>}
      <Text>Password</Text>
      <TextInput value={password} onChangeText={setPassword} secureTextEntry style={{ borderWidth: 1, marginBottom: 8 }} />
  {errors.password && <Text style={{ color: 'red' }}>{Array.isArray(errors.password) ? errors.password.join(', ') : String(errors.password)}</Text>}
  {errors.detail && <Text style={{ color: 'red' }}>{errors.detail}</Text>}
      <Button title={loading ? 'Logging in...' : 'Login'} onPress={login} disabled={loading} />
      <View style={{ height: 12 }} />
      <Button title="Register" onPress={() => navigation.navigate('Register')} />
    </View>
  );
}
