import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Message {
  id: string;
  job_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  message: string;
  is_quick_action: boolean;
  created_at: string;
}

interface QuickAction {
  id: string;
  message: string;
}

export default function ChatScreen() {
  const { jobId, otherName } = useLocalSearchParams();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    fetchMessages();
    fetchQuickActions();
    
    // Poll for new messages
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [jobId]);

  const fetchMessages = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/jobs/${jobId}/messages`);
      setMessages(response.data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchQuickActions = async () => {
    if (!user) return;
    try {
      const response = await axios.get(`${API_URL}/api/chat/quick-actions?role=${user.role}`);
      setQuickActions(response.data);
    } catch (error) {
      console.error('Error fetching quick actions:', error);
    }
  };

  const sendMessage = async (text: string, isQuickAction: boolean = false) => {
    if (!text.trim() || !user) return;
    
    setSending(true);
    try {
      await axios.post(`${API_URL}/api/jobs/${jobId}/messages`, {
        sender_id: user.id,
        sender_name: user.name,
        sender_role: user.role,
        message: text.trim(),
        is_quick_action: isQuickAction,
      });
      setInputText('');
      fetchMessages();
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleQuickAction = (action: QuickAction) => {
    sendMessage(action.message, true);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === user?.id;
    
    return (
      <View style={[styles.messageContainer, isMe && styles.messageContainerMe]}>
        <View style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleOther]}>
          {!isMe && (
            <Text style={styles.senderName}>{item.sender_name}</Text>
          )}
          <Text style={[styles.messageText, isMe && styles.messageTextMe]}>
            {item.message}
          </Text>
          <Text style={[styles.messageTime, isMe && styles.messageTimeMe]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  const renderEmptyChat = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="chatbubbles-outline" size={64} color="#333" />
      <Text style={styles.emptyTitle}>Start the conversation</Text>
      <Text style={styles.emptySubtitle}>Send a message or use quick actions below</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00D4AA" />
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
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{otherName || 'Chat'}</Text>
          <Text style={styles.headerSubtitle}>
            {user?.role === 'customer' ? 'Your Washer' : 'Customer'}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          ListEmptyComponent={renderEmptyChat}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Quick Actions */}
        {showQuickActions && quickActions.length > 0 && (
          <View style={styles.quickActionsContainer}>
            <View style={styles.quickActionsHeader}>
              <Text style={styles.quickActionsTitle}>Quick Messages</Text>
              <TouchableOpacity onPress={() => setShowQuickActions(false)}>
                <Ionicons name="chevron-down" size={20} color="#888" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={quickActions}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.quickActionButton}
                  onPress={() => handleQuickAction(item)}
                >
                  <Text style={styles.quickActionText}>{item.message}</Text>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.quickActionsList}
            />
          </View>
        )}

        {/* Collapsed Quick Actions Toggle */}
        {!showQuickActions && (
          <TouchableOpacity 
            style={styles.quickActionsToggle}
            onPress={() => setShowQuickActions(true)}
          >
            <Ionicons name="flash" size={18} color="#00D4AA" />
            <Text style={styles.quickActionsToggleText}>Quick Messages</Text>
            <Ionicons name="chevron-up" size={18} color="#00D4AA" />
          </TouchableOpacity>
        )}

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#666"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#0A0A0A" />
            ) : (
              <Ionicons name="send" size={20} color="#0A0A0A" />
            )}
          </TouchableOpacity>
        </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  keyboardView: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  messageContainer: {
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  messageContainerMe: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  messageBubbleOther: {
    backgroundColor: '#1A1A1A',
    borderBottomLeftRadius: 4,
  },
  messageBubbleMe: {
    backgroundColor: '#00D4AA',
    borderBottomRightRadius: 4,
  },
  senderName: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#FFF',
    lineHeight: 22,
  },
  messageTextMe: {
    color: '#0A0A0A',
  },
  messageTime: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  messageTimeMe: {
    color: 'rgba(10, 10, 10, 0.6)',
  },
  quickActionsContainer: {
    backgroundColor: '#1A1A1A',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    paddingTop: 12,
  },
  quickActionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  quickActionsTitle: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
  },
  quickActionsList: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  quickActionButton: {
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#3A3A3A',
  },
  quickActionText: {
    color: '#FFF',
    fontSize: 14,
  },
  quickActionsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: '#1A1A1A',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  quickActionsToggleText: {
    color: '#00D4AA',
    fontSize: 13,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#0A0A0A',
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: '#FFF',
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#00D4AA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#2A2A2A',
  },
});
