import React, { createContext, useContext, useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity, Text, View } from 'react-native';

// Elegant, muted palette
export const colors = {
  primary: '#0f172a', // near-black navy for strong anchors
  accent: '#7c3aed', // vivid indigo
  highlight: '#06b6d4', // cyan highlight
  background: '#f6f7fb',
  surface: '#ffffff',
  muted: '#eef2ff',
  subtle: '#f1f5f9',
  text: '#0b1220',
  textMuted: '#6b7280',
  success: '#059669',
  danger: '#ef4444'
};

const buildGlobal = (t) => StyleSheet.create({
  container: { flex: 1, padding: t.spacing.container || 18, backgroundColor: t.colors.background },
  card: { backgroundColor: t.colors.surface, borderRadius: 14, padding: t.spacing.card || 16, marginBottom: 12, shadowColor: '#0b1220', shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },
  header: { fontSize: 20, fontWeight: '800', color: t.colors.text, letterSpacing: 0.2 },
  subHeader: { fontSize: 15, fontWeight: '600', color: t.colors.textMuted },
  subText: { fontSize: 13, color: t.colors.textMuted },
  smallText: { fontSize: 12, color: t.colors.textMuted },
  input: { borderWidth: 1, borderColor: t.colors.subtle || '#eef2ff', backgroundColor: t.colors.surface, padding: 12, borderRadius: 10, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  spaceSmall: { height: 10 },
  pillContainer: { flexDirection: 'row', backgroundColor: t.colors.subtle, borderRadius: 26, padding: 6 },
  pill: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, marginRight: 8 },
  pillText: { fontWeight: '700' },
  button: { backgroundColor: t.colors.primary, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
  // userPanel specific tokens
  userPanel: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: t.colors.surface, borderRadius: 12, shadowColor: '#0b1220', shadowOpacity: 0.04, shadowRadius: 8, elevation: 3 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: t.colors.subtle, marginRight: 12 },
  userName: { fontSize: 16, fontWeight: '800', color: t.colors.text },
  userMeta: { fontSize: 13, color: t.colors.textMuted }
  ,
  // chat tokens
  chat: {
    list: { flex: 1 },
    bubbleIncoming: { backgroundColor: t.colors.surface, color: t.colors.text, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, maxWidth: '80%', borderColor: t.colors.subtle, borderWidth: 1 },
    bubbleOutgoing: { backgroundColor: t.colors.highlight, color: '#fff', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, maxWidth: '80%' },
    bubbleMeta: { fontSize: 11, color: t.colors.textMuted, marginTop: 6 },
    inputBar: { flexDirection: 'row', alignItems: 'center', padding: 10, borderTopWidth: 1, borderTopColor: t.colors.subtle, backgroundColor: t.colors.surface },
    inputField: { flex: 1, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: t.colors.background, borderRadius: 8, marginRight: 8 },
    sendButton: { backgroundColor: t.colors.accent, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 },
    attachmentPreview: { padding: 8, backgroundColor: t.colors.subtle, borderRadius: 8, marginRight: 8 }
  }
});

// Theme context and provider
const defaultTheme = {
  colors,
  spacing: { container: 16, card: 12 }
};

const ThemeContext = createContext({ theme: defaultTheme, setTheme: () => {} });

export function ThemeProvider({ children, initialTheme }) {
  const [theme, setTheme] = useState(initialTheme || defaultTheme);
  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  return ctx ? ctx.theme : defaultTheme;
}

export function useThemedStyles() {
  const theme = useTheme();
  const s = useMemo(() => buildGlobal(theme), [theme]);
  return { s, theme };
}

// backward-compatible global and PillToggle for existing imports
export const global = buildGlobal(defaultTheme);

export function PillToggle({ options = [], value, onChange }) {
  return (
    <View style={global.pillContainer}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt.value}
          onPress={() => onChange(opt.value)}
          style={[global.pill, { backgroundColor: value === opt.value ? colors.primary : 'transparent' }]}
        >
          <Text style={[global.pillText, { color: value === opt.value ? '#fff' : colors.primary }]}>{opt.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// default export
export default { colors, buildGlobal, ThemeProvider, useTheme, useThemedStyles, global, PillToggle };
