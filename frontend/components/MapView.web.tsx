// Web version - simplified map view without native maps
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MapViewProps {
  location: {
    latitude: number;
    longitude: number;
  } | null;
  style?: any;
  children?: React.ReactNode;
  onMapReady?: () => void;
  mapRef?: React.RefObject<any>;
}

export default function MapViewComponent({ location, style }: MapViewProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.content}>
        <View style={styles.iconBg}>
          <Ionicons name="location" size={48} color="#00D4AA" />
        </View>
        <Text style={styles.title}>Your Location</Text>
        {location && (
          <Text style={styles.coords}>
            {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
          </Text>
        )}
        <View style={styles.pulseContainer}>
          <View style={styles.pulseOuter} />
          <View style={styles.pulse} />
        </View>
        <Text style={styles.hint}>Maps available on mobile app</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    padding: 32,
  },
  iconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(0, 212, 170, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 24,
  },
  coords: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    fontFamily: 'monospace',
  },
  pulseContainer: {
    marginTop: 32,
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
  },
  pulse: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#00D4AA',
  },
  pulseOuter: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 212, 170, 0.3)',
  },
  hint: {
    marginTop: 24,
    fontSize: 12,
    color: '#666',
  },
});
