import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { useSocketContext } from '../context/socket-context';

export interface ChatAttachment {
  url: string;
  name: string;
  type: string;
  size: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  attachmentUrl?: string;
  attachments?: ChatAttachment[];
  replyToId?: string;
  replyTo?: {
    id: string;
    content: string;
    sender: { id: string; firstName: string; lastName: string };
  };
  status?: 'SENT' | 'DELIVERED' | 'SEEN';
  isEdited?: boolean;
  editedAt?: string;
  isDeleted?: boolean;
  createdAt: string;
  sender: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string;
  };
}

export interface TypingUser {
  userId: string;
  roomId: string;
  isTyping: boolean;
}

export const useChatSocket = (roomId?: string) => {
  const { chatSocket: socket, isChatConnected } = useSocketContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const socketRef = useRef<Socket | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  // Send message
  const sendMessage = useCallback((
    content: string,
    options?: { attachmentUrl?: string; replyToId?: string; attachments?: ChatAttachment[] }
  ) => {
    if (socket && roomId) {
      socket.emit('send_message', {
        roomId,
        content,
        attachmentUrl: options?.attachmentUrl,
        replyToId: options?.replyToId,
        attachments: options?.attachments ?? [],
      });
    }
  }, [roomId, socket]);

  // Edit message
  const editMessage = useCallback((messageId: string, content: string) => {
    if (socket && roomId) {
      socket.emit('editMessage', { messageId, content, roomId });
    }
  }, [roomId, socket]);

  // Delete message
  const deleteMessage = useCallback((messageId: string) => {
    if (socket && roomId) {
      socket.emit('deleteMessage', { messageId, roomId });
    }
  }, [roomId, socket]);

  // Emit typing
  const emitTyping = useCallback((isTyping: boolean) => {
    if (socket && roomId) {
      socket.emit(isTyping ? 'typing' : 'stop_typing', { roomId });
    }
  }, [roomId, socket]);

  // Handle typing with debounce
  const handleTyping = useCallback(() => {
    emitTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => emitTyping(false), 2000);
  }, [emitTyping]);

  // Mark room as read
  const markRead = useCallback(() => {
    if (socket && roomId) {
      socket.emit('message_read', { roomId });
    }
  }, [roomId, socket]);

  useEffect(() => {
    if (!socket) return;

    if (roomId) {
      socket.emit('joinRoom', { roomId });
    }

    // Support both onlineUsers/online_users
    const handleOnlineUsers = (userIds: string[]) => {
      setOnlineUserIds(userIds);
    };
    socket.on('onlineUsers', handleOnlineUsers);
    socket.on('online_users', handleOnlineUsers);

    // Support both userOnline/user_online
    const handleUserOnline = ({ userId }: { userId: string }) => {
      setOnlineUserIds((prev) => [...new Set([...prev, userId])]);
    };
    socket.on('userOnline', handleUserOnline);
    socket.on('user_online', handleUserOnline);

    // Support both userOffline/user_offline
    const handleUserOffline = ({ userId }: { userId: string }) => {
      setOnlineUserIds((prev) => prev.filter((id) => id !== userId));
    };
    socket.on('userOffline', handleUserOffline);
    socket.on('user_offline', handleUserOffline);

    // Support both newMessage/receive_message
    const handleNewMessage = (message: ChatMessage) => {
      if (message.roomId === roomId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
        // Automatically confirm delivery
        socket.emit('message_delivered', { messageId: message.id, roomId });
      }
    };
    socket.on('newMessage', handleNewMessage);
    socket.on('receive_message', handleNewMessage);
    socket.on('new_message', handleNewMessage);

    socket.on('messageEdited', (updatedMessage: ChatMessage) => {
      if (updatedMessage.roomId === roomId) {
        setMessages((prev) =>
          prev.map((m) => (m.id === updatedMessage.id ? updatedMessage : m))
        );
      }
    });

    socket.on('messageDeleted', ({ messageId, roomId: deletedRoomId }: { messageId: string; roomId: string }) => {
      if (deletedRoomId === roomId) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, isDeleted: true, content: 'This message was deleted' } : m))
        );
      }
    });

    // Listeners for typing
    socket.on('userTyping', ({ userId, isTyping }: TypingUser) => {
      setTypingUsers((prev) => ({ ...prev, [userId]: isTyping }));
    });
    socket.on('user_typing', ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
      setTypingUsers((prev) => ({ ...prev, [userId]: isTyping }));
    });
    socket.on('typing', ({ userId }: { userId: string; roomId: string }) => {
      setTypingUsers((prev) => ({ ...prev, [userId]: true }));
    });
    socket.on('stop_typing', ({ userId }: { userId: string; roomId: string }) => {
      setTypingUsers((prev) => ({ ...prev, [userId]: false }));
    });

    // Message read status update
    const handleMessageReadUpdate = ({ userId }: { userId: string; roomId: string }) => {
      setMessages((prev) =>
        prev.map((m) => (m.senderId !== userId && m.status !== 'SEEN' ? { ...m, status: 'SEEN' } : m))
      );
    };
    socket.on('messagesRead', handleMessageReadUpdate);
    socket.on('message_read', handleMessageReadUpdate);

    // Message delivery status update
    socket.on('message_delivered', ({ messageId }: { messageId: string; roomId: string; userId: string }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId && m.status === 'SENT' ? { ...m, status: 'DELIVERED' } : m))
      );
    });

    socket.on('joinedRoom', (data: { roomId: string }) => {
      console.log(`Joined room: ${data.roomId}`);
    });

    socket.on('error', (err: { message: string }) => {
      console.error('Chat error:', err.message);
    });

    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (roomId) {
        socket.emit('leaveRoom', { roomId });
      }
      socket.off('onlineUsers', handleOnlineUsers);
      socket.off('online_users', handleOnlineUsers);
      socket.off('userOnline', handleUserOnline);
      socket.off('user_online', handleUserOnline);
      socket.off('userOffline', handleUserOffline);
      socket.off('user_offline', handleUserOffline);
      socket.off('newMessage', handleNewMessage);
      socket.off('receive_message', handleNewMessage);
      socket.off('new_message', handleNewMessage);
      socket.off('messageEdited');
      socket.off('messageDeleted');
      socket.off('userTyping');
      socket.off('user_typing');
      socket.off('typing');
      socket.off('stop_typing');
      socket.off('messagesRead', handleMessageReadUpdate);
      socket.off('message_read', handleMessageReadUpdate);
      socket.off('message_delivered');
      socket.off('joinedRoom');
      socket.off('error');
      setMessages([]);
    };
  }, [socket, roomId]);

  const loadMessages = useCallback((initialMessages: ChatMessage[]) => {
    setMessages(initialMessages);
  }, []);

  return {
    isChatConnected,
    messages,
    onlineUserIds,
    typingUsers,
    sendMessage,
    editMessage,
    deleteMessage,
    handleTyping,
    markRead,
    loadMessages,
    setMessages,
    socketRef,
  };
};
