// Native version - uses react-native-maps with Google Maps
import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

interface MapViewProps {
  location: {
    latitude: number;
    longitude: number;
  } | null;
  style?: any;
  children?: React.ReactNode;
  onMapReady?: () => void;
  showsUserLocation?: boolean;
  markers?: Array<{
    id: string;
    latitude: number;
    longitude: number;
    title?: string;
    type?: 'customer' | 'washer';
  }>;
}

export interface MapViewHandle {
  animateToRegion: (region: Region) => void;
}

const MapViewComponent = forwardRef<MapViewHandle, MapViewProps>((
  { location, style, onMapReady, showsUserLocation = true, markers = [] },
  ref
) => {
  const mapRef = useRef<MapView>(null);

  useImperativeHandle(ref, () => ({
    animateToRegion: (region: Region) => {
      mapRef.current?.animateToRegion(region, 500);
    },
  }));

  useEffect(() => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        ...location,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    }
  }, [location]);

  if (!location) {
    return <View style={[styles.fallback, style]} />;
  }

  return (
    <MapView
      ref={mapRef}
      style={[styles.map, style]}
      provider={PROVIDER_GOOGLE}
      initialRegion={{
        ...location,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={false}
      onMapReady={onMapReady}
      customMapStyle={darkMapStyle}
    >
      {/* Main location marker */}
      <Marker coordinate={location}>
        <View style={styles.markerContainer}>
          <View style={styles.marker}>
            <Ionicons name="car" size={24} color="#FFF" />
          </View>
          <View style={styles.markerShadow} />
        </View>
      </Marker>

      {/* Additional markers */}
      {markers.map((marker) => (
        <Marker
          key={marker.id}
          coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
          title={marker.title}
        >
          <View style={styles.markerContainer}>
            <View style={[
              styles.marker,
              marker.type === 'washer' && styles.washerMarker
            ]}>
              <Ionicons 
                name={marker.type === 'washer' ? 'water' : 'location'} 
                size={20} 
                color="#FFF" 
              />
            </View>
          </View>
        </Marker>
      ))}
    </MapView>
  );
});

// Dark map style for consistent look
const darkMapStyle = [
  {
    "elementType": "geometry",
    "stylers": [{ "color": "#212121" }]
  },
  {
    "elementType": "labels.icon",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#757575" }]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [{ "color": "#212121" }]
  },
  {
    "featureType": "administrative",
    "elementType": "geometry",
    "stylers": [{ "color": "#757575" }]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#757575" }]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry",
    "stylers": [{ "color": "#181818" }]
  },
  {
    "featureType": "road",
    "elementType": "geometry.fill",
    "stylers": [{ "color": "#2c2c2c" }]
  },
  {
    "featureType": "road",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#8a8a8a" }]
  },
  {
    "featureType": "road.arterial",
    "elementType": "geometry",
    "stylers": [{ "color": "#373737" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [{ "color": "#3c3c3c" }]
  },
  {
    "featureType": "road.highway.controlled_access",
    "elementType": "geometry",
    "stylers": [{ "color": "#4e4e4e" }]
  },
  {
    "featureType": "transit",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#757575" }]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{ "color": "#000000" }]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#3d3d3d" }]
  }
];

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
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#00D4AA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  washerMarker: {
    backgroundColor: '#007AFF',
    shadowColor: '#007AFF',
  },
  markerShadow: {
    width: 20,
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
    marginTop: 4,
  },
});

export default MapViewComponent;
