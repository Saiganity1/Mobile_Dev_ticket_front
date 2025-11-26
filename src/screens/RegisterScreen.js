import React, { useState } from 'react';
import { View, TextInput, Button, Text, Alert } from 'react-native';
import styles, { global, colors } from '../styles';
import Loading from '../components/Loading';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const API_BASE = Platform.OS === 'web'
  ? `http://${window.location.hostname}:8000/api`
  : 'http://127.0.0.1:8000/api';

export default function RegisterScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const register = async () => {
    if (!username || !firstName || !lastName || !email || !password) {
      Alert.alert('All fields are required');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/register/`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ username, first_name: firstName, last_name: lastName, email, password }),
      });
      const text = await res.text();
      let data = {};
      try { data = JSON.parse(text); } catch (e) { data = { detail: text }; }
      console.log('Register response status', res.status, 'body', data);
      if (res.ok) {
        const data = await res.json();
        await AsyncStorage.setItem('authToken', data.token);
        if (data.user_id) await AsyncStorage.setItem('userId', String(data.user_id));
        navigation.replace('Home');
      } else {
      }
    } catch (e) {
      console.log('Register error', e);
      Alert.alert('Network error', String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={global.container}>
      <View style={global.card}>
        <Text style={global.header}>Register</Text>
        <Text style={global.subText}>Create a new account</Text>
        <View style={{ height: 12 }} />
        <Text>Username</Text>
        <TextInput value={username} onChangeText={setUsername} style={global.input} />
        {errors.username && <Text style={{ color: colors.danger }}>{Array.isArray(errors.username) ? errors.username.join(', ') : String(errors.username)}</Text>}
        <Text>First Name</Text>
        <TextInput value={firstName} onChangeText={setFirstName} style={global.input} />
        <Text>Last Name</Text>
        <TextInput value={lastName} onChangeText={setLastName} style={global.input} />
        <Text>Email</Text>
        <TextInput value={email} onChangeText={setEmail} style={global.input} />
        {errors.email && <Text style={{ color: colors.danger }}>{Array.isArray(errors.email) ? errors.email.join(', ') : String(errors.email)}</Text>}
        <Text>Password</Text>
        <TextInput value={password} onChangeText={setPassword} secureTextEntry style={global.input} />
        {errors.password && <Text style={{ color: colors.danger }}>{Array.isArray(errors.password) ? errors.password.join(', ') : String(errors.password)}</Text>}
        <View style={{ height: 12 }} />
        {loading ? <Loading text="Registering..." /> : <Button title="Register" onPress={register} />}
      </View>
    </View>
  );
}
