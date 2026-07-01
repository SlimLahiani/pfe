import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Manager, Socket } from 'socket.io-client';
import { useAuth } from './auth-context';

interface SocketContextType {
  socket: Socket | null;        // Default namespace '/' — Notifications
  chatSocket: Socket | null;    // '/chat' namespace — Chat & WebRTC
  isConnected: boolean;
  isChatConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  chatSocket: null,
  isConnected: false,
  isChatConnected: false,
});

export const useSocketContext = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [chatSocket, setChatSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isChatConnected, setIsChatConnected] = useState(false);
  const managerRef = useRef<Manager | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      if (managerRef.current) {
        console.log('[Socket] Disconnecting all sockets (user logged out)');
        managerRef.current._close();
        managerRef.current = null;
      }
      setSocket(null);
      setChatSocket(null);
      setIsConnected(false);
      setIsChatConnected(false);
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.warn('[Socket] No access token found, skipping socket initialization');
      return;
    }

    // Prevent duplicate managers on StrictMode double-invoke
    if (managerRef.current) {
      console.log('[Socket] Manager already initialized, skipping');
      return;
    }

    console.log('[Socket] 🔌 Initializing Socket.IO Manager → http://localhost:3000');

    const manager = new Manager('http://localhost:3000', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    managerRef.current = manager;

    const authPayload = { token: `Bearer ${token}` };

    // ── Notifications namespace ──────────────────────────────────────────────
    const notifySocket = manager.socket('/notifications', { auth: authPayload });
    setSocket(notifySocket);

    notifySocket.on('connect', () => {
      setIsConnected(true);
      console.log(`[Socket] ✅ Notifications (/notifications) connected | id=${notifySocket.id}`);
    });

    notifySocket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log(`[Socket] 🔌 Notifications (/notifications) disconnected | reason=${reason}`);
    });

    notifySocket.on('connect_error', (err) => {
      setIsConnected(false);
      console.error(`[Socket] ❌ Notifications (/notifications) connection error: ${err.message}`);
    });

    notifySocket.on('authenticated', (data: { message: string }) => {
      console.log(`[Socket] 🔐 Notifications authenticated: ${data.message}`);
    });

    // ── Chat namespace: Chat & WebRTC ─────────────────────────────────────────
    const chat = manager.socket('/chat', { auth: authPayload });
    setChatSocket(chat);

    chat.on('connect', () => {
      setIsChatConnected(true);
      console.log(`[Socket] ✅ Chat (/chat) connected | id=${chat.id}`);
    });

    chat.on('disconnect', (reason) => {
      setIsChatConnected(false);
      console.log(`[Socket] 🔌 Chat (/chat) disconnected | reason=${reason}`);
    });

    chat.on('connect_error', (err) => {
      setIsChatConnected(false);
      console.error(`[Socket] ❌ Chat (/chat) connection error: ${err.message}`);
    });

    return () => {
      console.log('[Socket] 🧹 Cleaning up Socket.IO manager');
      notifySocket.off();
      chat.off();
      notifySocket.disconnect();
      chat.disconnect();
      managerRef.current = null;
      setIsConnected(false);
      setIsChatConnected(false);
    };
  }, [isAuthenticated]);

  return (
    <SocketContext.Provider value={{ socket, chatSocket, isConnected, isChatConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
