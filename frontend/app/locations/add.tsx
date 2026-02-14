import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import * as Location from 'expo-location';
import Icon from '../../components/Icon';
import { router } from 'expo-router';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Service {
  name: string;
  price: string;
  description: string;
}

export default function AddLocationScreen() {
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  
  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [amenities, setAmenities] = useState<string[]>([]);
  const [services, setServices] = useState<Service[]>([{ name: '', price: '', description: '' }]);

  const amenityOptions = [
    'WiFi', 'Waiting Area', 'Coffee', 'Air Conditioning', 
    'Restrooms', 'Vending Machines', 'TV', 'Kids Area'
  ];

  const getCurrentLocation = async () => {
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLatitude(loc.coords.latitude.toString());
      setLongitude(loc.coords.longitude.toString());

      // Try to get address
      try {
        const [addressResult] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (addressResult) {
          const addr = [
            addressResult.streetNumber,
            addressResult.street,
            addressResult.city,
            addressResult.region,
            addressResult.postalCode,
          ].filter(Boolean).join(', ');
          setAddress(addr);
        }
      } catch (e) {
        console.log('Could not get address');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to get location');
    } finally {
      setGettingLocation(false);
    }
  };

  const toggleAmenity = (amenity: string) => {
    if (amenities.includes(amenity)) {
      setAmenities(amenities.filter(a => a !== amenity));
    } else {
      setAmenities([...amenities, amenity]);
    }
  };

  const addService = () => {
    setServices([...services, { name: '', price: '', description: '' }]);
  };

  const updateService = (index: number, field: keyof Service, value: string) => {
    const updated = [...services];
    updated[index][field] = value;
    setServices(updated);
  };

  const removeService = (index: number) => {
    if (services.length > 1) {
      setServices(services.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a business name');
      return;
    }

    if (!latitude || !longitude) {
      Alert.alert('Required', 'Please set the location');
      return;
    }

    setLoading(true);
    try {
      const validServices = services
        .filter(s => s.name.trim() && s.price.trim())
        .map(s => ({
          name: s.name.trim(),
          price: parseFloat(s.price) || 0,
          description: s.description.trim() || null,
        }));

      await axios.post(`${API_URL}/api/locations`, {
        name: name.trim(),
        description: description.trim() || null,
        location: {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          address: address.trim() || null,
        },
        phone: phone.trim() || null,
        email: email.trim() || null,
        website: website.trim() || null,
        amenities,
        services: validServices,
        payment_methods: ['Cash', 'Card'],
      });

      Alert.alert('Success!', 'Your car wash has been listed!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error creating location:', error);
      Alert.alert('Error', 'Failed to create listing. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Icon name="close" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Car Wash</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Business Name */}
          <Text style={styles.sectionTitle}>Business Details</Text>
          <TextInput
            style={styles.input}
            placeholder="Business Name *"
            placeholderTextColor="#666"
            value={name}
            onChangeText={setName}
          />

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Description (optional)"
            placeholderTextColor="#666"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />

          {/* Location */}
          <Text style={styles.sectionTitle}>Location</Text>
          <TouchableOpacity style={styles.locationButton} onPress={getCurrentLocation}>
            {gettingLocation ? (
              <ActivityIndicator color="#00D4AA" />
            ) : (
              <>
                <Icon name="locate" size={20} color="#00D4AA" />
                <Text style={styles.locationButtonText}>Use Current Location</Text>
              </>
            )}
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Address"
            placeholderTextColor="#666"
            value={address}
            onChangeText={setAddress}
          />

          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="Latitude *"
              placeholderTextColor="#666"
              value={latitude}
              onChangeText={setLatitude}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="Longitude *"
              placeholderTextColor="#666"
              value={longitude}
              onChangeText={setLongitude}
              keyboardType="numeric"
            />
          </View>

          {/* Contact */}
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            placeholderTextColor="#666"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#666"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Website"
            placeholderTextColor="#666"
            value={website}
            onChangeText={setWebsite}
            autoCapitalize="none"
          />

          {/* Services */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Services & Pricing</Text>
            <TouchableOpacity onPress={addService}>
              <Icon name="add-circle" size={24} color="#00D4AA" />
            </TouchableOpacity>
          </View>

          {services.map((service, index) => (
            <View key={index} style={styles.serviceCard}>
              <View style={styles.serviceHeader}>
                <Text style={styles.serviceNumber}>Service {index + 1}</Text>
                {services.length > 1 && (
                  <TouchableOpacity onPress={() => removeService(index)}>
                    <Icon name="trash-outline" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                style={styles.serviceInput}
                placeholder="Service Name (e.g., Basic Wash)"
                placeholderTextColor="#666"
                value={service.name}
                onChangeText={(v) => updateService(index, 'name', v)}
              />
              <TextInput
                style={styles.serviceInput}
                placeholder="Price ($)"
                placeholderTextColor="#666"
                value={service.price}
                onChangeText={(v) => updateService(index, 'price', v)}
                keyboardType="numeric"
              />
            </View>
          ))}

          {/* Amenities */}
          <Text style={styles.sectionTitle}>Amenities</Text>
          <View style={styles.amenitiesGrid}>
            {amenityOptions.map((amenity) => (
              <TouchableOpacity
                key={amenity}
                style={[
                  styles.amenityChip,
                  amenities.includes(amenity) && styles.amenityChipSelected
                ]}
                onPress={() => toggleAmenity(amenity)}
              >
                <Text style={[
                  styles.amenityChipText,
                  amenities.includes(amenity) && styles.amenityChipTextSelected
                ]}>
                  {amenity}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0A0A0A" />
            ) : (
              <>
                <Icon name="checkmark" size={24} color="#0A0A0A" />
                <Text style={styles.submitButtonText}>Create Listing</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
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
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 20,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFF',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    marginBottom: 12,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 212, 170, 0.15)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    gap: 8,
  },
  locationButtonText: {
    color: '#00D4AA',
    fontWeight: '600',
    fontSize: 16,
  },
  serviceCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceNumber: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
  },
  serviceInput: {
    backgroundColor: '#0A0A0A',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#FFF',
    marginBottom: 8,
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amenityChip: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  amenityChipSelected: {
    backgroundColor: 'rgba(0, 212, 170, 0.15)',
    borderColor: '#00D4AA',
  },
  amenityChipText: {
    color: '#888',
    fontSize: 14,
  },
  amenityChipTextSelected: {
    color: '#00D4AA',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D4AA',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 8,
    marginTop: 24,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0A0A0A',
  },
});
