import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import styles, { colors } from '../styles';

export default function Loading({ size = 'small', text = 'Loading...' }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <ActivityIndicator size={size} color={colors.primary} />
      {text ? <Text style={{ marginLeft: 8, color: colors.textMuted }}>{text}</Text> : null}
    </View>
  );
}
