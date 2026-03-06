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
  const socketRef = useRef<WebSocket | null>(null);
  const peersRef = useRef<Map<string, Peer>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  const iceServers: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ],
  };

  // 1. الحصول على الميديا المحلية (كاميرا وميكروفون)
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

  // 2. إنشاء اتصال Peer وتفعيل التفاوض التلقائي
  const createPeer = useCallback(async (targetId: string, targetUsername: string, targetDisplayName: string, targetAvatar: string | undefined, isInitiator: boolean) => {
    if (peersRef.current.has(targetId)) return;

    const pc = new RTCPeerConnection(iceServers);

    // إضافة المسارات المحلية فوراً قبل أي تفاوض
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // أهم جزء: التفاوض التلقائي (ضروري لمشاركة الشاشة)
    pc.onnegotiationneeded = async () => {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current?.send(JSON.stringify({
          type: 'signal',
          targetId,
          senderId: userId,
          signal: { sdp: pc.localDescription }
        }));
      } catch (err) {
        console.error("Negotiation error:", err);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.send(JSON.stringify({
          type: 'signal', targetId, senderId: userId,
          signal: { candidate: event.candidate }
        }));
      }
    };

    pc.ontrack = (event) => {
      setPeers(prev => {
        const newPeers = new Map(prev);
        const peer = newPeers.get(targetId);
        if (peer) {
          peer.stream = event.streams[0];
        } else {
          newPeers.set(targetId, { 
            userId: targetId, username: targetUsername, displayName: targetDisplayName, 
            avatar: targetAvatar, connection: pc, stream: event.streams[0] 
          });
        }
        return newPeers;
      });
    };

    const peer: Peer = { userId: targetId, username: targetUsername, displayName: targetDisplayName, avatar: targetAvatar, connection: pc };
    peersRef.current.set(targetId, peer);
    setPeers(new Map(peersRef.current));
  }, [userId, iceServers]);

  // 3. معالجة الإشارات (Signaling)
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
            type: 'signal', targetId: senderId, senderId: userId,
            signal: { sdp: peer.connection.localDescription }
          }));
        }
      } else if (signal.candidate) {
        await peer.connection.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch (err) {
      console.error("Signaling error:", err);
    }
  };

  // 4. وظيفة مشاركة الشاشة
  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        // استبدال تراك الفيديو عند كل المشتركين
        peersRef.current.forEach(peer => {
          const senders = peer.connection.getSenders();
          const videoSender = senders.find(s => s.track?.kind === 'video');
          if (videoSender) videoSender.replaceTrack(screenTrack);
        });

        screenTrack.onended = () => stopScreenShare();
        setIsScreenSharing(true);
      } else {
        stopScreenShare();
      }
    } catch (err) {
      console.error("Screen share error:", err);
    }
  };

  const stopScreenShare = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    peersRef.current.forEach(peer => {
      const senders = peer.connection.getSenders();
      const videoSender = senders.find(s => s.track?.kind === 'video');
      if (videoSender && videoTrack) videoSender.replaceTrack(videoTrack);
    });
    setIsScreenSharing(false);
  };

  // 5. ربط السوكيت (Socket Connection)
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
          message.users.forEach((u: any) => {
            if (u.userId !== userId) createPeer(u.userId, u.username, u.displayName, u.avatar, false);
          });
          break;
        case 'signal':
          await handleSignal(message.senderId, message.signal);
          break;
        case 'user-left':
          const peer = peersRef.current.get(message.userId);
          peer?.connection.close();
          peersRef.current.delete(message.userId);
          setPeers(new Map(peersRef.current));
          break;
      }
    };

    return () => socket.close();
  }, [roomId, userId, createPeer]);

  return { peers, localStream, isScreenSharing, toggleScreenShare, messages, sendChatMessage: (text: string) => {} };
}
