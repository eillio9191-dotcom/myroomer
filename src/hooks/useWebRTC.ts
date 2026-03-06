import { useEffect, useRef, useState, useCallback } from 'react';

export interface Peer {
  userId: string;
  username: string;
  displayName?: string;
  avatar?: string;
  stream?: MediaStream;
  connection: RTCPeerConnection;
  isMuted?: boolean;
}

export interface ChatMessage {
  text: string;
  senderId: string;
  username?: string;
  displayName?: string;
  avatar?: string;
  timestamp: number;
}

export function useWebRTC(roomId: string, userId: string, username: string, displayName?: string, avatar?: string) {
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
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  // 1. Initialize local media
  useEffect(() => {
    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        setLocalStream(stream);
        localStreamRef.current = stream;
      } catch (err) {
        console.error("Error accessing media devices:", err);
      }
    };
    initMedia();
    return () => localStreamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  // 2. WebSocket and signaling
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    socketRef.current = socket;

    socket.onopen = () => socket.send(JSON.stringify({ type: 'join', roomId, userId, username, displayName, avatar }));

    socket.onmessage = async (event) => {
      const msg = JSON.parse(event.data);
      switch (msg.type) {
        case 'user-joined': await createPeer(msg.userId, msg.username, msg.displayName, msg.avatar, true); break;
        case 'room-users': for (const u of msg.users) { if (u.userId !== userId) await createPeer(u.userId, u.username, u.displayName, u.avatar, false); } break;
        case 'signal': await handleSignal(msg.senderId, msg.signal); break;
        case 'user-left': removePeer(msg.userId); break;
        case 'chat': setMessages(prev => [...prev, { ...msg }]); break;
        case 'mute-status': updatePeerMute(msg.senderId, msg.isMuted); break;
        case 'profile-update': updatePeerProfile(msg.senderId, msg.displayName, msg.avatar); break;
      }
    };

    return () => {
      socket.close();
      peersRef.current.forEach(p => p.connection.close());
    };
  }, [roomId, userId, username, displayName, avatar]);

  const createPeer = async (targetId: string, targetUsername: string, targetDisplayName?: string, targetAvatar?: string, isInitiator = false) => {
    if (!localStreamRef.current) return;
    const pc = new RTCPeerConnection(iceServers);
    const peer: Peer = { userId: targetId, username: targetUsername, displayName: targetDisplayName, avatar: targetAvatar, connection: pc };

    pc.onicecandidate = e => e.candidate && socketRef.current?.send(JSON.stringify({ type: 'signal', targetId, senderId: userId, signal: { candidate: e.candidate } }));
    pc.ontrack = e => setPeers(prev => { const m = new Map(prev); m.set(targetId, { ...peer, stream: e.streams[0] }); peersRef.current.set(targetId, m.get(targetId)!); return m; });

    localStreamRef.current.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current!));

    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current?.send(JSON.stringify({ type: 'signal', targetId, senderId: userId, signal: { sdp: offer } }));
    }

    peersRef.current.set(targetId, peer);
    setPeers(new Map(peersRef.current));
  };

  const handleSignal = async (senderId: string, signal: any) => {
    const peer = peersRef.current.get(senderId);
    if (!peer) return;
    if (signal.sdp) {
      await peer.connection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      if (signal.sdp.type === 'offer') {
        const answer = await peer.connection.createAnswer();
        await peer.connection.setLocalDescription(answer);
        socketRef.current?.send(JSON.stringify({ type: 'signal', targetId: senderId, senderId: userId, signal: { sdp: answer } }));
      }
    } else if (signal.candidate) {
      await peer.connection.addIceCandidate(new RTCIceCandidate(signal.candidate));
    }
  };

  const removePeer = (targetId: string) => { const p = peersRef.current.get(targetId); if (p) { p.connection.close(); peersRef.current.delete(targetId); setPeers(new Map(peersRef.current)); } };
  const updatePeerMute = (targetId: string, muted: boolean) => setPeers(prev => { const m = new Map(prev); const p = m.get(targetId); if (p) p.isMuted = muted; return m; });
  const updatePeerProfile = (targetId: string, displayName?: string, avatar?: string) => setPeers(prev => { const m = new Map(prev); const p = m.get(targetId); if (p) { if (displayName) p.displayName = displayName; if (avatar) p.avatar = avatar; } return m; });

  const toggleMedia = (type: 'audio' | 'video') => { const track = type === 'audio' ? localStreamRef.current?.getAudioTracks()[0] : localStreamRef.current?.getVideoTracks()[0]; if (track) { track.enabled = !track.enabled; if (type === 'audio') sendMuteStatus(!track.enabled); } };
  const sendMuteStatus = (muted: boolean) => socketRef.current?.readyState === WebSocket.OPEN && socketRef.current.send(JSON.stringify({ type: 'mute-status', senderId: userId, isMuted: muted }));
  const sendChatMessage = (text: string) => socketRef.current?.readyState === WebSocket.OPEN && socketRef.current.send(JSON.stringify({ type: 'chat', text, senderId: userId, username, displayName, avatar, timestamp: Date.now() }));

  const toggleMuteAll = () => { const newState = !isMutedAll; setIsMutedAll(newState); peersRef.current.forEach(p => p.stream?.getAudioTracks().forEach(t => t.enabled = !newState)); };
  
  const startScreenShare = async () => {
    if (!localStreamRef.current) return;
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }).catch(() => navigator.mediaDevices.getDisplayMedia({ video: true }));
      setIsScreenSharing(true);
      const videoTrack = screenStream.getVideoTracks()[0];
      peersRef.current.forEach(p => { const s = p.connection.getSenders().find(s => s.track?.kind === 'video'); if (s) s.replaceTrack(videoTrack); });
      videoTrack.onended = stopScreenShare;
      return screenStream;
    } catch (err) { console.error(err); setIsScreenSharing(false); return null; }
  };
  const stopScreenShare = () => { const videoTrack = localStreamRef.current?.getVideoTracks()[0]; peersRef.current.forEach(p => { const s = p.connection.getSenders().find(s => s.track?.kind === 'video'); if (s && videoTrack) s.replaceTrack(videoTrack); }); setIsScreenSharing(false); };

  return { peers, localStream, isScreenSharing, toggleMedia, startScreenShare, stopScreenShare, messages, sendChatMessage, isMutedAll, toggleMuteAll, sendMuteStatus, updateProfile: updatePeerProfile };
}