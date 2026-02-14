import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import axios from 'axios';

const { width, height } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface LocationCoords {
  latitude: number;
  longitude: number;
}

export default function CustomerHomeScreen() {
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [address, setAddress] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [activeJob, setActiveJob] = useState<any>(null);
  const [userId] = useState(() => `customer_${Date.now()}`);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    getLocation();
    checkActiveJob();
  }, []);

  // Poll for job updates
  useEffect(() => {
    if (activeJob && activeJob.status !== 'completed') {
      const interval = setInterval(() => {
        checkActiveJob();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [activeJob]);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use this app');
        setLoading(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const coords = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };
      setLocation(coords);

      // Get address
      const [addressResult] = await Location.reverseGeocodeAsync(coords);
      if (addressResult) {
        const addr = `${addressResult.street || ''} ${addressResult.city || ''}`;
        setAddress(addr.trim() || 'Current Location');
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get your location');
    } finally {
      setLoading(false);
    }
  };

  const checkActiveJob = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/jobs?customer_id=${userId}`);
      const jobs = response.data;
      const active = jobs.find((job: any) => 
        job.status !== 'completed' && job.status !== 'cancelled'
      );
      setActiveJob(active || null);
    } catch (error) {
      console.error('Error checking jobs:', error);
    }
  };

  const requestWash = async () => {
    if (!location) {
      Alert.alert('Error', 'Location not available');
      return;
    }

    setRequesting(true);
    try {
      const response = await axios.post(`${API_URL}/api/jobs`, {
        customer_id: userId,
        customer_name: 'Customer',
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          address: address,
        },
      });
      setActiveJob(response.data);
      Alert.alert('Success', 'Wash request sent! A washer will accept soon.');
    } catch (error) {
      console.error('Error requesting wash:', error);
      Alert.alert('Error', 'Failed to request wash. Please try again.');
    } finally {
      setRequesting(false);
    }
  };

  const cancelJob = async () => {
    if (!activeJob) return;
    
    Alert.alert(
      'Cancel Request',
      'Are you sure you want to cancel this wash request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.put(`${API_URL}/api/jobs/${activeJob.id}/cancel`);
              setActiveJob(null);
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel request');
            }
          },
        },
      ]
    );
  };

  const getStatusInfo = () => {
    if (!activeJob) return null;
    
    switch (activeJob.status) {
      case 'requested':
        return { text: 'Looking for a washer...', color: '#FFB800', icon: 'time' };
      case 'accepted':
        return { text: `${activeJob.washer_name || 'Washer'} is on the way`, color: '#00D4AA', icon: 'car' };
      case 'in_progress':
        return { text: 'Wash in progress', color: '#007AFF', icon: 'water' };
      case 'completed':
        return { text: 'Wash completed!', color: '#00D4AA', icon: 'checkmark-circle' };
      default:
        return null;
    }
  };

  const statusInfo = getStatusInfo();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00D4AA" />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SHINIKO</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        {location && (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_DEFAULT}
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
        )}

        {/* Recenter button */}
        <TouchableOpacity
          style={styles.recenterButton}
          onPress={() => {
            if (location && mapRef.current) {
              mapRef.current.animateToRegion({
                ...location,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              });
            }
          }}
        >
          <Ionicons name="locate" size={24} color="#00D4AA" />
        </TouchableOpacity>
      </View>

      {/* Bottom Panel */}
      <View style={styles.bottomPanel}>
        {/* Location Info */}
        <View style={styles.locationInfo}>
          <Ionicons name="location" size={24} color="#00D4AA" />
          <View style={styles.locationTextContainer}>
            <Text style={styles.locationLabel}>Your Location</Text>
            <Text style={styles.locationAddress} numberOfLines={1}>{address || 'Getting address...'}</Text>
          </View>
        </View>

        {/* Status or Request Button */}
        {activeJob ? (
          <View style={styles.statusContainer}>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo?.color + '20' }]}>
              <Ionicons name={statusInfo?.icon as any} size={20} color={statusInfo?.color} />
              <Text style={[styles.statusText, { color: statusInfo?.color }]}>
                {statusInfo?.text}
              </Text>
            </View>
            
            <View style={styles.jobDetails}>
              <Text style={styles.priceText}>$25.00</Text>
              <Text style={styles.priceLabel}>Exterior Wash</Text>
            </View>

            {activeJob.status === 'requested' && (
              <TouchableOpacity style={styles.cancelButton} onPress={cancelJob}>
                <Text style={styles.cancelButtonText}>Cancel Request</Text>
              </TouchableOpacity>
            )}

            {activeJob.status === 'completed' && (
              <TouchableOpacity 
                style={styles.requestButton} 
                onPress={() => setActiveJob(null)}
              >
                <Text style={styles.requestButtonText}>Done</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            <View style={styles.priceContainer}>
              <Text style={styles.priceText}>$25.00</Text>
              <Text style={styles.priceLabel}>Exterior Car Wash</Text>
            </View>
            
            <TouchableOpacity
              style={styles.requestButton}
              onPress={requestWash}
              disabled={requesting}
            >
              {requesting ? (
                <ActivityIndicator color="#0A0A0A" />
              ) : (
                <>
                  <Ionicons name="water" size={24} color="#0A0A0A" />
                  <Text style={styles.requestButtonText}>Request Wash</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0A0A0A',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 4,
  },
  mapContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
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
  recenterButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  bottomPanel: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  locationTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: '#888',
  },
  locationAddress: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '500',
  },
  priceContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  priceText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFF',
  },
  priceLabel: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D4AA',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 12,
  },
  requestButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0A0A0A',
  },
  statusContainer: {
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  jobDetails: {
    alignItems: 'center',
    marginBottom: 16,
  },
  cancelButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
});
