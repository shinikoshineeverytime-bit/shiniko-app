// Native version - uses react-native-maps
import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

interface MapComponentProps {
  location: {
    latitude: number;
    longitude: number;
  } | null;
  onMapRef?: (ref: any) => void;
}

export default function MapComponent({ location, onMapRef }: MapComponentProps) {
  if (!location) {
    return <View style={styles.fallback} />;
  }

  return (
    <MapView
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
      <Marker coordinate={location}>
        <View style={styles.markerContainer}>
          <View style={styles.marker}>
            <Ionicons name="car" size={24} color="#FFF" />
          </View>
        </View>
      </Marker>
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  fallback: {
    flex: 1,
    backgroundColor: '#1A1A1A',
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
