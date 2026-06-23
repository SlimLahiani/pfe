const { io } = require('socket.io-client');
const axios = require('axios');

async function runTest() {
  try {
    console.log('Logging in...');
    const loginRes = await axios.post('http://localhost:3000/api/v1/auth/login', {
      email: 'ceo@creativart.tn',
      password: 'AgencyOS@2026!'
    });
    const token = loginRes.data.accessToken;
    console.log('Login successful, token obtained.');

    console.log('Connecting to socket...');
    const socket = io('http://localhost:3000/chat', {
      auth: { token: `Bearer ${token}` },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('Connected! Socket ID:', socket.id);
      const roomId = '8644a5c4-5752-474b-be9a-b4a30dde1f6b'; // Général channel
      console.log(`Joining room ${roomId}...`);
      socket.emit('joinRoom', { roomId });
    });

    socket.on('joinedRoom', (data) => {
      console.log('Joined room callback:', data);
      console.log('Sending message...');
      socket.emit('send_message', {
        roomId: data.roomId,
        content: 'Test message from JS diagnostic script ' + new Date().toISOString(),
      });
    });

    socket.on('newMessage', (msg) => {
      console.log('SUCCESS! Received newMessage event:', msg);
      socket.disconnect();
      process.exit(0);
    });

    socket.on('error', (err) => {
      console.error('Socket error received:', err);
      socket.disconnect();
      process.exit(1);
    });

    socket.on('connect_error', (err) => {
      console.error('Connection error:', err);
      process.exit(1);
    });

    setTimeout(() => {
      console.log('Timeout waiting for socket response.');
      socket.disconnect();
      process.exit(1);
    }, 10000);

  } catch (err) {
    console.error('HTTP or diagnostic error:', err.response?.data || err.message);
    process.exit(1);
  }
}

runTest();
