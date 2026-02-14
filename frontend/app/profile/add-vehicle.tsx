import React, { useState } from 'react';
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
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function AddVehicleScreen() {
  const { user } = useAuth();
  const [registration, setRegistration] = useState('');
  const [colour, setColour] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your camera');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const showPhotoOptions = () => {
    Alert.alert(
      'Add Photo',
      'Choose how to add a photo of your car',
      [
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Gallery', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleSave = async () => {
    if (!registration.trim()) {
      Alert.alert('Required', 'Please enter your car registration');
      return;
    }
    if (!colour.trim()) {
      Alert.alert('Required', 'Please select your car colour');
      return;
    }
    if (!user) return;

    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/users/${user.id}/vehicles`, {
        registration: registration.trim().toUpperCase(),
        colour: colour.trim(),
        make: make.trim() || null,
        model: model.trim() || null,
        year: year ? parseInt(year) : null,
        notes: notes.trim() || null,
        photo: photo || null,
      });
      Alert.alert('Success!', 'Vehicle added to your account', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error adding vehicle:', error);
      Alert.alert('Error', 'Failed to add vehicle. Please try again.');
    } finally {
      setSaving(false);
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
            <Ionicons name="close" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Vehicle</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Photo Section */}
          <TouchableOpacity style={styles.photoSection} onPress={showPhotoOptions}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.photoPreview} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="camera" size={40} color="#666" />
                <Text style={styles.photoPlaceholderText}>Add a photo of your car</Text>
                <Text style={styles.photoHint}>Helps the washer find your car</Text>
              </View>
            )}
            {photo && (
              <View style={styles.changePhotoOverlay}>
                <Ionicons name="camera" size={20} color="#FFF" />
                <Text style={styles.changePhotoText}>Change</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Registration */}
          <Text style={styles.label}>Registration Number *</Text>
          <TextInput
            style={styles.input}
            value={registration}
            onChangeText={setRegistration}
            placeholder="e.g., AB12 CDE"
            placeholderTextColor="#666"
            autoCapitalize="characters"
          />

          {/* Colour */}
          <Text style={styles.label}>Colour *</Text>
          <TextInput
            style={styles.input}
            value={colour}
            onChangeText={setColour}
            placeholder="e.g., White, Black, Silver, Red"
            placeholderTextColor="#666"
          />

          {/* Make & Model */}
          <Text style={styles.label}>Make (optional)</Text>
          <TextInput
            style={styles.input}
            value={make}
            onChangeText={setMake}
            placeholder="e.g., Toyota, BMW, Ford"
            placeholderTextColor="#666"
          />

          <Text style={styles.label}>Model (optional)</Text>
          <TextInput
            style={styles.input}
            value={model}
            onChangeText={setModel}
            placeholder="e.g., Camry, 3 Series, Focus"
            placeholderTextColor="#666"
          />

          <Text style={styles.label}>Year (optional)</Text>
          <TextInput
            style={styles.input}
            value={year}
            onChangeText={setYear}
            placeholder="e.g., 2022"
            placeholderTextColor="#666"
            keyboardType="numeric"
            maxLength={4}
          />

          {/* Notes */}
          <Text style={styles.label}>Extra Info (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any details to help find your car...\ne.g., Parked in bay 5, has roof rack"
            placeholderTextColor="#666"
            multiline
            numberOfLines={3}
          />

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#0A0A0A" />
            ) : (
              <>
                <Ionicons name="checkmark" size={24} color="#0A0A0A" />
                <Text style={styles.saveButtonText}>Add Vehicle</Text>
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
  photoSection: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  photoPlaceholder: {
    height: 180,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#2A2A2A',
    borderStyle: 'dashed',
  },
  photoPlaceholderText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  photoHint: {
    color: '#666',
    fontSize: 13,
    marginTop: 4,
  },
  photoPreview: {
    height: 180,
    width: '100%',
    borderRadius: 16,
  },
  changePhotoOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  changePhotoText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFF',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D4AA',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 8,
    marginTop: 32,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0A0A0A',
  },
});
