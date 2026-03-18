import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
      <View style={styles.container}>
        <LinearGradient
          colors={['#0a0a0a', '#111111', '#0d0d0d']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00D4AA" />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Background */}
      <LinearGradient
        colors={['#0a0a0a', '#0f0f0f', '#0a0a0a']}
        style={StyleSheet.absoluteFill}
      />
      
      <SafeAreaView style={styles.safeArea}>
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
              <View style={styles.cardWrapper}>
                <LinearGradient
                  colors={['#1a1a1a', '#141414']}
                  style={styles.card}
                >
                  <View style={styles.locationIconContainer}>
                    <LinearGradient
                      colors={['rgba(0, 212, 170, 0.2)', 'rgba(0, 212, 170, 0.05)']}
                      style={styles.iconGradient}
                    >
                      <Icon name="location" size={22} color="#00D4AA" />
                    </LinearGradient>
                  </View>
                  <Text style={styles.locationText} numberOfLines={2}>{address}</Text>
                </LinearGradient>
              </View>
            </View>

            {activeJob ? (
              // Active Job View
              <View style={styles.section}>
                <View style={styles.cardWrapper}>
                  <LinearGradient
                    colors={['#1a1a1a', '#141414']}
                    style={styles.activeJobCard}
                  >
                    {/* Glow effect */}
                    <View style={[styles.cardGlow, { backgroundColor: getStatusDisplay(activeJob.status).color + '10' }]} />
                    
                    <View style={[styles.statusBadge, { backgroundColor: getStatusDisplay(activeJob.status).color + '15' }]}>
                      <Icon name={getStatusDisplay(activeJob.status).icon as any} size={18} color={getStatusDisplay(activeJob.status).color} />
                      <Text style={[styles.statusText, { color: getStatusDisplay(activeJob.status).color }]}>
                        {getStatusDisplay(activeJob.status).text}
                      </Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.jobInfoRow}>
                      <View>
                        <Text style={styles.jobCarReg}>{activeJob.vehicle?.registration}</Text>
                        <Text style={styles.jobCarColour}>{activeJob.vehicle?.colour}</Text>
                      </View>
                      <Text style={styles.jobPrice}>£25</Text>
                    </View>

                    {activeJob.washer_name && (
                      <>
                        <View style={styles.divider} />
                        <View style={styles.washerInfo}>
                          <Icon name="person" size={16} color="#666" />
                          <Text style={styles.washerName}>{activeJob.washer_name}</Text>
                        </View>
                      </>
                    )}

                    {(activeJob.status === 'accepted' || activeJob.status === 'in_progress') && (
                      <TouchableOpacity 
                        style={styles.chatButtonWrapper}
                        onPress={() => router.push(`/chat/${activeJob.id}`)}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={['#007AFF', '#0066DD']}
                          style={styles.chatButton}
                        >
                          <Icon name="chatbubble" size={20} color="#FFF" />
                          <Text style={styles.chatButtonText}>Message Washer</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}

                    {activeJob.status === 'requested' && (
                      <TouchableOpacity style={styles.cancelButton} onPress={cancelJob} activeOpacity={0.7}>
                        <Text style={styles.cancelButtonText}>Cancel Booking</Text>
                      </TouchableOpacity>
                    )}
                  </LinearGradient>
                </View>
              </View>
            ) : (
              // Booking Form
              <>
                {/* Car Details Section */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>YOUR CAR</Text>
                  
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      placeholder="Registration (e.g. AB12 CDE)"
                      placeholderTextColor="#4a4a4a"
                      value={carReg}
                      onChangeText={setCarReg}
                      autoCapitalize="characters"
                    />
                  </View>

                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      placeholder="Colour (e.g. Black, White, Silver)"
                      placeholderTextColor="#4a4a4a"
                      value={carColour}
                      onChangeText={setCarColour}
                      autoCapitalize="words"
                    />
                  </View>
                </View>

                {/* Service Section */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>SERVICE</Text>
                  <View style={styles.cardWrapper}>
                    <LinearGradient
                      colors={['#1a1a1a', '#141414']}
                      style={styles.serviceCard}
                    >
                      <View style={styles.serviceIconContainer}>
                        <LinearGradient
                          colors={['rgba(0, 212, 170, 0.25)', 'rgba(0, 212, 170, 0.08)']}
                          style={styles.serviceIconGradient}
                        >
                          <Icon name="water" size={26} color="#00D4AA" />
                        </LinearGradient>
                      </View>
                      <View style={styles.serviceInfo}>
                        <Text style={styles.serviceName}>Exterior Wash</Text>
                        <Text style={styles.serviceDesc}>Full exterior hand wash & dry</Text>
                      </View>
                      <Text style={styles.servicePrice}>£25</Text>
                    </LinearGradient>
                  </View>
                </View>

                {/* Book Button */}
                <View style={styles.section}>
                  <TouchableOpacity
                    style={styles.bookButtonWrapper}
                    onPress={handleBook}
                    disabled={booking}
                    activeOpacity={0.9}
                  >
                    <LinearGradient
                      colors={booking ? ['#1a1a1a', '#1a1a1a'] : ['#00D4AA', '#00B894']}
                      style={styles.bookButton}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      {/* Glow behind button */}
                      <View style={styles.buttonGlow} />
                      
                      {booking ? (
                        <ActivityIndicator color="#666" size="small" />
                      ) : (
                        <Text style={styles.bookButtonText}>Book Now • £25</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  safeArea: {
    flex: 1,
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
    paddingTop: 8,
    paddingBottom: 12,
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
    paddingTop: 8,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#555',
    letterSpacing: 2,
    marginBottom: 14,
    marginLeft: 4,
  },
  cardWrapper: {
    borderRadius: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)',
      },
    }),
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  locationIconContainer: {
    width: 48,
    height: 48,
  },
  iconGradient: {
    flex: 1,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationText: {
    flex: 1,
    fontSize: 16,
    color: '#FFF',
    fontWeight: '500',
  },
  inputWrapper: {
    marginBottom: 12,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
      },
    }),
  },
  input: {
    backgroundColor: '#161616',
    borderRadius: 16,
    padding: 18,
    fontSize: 16,
    color: '#FFF',
    minHeight: 58,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  serviceIconContainer: {
    width: 56,
    height: 56,
  },
  serviceIconGradient: {
    flex: 1,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  serviceDesc: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  servicePrice: {
    fontSize: 28,
    fontWeight: '700',
    color: '#00D4AA',
  },
  bookButtonWrapper: {
    borderRadius: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#00D4AA',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 8px 32px rgba(0, 212, 170, 0.3)',
      },
    }),
  },
  bookButton: {
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    minHeight: 66,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  buttonGlow: {
    position: 'absolute',
    top: -20,
    left: '30%',
    width: '40%',
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
  },
  bookButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0a0a0a',
  },
  activeJobCard: {
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    overflow: 'hidden',
  },
  cardGlow: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 18,
  },
  jobInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  jobCarReg: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
  },
  jobCarColour: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  jobPrice: {
    fontSize: 26,
    fontWeight: '700',
    color: '#00D4AA',
  },
  washerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  washerName: {
    fontSize: 15,
    color: '#888',
  },
  chatButtonWrapper: {
    marginTop: 18,
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 4px 16px rgba(0, 122, 255, 0.3)',
      },
    }),
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    padding: 16,
    gap: 10,
    minHeight: 56,
  },
  chatButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  cancelButton: {
    alignItems: 'center',
    padding: 16,
    marginTop: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    color: '#FF3B30',
    fontWeight: '600',
  },
});
