import { useEffect, useRef, useState, useCallback } from 'react';

export interface Peer {
  userId: string;
  username: string;
  displayName: string;
  avatar?: string;
  stream?: MediaStream;
  connection: RTCPeerConnection;
  isMuted?: boolean;
}

export interface ChatMessage {
  text: string;
  senderId: string;
  username: string;
  displayName: string;
  avatar?: string;
  timestamp: number;
}

export function useWebRTC(roomId: string, userId: string, username: string, displayName: string, avatar?: string) {
  const [peers, setPeers] = useState<Map<string, Peer>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isMutedAll, setIsMutedAll] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const peersRef = useRef<Map<string, Peer>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  const iceServers: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    ],
  };

  // 1️⃣ تهيئة الميديا المحلية
  useEffect(() => {
    const initLocalStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        setLocalStream(stream);
        localStreamRef.current = stream;
      } catch (err) {
        console.error("Error accessing local media:", err);
      }
    };
    initLocalStream();

    return () => {
      localStreamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  // 2️⃣ إنشاء Peer وتفاوض تلقائي
  const createPeer = useCallback(async (targetId: string, targetUsername: string, targetDisplayName: string, targetAvatar: string | undefined, isInitiator: boolean) => {
    if (peersRef.current.has(targetId)) return;
    if (!localStreamRef.current) return;

    const pc = new RTCPeerConnection(iceServers);

    const peer: Peer = { userId: targetId, username: targetUsername, displayName: targetDisplayName, avatar: targetAvatar, connection: pc, isMuted: false };

    // إرسال ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.send(JSON.stringify({
          type: 'signal', targetId, senderId: userId, signal: { candidate: event.candidate }
        }));
      }
    };

    // استقبال الصوت والفيديو من Peer آخر
    pc.ontrack = (event) => {
      setPeers(prev => {
        const newPeers = new Map(prev);
        const existing = newPeers.get(targetId);
        if (existing) existing.stream = event.streams[0];
        else newPeers.set(targetId, { ...peer, stream: event.streams[0] });
        return newPeers;
      });
    };

    // إضافة المسارات المحلية
    localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));

    // Initiator: إرسال Offer
    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current?.send(JSON.stringify({
        type: 'signal', targetId, senderId: userId, signal: { sdp: offer }
      }));
    }

    peersRef.current.set(targetId, peer);
    setPeers(new Map(peersRef.current));
  }, [userId, iceServers]);

  // 3️⃣ معالجة الإشارات
  const handleSignal = async (senderId: string, signal: any) => {
    const peer = peersRef.current.get(senderId);
    if (!peer) return;

    try {
      if (signal.sdp) {
        await peer.connection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        if (signal.sdp.type === 'offer') {
          const answer = await peer.connection.createAnswer();
          await peer.connection.setLocalDescription(answer);
          socketRef.current?.send(JSON.stringify({
            type: 'signal', targetId: senderId, senderId: userId, signal: { sdp: answer }
          }));
        }
      } else if (signal.candidate) {
        await peer.connection.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch (err) {
      console.error("Signaling error:", err);
    }
  };

  // 4️⃣ إزالة Peer
  const removePeer = (targetId: string) => {
    const peer = peersRef.current.get(targetId);
    if (peer) {
      peer.connection.close();
      peersRef.current.delete(targetId);
      setPeers(new Map(peersRef.current));
    }
  };

  // 5️⃣ mute / toggle الميديا
  const toggleMedia = (type: 'audio' | 'video') => {
    if (!localStreamRef.current) return;
    const track = type === 'audio' ? localStreamRef.current.getAudioTracks()[0] : localStreamRef.current.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      if (type === 'audio') sendMuteStatus(!track.enabled);
    }
  };

  const sendMuteStatus = (isMuted: boolean) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'mute-status', senderId: userId, isMuted }));
    }
  };

  const toggleMuteAll = () => {
    const newState = !isMutedAll;
    setIsMutedAll(newState);
    peersRef.current.forEach(peer => {
      if (peer.stream) peer.stream.getAudioTracks().forEach(track => track.enabled = !newState);
    });
  };

  // 6️⃣ مشاركة الشاشة
  const startScreenShare = async () => {
    if (!localStreamRef.current) return;
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      setIsScreenSharing(true);
      const videoTrack = screenStream.getVideoTracks()[0];

      peersRef.current.forEach(peer => {
        const sender = peer.connection.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(videoTrack);
      });

      videoTrack.onended = stopScreenShare;
    } catch (err) {
      console.error("Error sharing screen:", err);
    }
  };

  const stopScreenShare = () => {
    if (!localStreamRef.current) return;
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    peersRef.current.forEach(peer => {
      const sender = peer.connection.getSenders().find(s => s.track?.kind === 'video');
      if (sender && videoTrack) sender.replaceTrack(videoTrack);
    });
    setIsScreenSharing(false);
  };

  // 7️⃣ إرسال رسالة
  const sendChatMessage = (text: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'chat', text, senderId: userId, username, displayName, avatar, timestamp: Date.now()
      }));
    }
  };

  // 8️⃣ تحديث الملف الشخصي
  const updateProfile = (newDisplayName: string, newAvatar?: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'profile-update', senderId: userId, displayName: newDisplayName, avatar: newAvatar }));
    }
  };

  // 9️⃣ الاتصال بالسوكيت ومعالجة الرسائل
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'join', roomId, userId, username, displayName, avatar }));
    };

    socket.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      switch (message.type) {
        case 'user-joined':
          await createPeer(message.userId, message.username, message.displayName, message.avatar, true);
          break;
        case 'room-users':
          for (const u of message.users) {
            if (u.userId !== userId) await createPeer(u.userId, u.username, u.displayName, u.avatar, false);
          }
          break;
        case 'signal':
          await handleSignal(message.senderId, message.signal);
          break;
        case 'user-left':
          removePeer(message.userId);
          break;
        case 'chat':
          setMessages(prev => [...prev, { text: message.text, senderId: message.senderId, username: message.username, displayName: message.displayName, avatar: message.avatar, timestamp: message.timestamp }]);
          break;
        case 'mute-status':
          setPeers(prev => {
            const newPeers = new Map(prev);
            const existing = newPeers.get(message.senderId);
            if (existing) existing.isMuted = message.isMuted;
            return newPeers;
          });
          break;
        case 'profile-update':
          setPeers(prev => {
            const newPeers = new Map(prev);
            const existing = newPeers.get(message.senderId);
            if (existing) {
              existing.displayName = message.displayName;
              existing.avatar = message.avatar;
            }
            return newPeers;
          });
          break;
      }
    };

    return () => socket.close();
  }, [roomId, userId, username, displayName, avatar, createPeer]);

  return {
    peers,
    localStream,
    toggleMedia,
    startScreenShare,
    stopScreenShare,
    isScreenSharing,
    messages,
    sendChatMessage,
    toggleMuteAll,
    isMutedAll,
    sendMuteStatus,
    updateProfile
  };
}