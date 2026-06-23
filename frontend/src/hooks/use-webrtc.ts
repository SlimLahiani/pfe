import { useCallback, useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';

export type CallState = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

export interface CallInfo {
  roomId: string;
  callerId: string;
  callerName: string;
  isVideo: boolean;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const useWebRTC = (
  socketRef: React.RefObject<Socket | null>,
  currentUserId: string,
  currentUserName: string,
) => {
  const [callState, setCallState] = useState<CallState>('idle');
  const [incomingCall, setIncomingCall] = useState<CallInfo | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const activeRoomRef = useRef<string | null>(null);

  // Track the socket instance so the WebRTC effect can depend on it
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);

  useEffect(() => {
    // Update our tracked instance whenever the ref changes
    setSocketInstance(socketRef.current);
  });

  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current = null;
    screenStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    activeRoomRef.current = null;
    setCallState('idle');
    setIsVideo(false);
    setIsMuted(false);
    setIsCameraOff(false);
    setIsScreenSharing(false);
    console.log('[WebRTC] Cleaned up peer connection and media streams');
  }, []);

  const createPeerConnection = useCallback((roomId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('webrtc_ice_candidate', {
          roomId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        setCallState('connected');
      } else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        cleanup();
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE state: ${pc.iceConnectionState}`);
    };

    return pc;
  }, [socketRef, cleanup]);

  // Initiate a call
  const startCall = useCallback(async (roomId: string, video: boolean) => {
    const socket = socketRef.current;
    if (!socket) {
      console.error('[WebRTC] Cannot start call: socket not connected');
      return;
    }

    try {
      console.log(`[WebRTC] Starting ${video ? 'video' : 'audio'} call in room ${roomId}`);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: video,
      });

      localStreamRef.current = stream;
      activeRoomRef.current = roomId;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = createPeerConnection(roomId);
      pcRef.current = pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('webrtc_call_offer', {
        roomId,
        offer,
        callerId: currentUserId,
        callerName: currentUserName,
        isVideo: video,
      });

      setIsVideo(video);
      setCallState('calling');
    } catch (err) {
      console.error('[WebRTC] Failed to start call:', err);
      cleanup();
    }
  }, [socketRef, currentUserId, currentUserName, createPeerConnection, cleanup]);

  // Accept an incoming call
  const acceptCall = useCallback(async () => {
    const socket = socketRef.current;
    if (!incomingCall || !socket) return;

    const { roomId, isVideo: video } = incomingCall;
    try {
      console.log(`[WebRTC] Accepting call in room ${roomId}`);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: video,
      });

      localStreamRef.current = stream;
      activeRoomRef.current = roomId;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = createPeerConnection(roomId);
      pcRef.current = pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      socket.emit('webrtc_call_accept', {
        roomId,
        callerId: incomingCall.callerId,
      });

      setIsVideo(video);
      setCallState('connected');
      setIncomingCall(null);
    } catch (err) {
      console.error('[WebRTC] Failed to accept call:', err);
      rejectCall();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingCall, socketRef, createPeerConnection]);

  const rejectCall = useCallback(() => {
    const socket = socketRef.current;
    if (incomingCall && socket) {
      socket.emit('webrtc_call_reject', {
        roomId: incomingCall.roomId,
        callerId: incomingCall.callerId,
      });
    }
    setIncomingCall(null);
    setCallState('idle');
    console.log('[WebRTC] Call rejected');
  }, [incomingCall, socketRef]);

  const endCall = useCallback(() => {
    const socket = socketRef.current;
    if (socket && activeRoomRef.current) {
      socket.emit('webrtc_call_end', { roomId: activeRoomRef.current });
    }
    cleanup();
    console.log('[WebRTC] Call ended');
  }, [socketRef, cleanup]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(prev => !prev);
  }, []);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsCameraOff(prev => !prev);
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (!pcRef.current) return;

    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;

      const camTrack = localStreamRef.current?.getVideoTracks()[0];
      if (camTrack) {
        const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(camTrack);
      }
      setIsScreenSharing(false);
    } else {
      try {
        const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;

        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(screenTrack);

        screenTrack.onended = () => {
          toggleScreenShare();
        };

        setIsScreenSharing(true);
      } catch (err) {
        console.error('[WebRTC] Screen share failed:', err);
      }
    }
  }, [isScreenSharing]);

  // Socket event listeners for WebRTC signaling
  // NOTE: we depend on `socketInstance` (state) NOT `socketRef.current` (ref)
  // so that this effect re-runs when the socket connects after the component mounts.
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    console.log(`[WebRTC] Attaching signaling listeners on socket ${socket.id}`);

    const handleIncomingOffer = async (data: {
      roomId: string;
      offer: RTCSessionDescriptionInit;
      callerId: string;
      callerName: string;
      isVideo: boolean;
    }) => {
      console.log(`[WebRTC] Incoming call offer from ${data.callerId} in room ${data.roomId}`);
      setIncomingCall({
        roomId: data.roomId,
        callerId: data.callerId,
        callerName: data.callerName,
        isVideo: data.isVideo,
      });
      setCallState('ringing');

      if (pcRef.current) return;
      const pc = createPeerConnection(data.roomId);
      pcRef.current = pc;
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    };

    const handleCallAccepted = async (data: { roomId: string; answer: RTCSessionDescriptionInit }) => {
      if (pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        setCallState('connected');
        console.log(`[WebRTC] Call accepted in room ${data.roomId}`);
      }
    };

    const handleCallAnswer = async (data: { roomId: string; answer: RTCSessionDescriptionInit }) => {
      if (pcRef.current && pcRef.current.signalingState === 'have-local-offer') {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    };

    const handleIceCandidate = async (data: { candidate: RTCIceCandidateInit }) => {
      if (pcRef.current) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.warn('[WebRTC] Failed to add ICE candidate:', err);
        }
      }
    };

    const handleCallRejected = () => {
      console.log('[WebRTC] Call was rejected by remote peer');
      cleanup();
      setCallState('ended');
      setTimeout(() => setCallState('idle'), 2000);
    };

    const handleCallEnded = () => {
      console.log('[WebRTC] Call ended by remote peer');
      cleanup();
    };

    const handleAcceptResponse = async (data: { roomId: string }) => {
      if (pcRef.current && pcRef.current.localDescription) {
        if (pcRef.current.signalingState === 'have-remote-offer') {
          const answer = await pcRef.current.createAnswer();
          await pcRef.current.setLocalDescription(answer);
          socket.emit('webrtc_call_answer', { roomId: data.roomId, answer });
        }
      }
    };

    socket.on('webrtc_incoming_call', handleIncomingOffer);
    socket.on('webrtc_call_accepted', handleCallAccepted);
    socket.on('webrtc_call_answer', handleCallAnswer);
    socket.on('webrtc_ice_candidate', handleIceCandidate);
    socket.on('webrtc_call_rejected', handleCallRejected);
    socket.on('webrtc_call_ended', handleCallEnded);
    socket.on('webrtc_accept_response', handleAcceptResponse);

    return () => {
      socket.off('webrtc_incoming_call', handleIncomingOffer);
      socket.off('webrtc_call_accepted', handleCallAccepted);
      socket.off('webrtc_call_answer', handleCallAnswer);
      socket.off('webrtc_ice_candidate', handleIceCandidate);
      socket.off('webrtc_call_rejected', handleCallRejected);
      socket.off('webrtc_call_ended', handleCallEnded);
      socket.off('webrtc_accept_response', handleAcceptResponse);
      console.log('[WebRTC] Signaling listeners removed');
    };
  // socketInstance is tracked state that updates when socketRef.current changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketInstance, createPeerConnection, cleanup]);

  return {
    callState,
    incomingCall,
    isVideo,
    isMuted,
    isCameraOff,
    isScreenSharing,
    localVideoRef,
    remoteVideoRef,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
  };
};
