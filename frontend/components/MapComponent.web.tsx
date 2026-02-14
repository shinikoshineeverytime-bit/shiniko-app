// Web version - no native maps
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MapComponentProps {
  location: {
    latitude: number;
    longitude: number;
  } | null;
  onMapRef?: (ref: any) => void;
}

export default function MapComponent({ location }: MapComponentProps) {
  return (
    <View style={styles.webMapContainer}>
      <View style={styles.webMapContent}>
        <View style={styles.mapIconBg}>
          <Ionicons name="location" size={48} color="#00D4AA" />
        </View>
        <Text style={styles.webMapTitle}>Your Location</Text>
        {location && (
          <Text style={styles.webMapCoords}>
            {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
          </Text>
        )}
        <View style={styles.pulseContainer}>
          <View style={styles.webPulse} />
          <View style={styles.webPulseOuter} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webMapContainer: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webMapContent: {
    alignItems: 'center',
    padding: 32,
  },
  mapIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(0, 212, 170, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webMapTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 24,
  },
  webMapCoords: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    fontFamily: 'monospace',
  },
  pulseContainer: {
    marginTop: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webPulse: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#00D4AA',
  },
  webPulseOuter: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 212, 170, 0.3)',
  },
});
