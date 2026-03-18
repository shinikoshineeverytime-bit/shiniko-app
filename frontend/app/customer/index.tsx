import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  ScrollView,
  Image,
} from 'react-native';
import * as Location from 'expo-location';
import Icon from '../../components/Icon';
import { router, useFocusEffect } from 'expo-router';
import axios from 'axios';
import MapView, { MapViewHandle } from '../../components/MapView';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface LocationCoords {
  latitude: number;
  longitude: number;
}

interface Vehicle {
  id: string;
  registration: string;
  colour: string;
  make?: string;
  model?: string;
  photo?: string;
  notes?: string;
  is_default: boolean;
}

export default function CustomerHomeScreen() {
  const { user, logout } = useAuth();
  const { notification } = useNotifications(user?.id || null);
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [address, setAddress] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [activeJob, setActiveJob] = useState<any>(null);
  const mapRef = useRef<MapViewHandle>(null);
  
  // Vehicle state
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [showVehicleModal, setShowVehicleModal] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace('/');
      return;
    }
    getLocation();
    checkActiveJob();
    fetchVehicles();
  }, [user]);
  
  // Refetch vehicles when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        fetchVehicles();
      }
    }, [user])
  );
  
  const fetchVehicles = async () => {
    if (!user) return;
    try {
      const response = await axios.get(`${API_URL}/api/users/${user.id}/vehicles`);
      const vehicleList = response.data;
      setVehicles(vehicleList);
      
      // Auto-select default vehicle or first vehicle
      if (vehicleList.length > 0 && !selectedVehicle) {
        const defaultVehicle = vehicleList.find((v: Vehicle) => v.is_default) || vehicleList[0];
        setSelectedVehicle(defaultVehicle);
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    }
  };

  // Refresh when notification received
  useEffect(() => {
    if (notification) {
      checkActiveJob();
    }
  }, [notification]);

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
        setLocation({ latitude: 40.7128, longitude: -74.0060 });
        setAddress('New York, NY (Demo)');
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

      try {
        const [addressResult] = await Location.reverseGeocodeAsync(coords);
        if (addressResult) {
          const addr = `${addressResult.street || ''} ${addressResult.city || ''}`;
          setAddress(addr.trim() || 'Current Location');
        }
      } catch (e) {
        setAddress('Current Location');
      }
    } catch (error) {
      console.error('Error getting location:', error);
      setLocation({ latitude: 40.7128, longitude: -74.0060 });
      setAddress('New York, NY (Demo)');
    } finally {
      setLoading(false);
    }
  };

  const checkActiveJob = async () => {
    if (!user) return;
    try {
      const response = await axios.get(`${API_URL}/api/jobs?customer_id=${user.id}`);
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
    if (!location || !user) {
      Alert.alert('Error', 'Location not available');
      return;
    }
    
    // Check if user has vehicles
    if (vehicles.length === 0) {
      Alert.alert(
        'Vehicle Required',
        'Please add your vehicle information before requesting a wash. This helps the washer find your car.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Vehicle', onPress: () => router.push('/profile/add-vehicle') }
        ]
      );
      return;
    }
    
    // Check if a vehicle is selected
    if (!selectedVehicle) {
      setShowVehicleModal(true);
      return;
    }

    // Navigate to payment screen with all required data
    const vehicleData = {
      registration: selectedVehicle.registration,
      colour: selectedVehicle.colour,
      make: selectedVehicle.make || null,
      model: selectedVehicle.model || null,
      photo: selectedVehicle.photo || null,
      notes: selectedVehicle.notes || null,
    };

    router.push({
      pathname: '/payment',
      params: {
        customerId: user.id,
        customerName: user.name,
        latitude: location.latitude.toString(),
        longitude: location.longitude.toString(),
        address: address,
        vehicle: JSON.stringify(vehicleData),
      },
    });
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

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/');
          },
        },
      ]
    );
  };

  const recenterMap = () => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        ...location,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
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
        <TouchableOpacity onPress={handleLogout} style={styles.headerButton}>
          <Icon name="log-out-outline" size={24} color="#FF3B30" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SHINIKO</Text>
        <TouchableOpacity onPress={() => router.push('/profile')} style={styles.profileButton}>
          <Icon name="person" size={18} color="#00D4AA" />
        </TouchableOpacity>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          location={location}
          style={styles.map}
        />
        <TouchableOpacity style={styles.recenterButton} onPress={recenterMap}>
          <Icon name="locate" size={24} color="#00D4AA" />
        </TouchableOpacity>
      </View>

      {/* Bottom Panel */}
      <View style={styles.bottomPanel}>
        <View style={styles.locationInfo}>
          <Icon name="location" size={24} color="#00D4AA" />
          <View style={styles.locationTextContainer}>
            <Text style={styles.locationLabel}>Your Location</Text>
            <Text style={styles.locationAddress} numberOfLines={1}>{address || 'Getting address...'}</Text>
          </View>
        </View>

        {activeJob ? (
          <View style={styles.statusContainer}>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo?.color + '20' }]}>
              <Icon name={statusInfo?.icon as any} size={20} color={statusInfo?.color} />
              <Text style={[styles.statusText, { color: statusInfo?.color }]}>
                {statusInfo?.text}
              </Text>
            </View>
            
            <View style={styles.jobDetails}>
              <Text style={styles.priceText}>$25.00</Text>
              <Text style={styles.priceLabel}>Exterior Wash</Text>
            </View>

            {/* Chat Button - show when washer is assigned */}
            {(activeJob.status === 'accepted' || activeJob.status === 'in_progress') && activeJob.washer_id && (
              <TouchableOpacity 
                style={styles.chatButton}
                onPress={() => router.push({ 
                  pathname: '/chat/[jobId]', 
                  params: { jobId: activeJob.id, otherName: activeJob.washer_name || 'Washer' } 
                })}
              >
                <Icon name="chatbubble" size={20} color="#FFF" />
                <Text style={styles.chatButtonText}>Message {activeJob.washer_name || 'Washer'}</Text>
              </TouchableOpacity>
            )}

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
            {/* Vehicle Selection */}
            <TouchableOpacity 
              style={styles.vehicleSelector}
              onPress={() => {
                if (vehicles.length === 0) {
                  router.push('/profile/add-vehicle');
                } else {
                  setShowVehicleModal(true);
                }
              }}
            >
              {selectedVehicle ? (
                <View style={styles.selectedVehicle}>
                  {selectedVehicle.photo ? (
                    <Image source={{ uri: selectedVehicle.photo }} style={styles.vehicleThumb} />
                  ) : (
                    <View style={styles.vehicleThumbPlaceholder}>
                      <Icon name="car" size={20} color="#666" />
                    </View>
                  )}
                  <View style={styles.vehicleInfo}>
                    <Text style={styles.vehicleReg}>{selectedVehicle.registration}</Text>
                    <Text style={styles.vehicleDetails}>
                      {[selectedVehicle.colour, selectedVehicle.make].filter(Boolean).join(' • ')}
                    </Text>
                  </View>
                  <Icon name="chevron-down" size={20} color="#888" />
                </View>
              ) : (
                <View style={styles.addVehiclePrompt}>
                  <Icon name="add-circle-outline" size={24} color="#00D4AA" />
                  <Text style={styles.addVehicleText}>Add your vehicle to get started</Text>
                </View>
              )}
            </TouchableOpacity>
          
            <View style={styles.priceContainer}>
              <Text style={styles.priceText}>$25.00</Text>
              <Text style={styles.priceLabel}>Exterior Car Wash</Text>
            </View>
            
            <TouchableOpacity
              style={[styles.requestButton, (!selectedVehicle || vehicles.length === 0) && styles.requestButtonDisabled]}
              onPress={requestWash}
              disabled={requesting}
            >
              {requesting ? (
                <ActivityIndicator color="#0A0A0A" />
              ) : (
                <>
                  <Icon name="water" size={24} color="#0A0A0A" />
                  <Text style={styles.requestButtonText}>Request Wash</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
      
      {/* Vehicle Selection Modal */}
      <Modal
        visible={showVehicleModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowVehicleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Vehicle</Text>
              <TouchableOpacity onPress={() => setShowVehicleModal(false)}>
                <Icon name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.vehicleList}>
              {vehicles.map((vehicle) => (
                <TouchableOpacity
                  key={vehicle.id}
                  style={[
                    styles.vehicleOption,
                    selectedVehicle?.id === vehicle.id && styles.vehicleOptionSelected
                  ]}
                  onPress={() => {
                    setSelectedVehicle(vehicle);
                    setShowVehicleModal(false);
                  }}
                >
                  {vehicle.photo ? (
                    <Image source={{ uri: vehicle.photo }} style={styles.vehicleOptionPhoto} />
                  ) : (
                    <View style={styles.vehicleOptionPhotoPlaceholder}>
                      <Icon name="car" size={24} color="#666" />
                    </View>
                  )}
                  <View style={styles.vehicleOptionInfo}>
                    <Text style={styles.vehicleOptionReg}>{vehicle.registration}</Text>
                    <Text style={styles.vehicleOptionDetails}>
                      {[vehicle.colour, vehicle.make, vehicle.model].filter(Boolean).join(' • ')}
                    </Text>
                  </View>
                  {selectedVehicle?.id === vehicle.id && (
                    <Icon name="checkmark-circle" size={24} color="#00D4AA" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <TouchableOpacity
              style={styles.addVehicleModalButton}
              onPress={() => {
                setShowVehicleModal(false);
                router.push('/profile/add-vehicle');
              }}
            >
              <Icon name="add" size={20} color="#00D4AA" />
              <Text style={styles.addVehicleModalText}>Add New Vehicle</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  headerButton: {
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
  profileButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 212, 170, 0.15)',
    borderRadius: 20,
  },
  mapContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
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
    marginBottom: 16,
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
  // Vehicle selector styles
  vehicleSelector: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  selectedVehicle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  vehicleThumb: {
    width: 50,
    height: 35,
    borderRadius: 6,
    marginRight: 12,
  },
  vehicleThumbPlaceholder: {
    width: 50,
    height: 35,
    borderRadius: 6,
    backgroundColor: '#3A3A3A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleReg: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  vehicleDetails: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  addVehiclePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  addVehicleText: {
    color: '#00D4AA',
    fontSize: 15,
    fontWeight: '600',
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
  requestButtonDisabled: {
    opacity: 0.5,
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
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
    width: '100%',
  },
  chatButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  vehicleList: {
    maxHeight: 300,
  },
  vehicleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    marginBottom: 10,
  },
  vehicleOptionSelected: {
    borderWidth: 2,
    borderColor: '#00D4AA',
  },
  vehicleOptionPhoto: {
    width: 60,
    height: 45,
    borderRadius: 8,
    marginRight: 12,
  },
  vehicleOptionPhotoPlaceholder: {
    width: 60,
    height: 45,
    borderRadius: 8,
    backgroundColor: '#3A3A3A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  vehicleOptionInfo: {
    flex: 1,
  },
  vehicleOptionReg: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  vehicleOptionDetails: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  addVehicleModalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    marginTop: 10,
    gap: 8,
  },
  addVehicleModalText: {
    color: '#00D4AA',
    fontSize: 16,
    fontWeight: '600',
  },
});
