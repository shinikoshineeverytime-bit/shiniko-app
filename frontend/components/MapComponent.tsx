import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MapComponentProps {
  location: {
    latitude: number;
    longitude: number;
  } | null;
  onMapRef?: (ref: any) => void;
}

// Native map component - only used on iOS/Android
let NativeMapView: any = null;
let NativeMarker: any = null;

if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    NativeMapView = Maps.default;
    NativeMarker = Maps.Marker;
  } catch (e) {
    console.log('react-native-maps not available');
  }
}

export default function MapComponent({ location, onMapRef }: MapComponentProps) {
  // Web fallback - show a styled location card
  if (Platform.OS === 'web') {
    return (
      <View style={styles.webMapContainer}>
        <View style={styles.webMapContent}>
          <Ionicons name="location" size={48} color="#00D4AA" />
          <Text style={styles.webMapTitle}>Your Location</Text>
          {location && (
            <Text style={styles.webMapCoords}>
              {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </Text>
          )}
          <View style={styles.webPulse} />
        </View>
      </View>
    );
  }

  // Native map for iOS/Android
  if (NativeMapView && location) {
    return (
      <NativeMapView
        ref={onMapRef}
        style={styles.map}
        initialRegion={{
          ...location,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation
        showsMyLocationButton={false}
      >
        <NativeMarker coordinate={location}>
          <View style={styles.markerContainer}>
            <View style={styles.marker}>
              <Ionicons name="car" size={24} color="#FFF" />
            </View>
          </View>
        </NativeMarker>
      </NativeMapView>
    );
  }

  // Fallback if no location yet
  return (
    <View style={styles.webMapContainer}>
      <View style={styles.webMapContent}>
        <Ionicons name="locate" size={48} color="#888" />
        <Text style={styles.webMapTitle}>Getting location...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
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
  webMapTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
    marginTop: 16,
  },
  webMapCoords: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  webPulse: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#00D4AA',
    marginTop: 24,
    opacity: 0.8,
  },
  markerContainer: {
    alignItems: 'center',
  },
  marker: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#00D4AA',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00D4AA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
