import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import Icon from '../../components/Icon';
import { router } from 'expo-router';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface LocationCoords {
  latitude: number;
  longitude: number;
}

export default function CustomerScreen() {
  const { user, logout } = useAuth();
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [address, setAddress] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [activeJob, setActiveJob] = useState<any>(null);
  
  const [carReg, setCarReg] = useState('');
  const [carColour, setCarColour] = useState('');

  useEffect(() => {
    if (!user) {
      router.replace('/');
      return;
    }
    getLocation();
    checkActiveJob();
  }, [user]);

  useEffect(() => {
    if (activeJob && activeJob.status !== 'completed') {
      const interval = setInterval(checkActiveJob, 5000);
      return () => clearInterval(interval);
    }
  }, [activeJob]);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocation({ latitude: 51.5074, longitude: -0.1278 });
        setAddress('London, UK');
        setLoading(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };
      setLocation(coords);

      try {
        const [addr] = await Location.reverseGeocodeAsync(coords);
        if (addr) {
          const parts = [addr.street, addr.city].filter(Boolean);
          setAddress(parts.join(', ') || 'Current Location');
        }
      } catch {
        setAddress('Current Location');
      }
    } catch (error) {
      setLocation({ latitude: 51.5074, longitude: -0.1278 });
      setAddress('London, UK');
    } finally {
      setLoading(false);
    }
  };

  const checkActiveJob = async () => {
    if (!user) return;
    try {
      const response = await axios.get(`${API_URL}/api/jobs?customer_id=${user.id}`);
      const active = response.data.find(
        (job: any) => !['completed', 'cancelled'].includes(job.status)
      );
      setActiveJob(active || null);
    } catch (error) {
      console.error('Error checking jobs:', error);
    }
  };

  const showAlert = (title: string, message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
      onOk?.();
    } else {
      Alert.alert(title, message, onOk ? [{ text: 'OK', onPress: onOk }] : undefined);
    }
  };

  const handleBook = async () => {
    if (!location || !user) {
      showAlert('Error', 'Location not available');
      return;
    }

    if (!carReg.trim()) {
      showAlert('Car Registration Required', 'Please enter your car registration so the washer can find your car');
      return;
    }

    if (!carColour.trim()) {
      showAlert('Car Colour Required', 'Please enter your car colour');
      return;
    }

    const confirmBooking = (): Promise<boolean> => {
      return new Promise((resolve) => {
        if (Platform.OS === 'web') {
          resolve(window.confirm('Confirm booking?\n\nExterior Car Wash: £25.00'));
        } else {
          Alert.alert(
            'Confirm Booking',
            'Exterior Car Wash: £25.00',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Pay £25', onPress: () => resolve(true) },
            ]
          );
        }
      });
    };

    const confirmed = await confirmBooking();
    if (!confirmed) return;

    setBooking(true);
    try {
      const paymentResponse = await axios.post(`${API_URL}/api/payments/create-intent`, {
        customer_id: user.id,
      });

      await axios.post(`${API_URL}/api/payments/confirm/${paymentResponse.data.payment_intent_id}`);

      const jobResponse = await axios.post(`${API_URL}/api/jobs`, {
        customer_id: user.id,
        customer_name: user.name,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          address: address,
        },
        vehicle: {
          registration: carReg.trim().toUpperCase(),
          colour: carColour.trim(),
        },
        payment_intent_id: paymentResponse.data.payment_intent_id,
      });

      setActiveJob(jobResponse.data);
      showAlert('Booked!', 'A washer will be with you soon');
    } catch (error) {
      console.error('Booking error:', error);
      showAlert('Error', 'Failed to book. Please try again.');
    } finally {
      setBooking(false);
    }
  };

  const cancelJob = async () => {
    if (!activeJob) return;

    const confirmCancel = (): Promise<boolean> => {
      return new Promise((resolve) => {
        if (Platform.OS === 'web') {
          resolve(window.confirm('Cancel this booking?'));
        } else {
          Alert.alert('Cancel Booking', 'Are you sure?', [
            { text: 'No', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Yes, Cancel', style: 'destructive', onPress: () => resolve(true) },
          ]);
        }
      });
    };

    const confirmed = await confirmCancel();
    if (!confirmed) return;

    try {
      await axios.put(`${API_URL}/api/jobs/${activeJob.id}/cancel`);
      setActiveJob(null);
    } catch (error) {
      showAlert('Error', 'Failed to cancel');
    }
  };

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'requested': return { text: 'Finding washer...', color: '#FFB800', icon: 'time' };
      case 'accepted': return { text: 'Washer on the way', color: '#00D4AA', icon: 'car' };
      case 'in_progress': return { text: 'Washing your car', color: '#007AFF', icon: 'water' };
      default: return { text: status, color: '#888', icon: 'time' };
    }
  };

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
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleLogout} style={styles.headerButton}>
            <Icon name="log-out-outline" size={22} color="#FF3B30" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>SHINIKO</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Location Section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>YOUR LOCATION</Text>
            <View style={styles.locationCard}>
              <View style={styles.locationIconContainer}>
                <Icon name="location" size={22} color="#00D4AA" />
              </View>
              <Text style={styles.locationText} numberOfLines={2}>{address}</Text>
            </View>
          </View>

          {activeJob ? (
            // Active Job View
            <View style={styles.section}>
              <View style={styles.activeJobCard}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusDisplay(activeJob.status).color + '15' }]}>
                  <Icon name={getStatusDisplay(activeJob.status).icon as any} size={18} color={getStatusDisplay(activeJob.status).color} />
                  <Text style={[styles.statusText, { color: getStatusDisplay(activeJob.status).color }]}>
                    {getStatusDisplay(activeJob.status).text}
                  </Text>
                </View>

                <View style={styles.jobInfoRow}>
                  <View>
                    <Text style={styles.jobCarReg}>{activeJob.vehicle?.registration}</Text>
                    <Text style={styles.jobCarColour}>{activeJob.vehicle?.colour}</Text>
                  </View>
                  <Text style={styles.jobPrice}>£25</Text>
                </View>

                {activeJob.washer_name && (
                  <View style={styles.washerInfo}>
                    <Icon name="person" size={16} color="#666" />
                    <Text style={styles.washerName}>{activeJob.washer_name}</Text>
                  </View>
                )}

                {(activeJob.status === 'accepted' || activeJob.status === 'in_progress') && (
                  <TouchableOpacity 
                    style={styles.chatButton}
                    onPress={() => router.push(`/chat/${activeJob.id}`)}
                    activeOpacity={0.7}
                  >
                    <Icon name="chatbubble" size={20} color="#FFF" />
                    <Text style={styles.chatButtonText}>Message Washer</Text>
                  </TouchableOpacity>
                )}

                {activeJob.status === 'requested' && (
                  <TouchableOpacity style={styles.cancelButton} onPress={cancelJob} activeOpacity={0.7}>
                    <Text style={styles.cancelButtonText}>Cancel Booking</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            // Booking Form
            <>
              {/* Car Details Section */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>YOUR CAR</Text>
                
                <TextInput
                  style={styles.input}
                  placeholder="Registration (e.g. AB12 CDE)"
                  placeholderTextColor="#555"
                  value={carReg}
                  onChangeText={setCarReg}
                  autoCapitalize="characters"
                />

                <TextInput
                  style={styles.input}
                  placeholder="Colour (e.g. Black, White, Silver)"
                  placeholderTextColor="#555"
                  value={carColour}
                  onChangeText={setCarColour}
                  autoCapitalize="words"
                />
              </View>

              {/* Service Section */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>SERVICE</Text>
                <View style={styles.serviceCard}>
                  <View style={styles.serviceIconContainer}>
                    <Icon name="water" size={24} color="#00D4AA" />
                  </View>
                  <View style={styles.serviceInfo}>
                    <Text style={styles.serviceName}>Exterior Wash</Text>
                    <Text style={styles.serviceDesc}>Full exterior hand wash & dry</Text>
                  </View>
                  <Text style={styles.servicePrice}>£25</Text>
                </View>
              </View>

              {/* Book Button */}
              <View style={styles.section}>
                <TouchableOpacity
                  style={[styles.bookButton, booking && styles.bookButtonDisabled]}
                  onPress={handleBook}
                  disabled={booking}
                  activeOpacity={0.8}
                >
                  {booking ? (
                    <ActivityIndicator color="#0A0A0A" size="small" />
                  ) : (
                    <Text style={styles.bookButtonText}>Book Now • £25</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
    color: '#666',
    marginTop: 16,
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151515',
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  locationIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 212, 170, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationText: {
    flex: 1,
    fontSize: 16,
    color: '#FFF',
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#151515',
    borderRadius: 14,
    padding: 18,
    fontSize: 16,
    color: '#FFF',
    marginBottom: 12,
    minHeight: 56,
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151515',
    borderRadius: 14,
    padding: 18,
    gap: 14,
  },
  serviceIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 212, 170, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
  },
  serviceDesc: {
    fontSize: 13,
    color: '#666',
    marginTop: 3,
  },
  servicePrice: {
    fontSize: 26,
    fontWeight: '700',
    color: '#00D4AA',
  },
  bookButton: {
    backgroundColor: '#00D4AA',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    minHeight: 60,
    justifyContent: 'center',
  },
  bookButtonDisabled: {
    opacity: 0.5,
  },
  bookButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0A0A0A',
  },
  activeJobCard: {
    backgroundColor: '#151515',
    borderRadius: 16,
    padding: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    marginBottom: 20,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '600',
  },
  jobInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  jobCarReg: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
  },
  jobCarColour: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  jobPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: '#00D4AA',
  },
  washerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  washerName: {
    fontSize: 15,
    color: '#888',
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    gap: 10,
    marginBottom: 12,
    minHeight: 54,
  },
  chatButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  cancelButton: {
    alignItems: 'center',
    padding: 14,
    minHeight: 48,
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    color: '#FF3B30',
    fontWeight: '600',
  },
});
