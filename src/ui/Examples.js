import React from 'react';
import { View, Text } from 'react-native';
import { PillToggle, Loading } from './index';
import styles, { global } from '../styles';

export default function Examples() {
  const [v, setV] = React.useState('not_complete');
  return (
    <View style={global.container}>
      <Text style={global.header}>UI Kit Examples</Text>
      <View style={{ height: 12 }} />
      <Text style={global.subText}>Pill Toggle</Text>
      <PillToggle options={[{ value: 'not_complete', label: 'Not Complete' }, { value: 'all', label: 'All' }, { value: 'completed', label: 'Completed' }]} value={v} onChange={setV} />
      <View style={{ height: 12 }} />
      <Text style={global.subText}>Loading</Text>
      <Loading text="Example loading..." />
    </View>
  );
}
