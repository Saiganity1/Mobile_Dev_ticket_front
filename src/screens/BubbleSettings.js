import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import styles, { colors, useThemedStyles } from '../styles';

export default function BubbleSettings({ navigation }) {
  const { s } = useThemedStyles();
  const [userBg, setUserBg] = useState('');
  const [userText, setUserText] = useState('');
  const [adminBg, setAdminBg] = useState('');
  const [adminText, setAdminText] = useState('');

  useEffect(() => {
    (async () => {
      const ub = await AsyncStorage.getItem('bubbleUser');
      const at = await AsyncStorage.getItem('bubbleUserText');
      const ab = await AsyncStorage.getItem('bubbleAdmin');
      const atx = await AsyncStorage.getItem('bubbleAdminText');
      if (ub) setUserBg(ub);
      if (at) setUserText(at);
      if (ab) setAdminBg(ab);
      if (atx) setAdminText(atx);
    })();
  }, []);

  const save = async () => {
    try {
      await AsyncStorage.setItem('bubbleUser', userBg || '');
      await AsyncStorage.setItem('bubbleUserText', userText || '');
      await AsyncStorage.setItem('bubbleAdmin', adminBg || '');
      await AsyncStorage.setItem('bubbleAdminText', adminText || '');
      Alert.alert('Saved', 'Bubble preferences saved.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Failed to save preferences');
    }
  };

  return (
    <View style={s.container}>
      <Text style={s.header}>Bubble Settings</Text>

      <Text style={s.subText}>User bubble background (hex)</Text>
      <TextInput value={userBg} onChangeText={setUserBg} style={s.input} placeholder="#e6f7ff" />
      <Text style={s.subText}>User bubble text color (hex)</Text>
      <TextInput value={userText} onChangeText={setUserText} style={s.input} placeholder="#0b2f6b" />

      <Text style={s.subText}>Admin bubble background (hex)</Text>
      <TextInput value={adminBg} onChangeText={setAdminBg} style={s.input} placeholder="#2b6cb0" />
      <Text style={s.subText}>Admin bubble text color (hex)</Text>
      <TextInput value={adminText} onChangeText={setAdminText} style={s.input} placeholder="#ffffff" />

      <TouchableOpacity onPress={save} style={s.button}><Text style={s.buttonText}>Save</Text></TouchableOpacity>
    </View>
  );
}
