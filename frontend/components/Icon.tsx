import React from 'react';
import { Platform, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Map of icon names to emoji fallbacks for web
const EMOJI_MAP: Record<string, string> = {
  'car-sport': '🚗',
  'car': '🚗',
  'water': '💧',
  'navigate': '📍',
  'chevron-forward': '›',
  'chevron-down': '▼',
  'chevron-up': '▲',
  'arrow-back': '←',
  'arrow-forward': '→',
  'close': '✕',
  'checkmark': '✓',
  'checkmark-circle': '✓',
  'location': '📍',
  'locate': '◎',
  'person': '👤',
  'log-out-outline': '↪',
  'camera': '📷',
  'add': '+',
  'add-circle-outline': '⊕',
  'time': '⏱',
  'star-outline': '☆',
  'pencil': '✏',
  'trash-outline': '🗑',
  'chatbubble': '💬',
  'chatbubbles-outline': '💬',
  'call': '📞',
  'list': '☰',
  'map': '🗺',
  'star': '⭐',
  'globe-outline': '🌐',
  'mail-outline': '✉',
  'cash-outline': '💵',
  'time-outline': '🕐',
  'wifi': '📶',
  'cafe': '☕',
  'snow': '❄',
  'card': '💳',
  'logo-apple': '🍎',
  'briefcase': '💼',
  'lock-closed': '🔒',
  'send': '➤',
  'flash': '⚡',
};

interface IconProps {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  color?: string;
  style?: any;
}

export default function Icon({ name, size = 24, color = '#FFF', style }: IconProps) {
  // On web, use emoji fallback
  if (Platform.OS === 'web') {
    const emoji = EMOJI_MAP[name as string] || '•';
    return (
      <Text style={[{ fontSize: size * 0.8, color, textAlign: 'center' }, style]}>
        {emoji}
      </Text>
    );
  }
  
  // On native, use Ionicons
  return <Ionicons name={name} size={size} color={color} style={style} />;
}
