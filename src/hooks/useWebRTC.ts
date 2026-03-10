import { useEffect, useRef, useState } from 'react';

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

export type QualityLevel = '1080' | '720' | '480' | '360' | '240';

export interface QualityPreset {
  width: number;
  height: number;
  frameRate: number;
  bitrate: number;
}

export const QUALITY_PRESETS: Record<QualityLevel, QualityPreset> = {
  '1080': { width: 1920, height: 1080, frameRate: 30, bitrate: 8000000 }, // كان 4Mbps
  '720': { width: 1280, height: 720, frameRate: 30, bitrate: 4000000 },  // كان 2Mbps
  '480': { width: 854, height: 480, frameRate: 30, bitrate: 2000000 },  // كان 1Mbps
  '360': { width: 640, height: 360, frameRate: 30, bitrate: 1200000 }, // كان 600Kbps
  '240': { width: 426, height: 240, frameRate: 15, bitrate: 600000 },   // كان 300Kbps
};

export function useWebRTC(roomId: string, userId: string, username: string, displayName: string, avatar?: string) {
  const [peers, setPeers] = useState<Map<string, Peer>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isMutedAll, setIsMutedAll] = useState(false);
  const [quality, setQuality] = useState<QualityLevel>('720');
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const peersRef = useRef<Map<string, Peer>>(new Map());

  const iceServers: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.services.mozilla.com' },
      { urls: 'stun:bn-turn2.xirsys.com' },
      ...((import.meta as any).env.VITE_TURN_URL ? [{
        urls: (import.meta as any).env.VITE_TURN_URL.split(','),
        username: (import.meta as any).env.VITE_TURN_USERNAME,
        credential: (import.meta as any).env.VITE_TURN_PASSWORD
      }] : [])
    ],
  };
  
  // Debug: تحقق من قراءة متغيرات البيئة
  console.log('TURN URL:', (import.meta as any).env.VITE_TURN_URL);
  console.log('TURN Username:', (import.meta as any).env.VITE_TURN_USERNAME);
  console.log('TURN Password:', (import.meta as any).env.VITE_TURN_PASSWORD ? '***' : 'undefined');
  // Manual Quality Control
const [userManuallyChanged, setUserManuallyChanged] = useState(false);
 
// Adaptive Quality Functions
const detectNetworkQuality = async (): Promise<number> => {
  try {
    const connection = peersRef.current.values().next().value?.connection;
    if (!connection) return 5; // default medium quality
 
    const stats = await connection.getStats();
    let bandwidth = 5; // default Mbps
      
    stats.forEach(report => {
      if (report.type === 'outbound-rtp' && report.kind === 'video') {
        // Estimate bandwidth from bytes sent
        const bytesSent = report.bytesSent || 0;
        const timestamp = report.timestamp || Date.now();
        // Simple bandwidth estimation (would need proper calculation in production)
        bandwidth = Math.max(1, Math.min(20, bytesSent / 1000000)); // 1-20 Mbps estimate
      }
    });
 
    return bandwidth;
  } catch (error) {
    console.error('Error detecting network quality:', error);
    return 5; // fallback to medium quality
  }
};
 
const adaptiveQuality = (networkSpeed: number): QualityLevel => {
  if (networkSpeed < 1) return '240';
  if (networkSpeed < 3) return '360';
  if (networkSpeed < 5) return '480';
  if (networkSpeed < 10) return '720';
  return '1080';
};
 
const checkAndAdaptQuality = async () => {
  // Don't interfere if user manually changed quality
  if (userManuallyChanged) return;
    
  const networkSpeed = await detectNetworkQuality();
  const suggestedQuality = adaptiveQuality(networkSpeed);
    
  if (suggestedQuality !== quality) {
    console.log(`Adaptive quality: ${networkSpeed}Mbps → ${suggestedQuality}p`);
    setQuality(suggestedQuality);
  }
};
 
const handleManualQualityChange = (newQuality: QualityLevel) => {
  setUserManuallyChanged(true); // Stop adaptive changes
  setQuality(newQuality);
  console.log(`Manual quality set to: ${newQuality}p`);
};
 
useEffect(() => {
  if (localStream && peersRef.current.size > 0) {
    const qualityCheckInterval = setInterval(checkAndAdaptQuality, 5000); // Check every 5 seconds
    return () => clearInterval(qualityCheckInterval);
  }
}, [localStream, quality, userManuallyChanged]);
 
  useEffect(() => {
    if (localStream) {
      peersRef.current.forEach(async (peer) => {
        const senders = peer.connection.getSenders();
        localStream.getTracks().forEach(track => {
          const alreadyAdded = senders.some(s => s.track?.id === track.id);
          if (!alreadyAdded) {
            peer.connection.addTrack(track, localStream);
          }
        });
      });
    }
  }, [localStream]);

  const [lobbyRequests, setLobbyRequests] = useState<Peer[]>([]);
  const [isWaitingInLobby, setIsWaitingInLobby] = useState(false);
  const [isKicked, setIsKicked] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [broadcastQuality, setBroadcastQuality] = useState(false);
  const [roomTag, setRoomTag] = useState('');
  const [incomingCall, setIncomingCall] = useState<{ callerId: string; callerDisplayName: string; callerAvatar?: string; roomId: string } | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    socketRef.current = socket;

    socket.onopen = () => {
      // We'll call join explicitly from the UI now to handle pre-join settings
    };

    socket.onmessage = async (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'room-info':
          if (message.roomTag) setRoomTag(message.roomTag);
          break;
        case 'you-are-owner':
          setIsOwner(true);
          break;
        case 'waiting-in-lobby':
          setIsWaitingInLobby(true);
          break;
        case 'lobby-request':
          setLobbyRequests(prev => {
            if (prev.find(r => r.userId === message.userId)) return prev;
            return [...prev, {
              userId: message.userId,
              username: message.username,
              displayName: message.displayName,
              avatar: message.avatar,
              connection: null as any // Not a real peer yet
            }];
          });
          break;
        case 'lobby-rejected':
          setIsWaitingInLobby(false);
          alert("Your request to join was rejected.");
          break;
        case 'kicked':
          setIsKicked(true);
          break;
        case 'room-deleted':
          alert("The room has been deleted by the owner.");
          window.location.href = '/';
          break;
        case 'incoming-call':
          setIncomingCall({
            callerId: message.callerId,
            callerDisplayName: message.callerDisplayName,
            callerAvatar: message.callerAvatar,
            roomId: message.roomId
          });
          break;
        case 'user-joined':
          setIsWaitingInLobby(false); // If we were waiting, we're in now
          setLobbyRequests(prev => prev.filter(r => r.userId !== message.userId));
          await createPeer(message.userId, message.username, message.displayName, message.avatar, true);
          break;
        case 'room-users':
          setIsWaitingInLobby(false);
          const userIds = message.users.map((u: any) => u.userId);
          setLobbyRequests(prev => prev.filter(r => !userIds.includes(r.userId)));
          for (const user of message.users) {
            await createPeer(user.userId, user.username, user.displayName, user.avatar, false);
          }
          break;
        case 'signal':
          await handleSignal(message.senderId, message.signal);
          break;
        case 'user-left':
          removePeer(message.userId);
          break;
        case 'chat':
          setMessages(prev => [...prev, {
            text: message.text,
            senderId: message.senderId,
            username: message.username,
            displayName: message.displayName,
            avatar: message.avatar,
            timestamp: message.timestamp
          }]);
          break;
        case 'quality-request':
          // Another peer is asking us to change our outgoing quality for them
          const peerToUpdate = peersRef.current.get(message.senderId);
          if (peerToUpdate) {
            const preset = QUALITY_PRESETS[message.level as QualityLevel];
            const sender = peerToUpdate.connection.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
              const params = sender.getParameters();
              if (!params.encodings) params.encodings = [{}];
              params.encodings[0].maxBitrate = preset.bitrate;
              sender.setParameters(params).catch(console.error);
            }
          }
          break;
        case 'mute-status':
          setPeers(prev => {
            const newPeers = new Map<string, Peer>(prev);
            const existing = newPeers.get(message.senderId);
            if (existing) {
              existing.isMuted = message.isMuted;
            }
            return newPeers;
          });
          break;
        case 'profile-update':
          setPeers(prev => {
            const newPeers = new Map<string, Peer>(prev);
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

    return () => {
      socket.close();
      peersRef.current.forEach(peer => peer.connection.close());
    };
  }, [roomId, userId]);

  const joinRoom = (isOwner: boolean, initialRoomTag?: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'join',
        roomId,
        userId,
        username,
        displayName,
        avatar,
        isOwner,
        roomTag: initialRoomTag
      }));
    }
  };

  const updateRoomTag = (newTag: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'update-room-tag',
        roomId,
        roomTag: newTag
      }));
    }
  };

  const approveUser = (targetId: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'lobby-approve', roomId, targetId }));
      setLobbyRequests(prev => prev.filter(r => r.userId !== targetId));
    }
  };

  const rejectUser = (targetId: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'lobby-reject', roomId, targetId }));
      setLobbyRequests(prev => prev.filter(r => r.userId !== targetId));
    }
  };

  const kickUser = (targetId: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'kick-user', roomId, targetId }));
    }
  };

  const deleteRoom = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'delete-room', roomId }));
    }
  };

  const directCall = (targetUsername: string, providedRoomId?: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'direct-call',
        targetUsername,
        callerId: userId,
        callerDisplayName: displayName,
        callerAvatar: avatar,
        roomId: providedRoomId
      }));
    }
  };

  const updateRoomSettings = (autoAccept: boolean, autoReject: boolean) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'room-settings',
        roomId,
        autoAccept,
        autoReject
      }));
    }
  };

  const updateProfile = (newDisplayName: string, newAvatar?: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'profile-update',
        senderId: userId,
        displayName: newDisplayName,
        avatar: newAvatar
      }));
    }
  };

  const changeQuality = async (level: QualityLevel) => {
    setQuality(level);
    const preset = QUALITY_PRESETS[level];

    // Notify all peers about our desired reception quality
    peersRef.current.forEach(peer => {
      socketRef.current?.send(JSON.stringify({
        type: 'quality-request',
        targetId: peer.userId,
        senderId: userId,
        level
      }));
    });

    if (broadcastQuality && localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        try {
          await videoTrack.applyConstraints({
            width: preset.width,
            height: preset.height,
            frameRate: preset.frameRate
          });
        } catch (err) {
          console.error("Error applying constraints:", err);
          const newStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: preset.width, max: 1920 },
              height: { ideal: preset.height, max: 1080 },
              frameRate: { ideal: 30, max: 60 },
              facingMode: "user",
              aspectRatio: 16/9
            },
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 48000
            }
          });
          const newVideoTrack = newStream.getVideoTracks()[0];
          const oldVideoTrack = localStream.getVideoTracks()[0];
          localStream.removeTrack(oldVideoTrack);
          localStream.addTrack(newVideoTrack);
          
          peersRef.current.forEach(peer => {
            const sender = peer.connection.getSenders().find(s => s.track?.kind === 'video');
            if (sender) sender.replaceTrack(newVideoTrack);
          });
        }
      }

      // Update bitrates for all peers (global broadcast)
      peersRef.current.forEach(peer => {
        const senders = peer.connection.getSenders();
        senders.forEach(sender => {
          if (sender.track?.kind === 'video') {
            const params = sender.getParameters();
            if (!params.encodings) params.encodings = [{}];
            params.encodings[0].maxBitrate = preset.bitrate;
            sender.setParameters(params).catch(console.error);
          }
        });
      });
    }
  };

  const sendMuteStatus = (isMuted: boolean) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'mute-status',
        senderId: userId,
        isMuted
      }));
    }
  };

  const sendChatMessage = (text: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'chat',
        text,
        senderId: userId,
        username,
        displayName,
        avatar,
        timestamp: Date.now()
      }));
    }
  };

  const toggleMuteAll = () => {
    const newState = !isMutedAll;
    setIsMutedAll(newState);
    peersRef.current.forEach(peer => {
      if (peer.stream) {
        peer.stream.getAudioTracks().forEach(track => {
          track.enabled = !newState;
        });
      }
    });
  };

  const createPeer = async (targetId: string, targetUsername: string, targetDisplayName: string, targetAvatar: string | undefined, isInitiator: boolean) => {
    const existingPeer = peersRef.current.get(targetId);
    if (existingPeer) {
      console.log(`Updating existing peer info for ${targetId}`);
      existingPeer.username = targetUsername;
      existingPeer.displayName = targetDisplayName;
      existingPeer.avatar = targetAvatar;
      setPeers(new Map(peersRef.current));
      return;
    }

    console.log(`Creating new peer for ${targetId}, initiator: ${isInitiator}`);
    const pc = new RTCPeerConnection(iceServers);

    const peer: Peer = {
      userId: targetId,
      username: targetUsername,
      displayName: targetDisplayName,
      avatar: targetAvatar,
      connection: pc,
      isMuted: false
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.send(JSON.stringify({
          type: 'signal',
          targetId,
          senderId: userId,
          signal: { candidate: event.candidate }
        }));
      }
    };

    pc.onnegotiationneeded = async () => {
      try {
        if (pc.signalingState !== 'stable') return;
        console.log(`Negotiation needed for ${targetId}`);
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') return;
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

    pc.ontrack = (event) => {
      console.log(`Received remote track from ${targetId}`);
      setPeers(prev => {
        const newPeers = new Map<string, Peer>(prev);
        const existing = newPeers.get(targetId);
        if (existing) {
          existing.stream = event.streams[0];
        }
        return newPeers;
      });
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state with ${targetId}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed') {
        console.log(`ICE failed with ${targetId}, attempting restart...`);
        pc.restartIce();
      }
    };

    // Add local tracks if available
    if (localStream) {
      const senders = pc.getSenders();
      localStream.getTracks().forEach(track => {
        const alreadyAdded = senders.some(s => s.track?.id === track.id);
        if (!alreadyAdded) {
          pc.addTrack(track, localStream);
        }
      });
    }

    peersRef.current.set(targetId, peer);
    setPeers(new Map(peersRef.current));
  };

  const handleSignal = async (senderId: string, signal: any) => {
    let peer = peersRef.current.get(senderId);
    
    // If peer doesn't exist yet, we might need to create it (e.g. receiving an offer before user-joined)
    if (!peer && signal.sdp && signal.sdp.type === 'offer') {
      console.log(`Received offer for non-existent peer ${senderId}, creating now...`);
      // We don't have full info yet, but we can create a placeholder
      await createPeer(senderId, 'Unknown', 'User', undefined, false);
      peer = peersRef.current.get(senderId);
    }

    if (!peer) return;

    try {
      if (signal.sdp) {
        console.log(`Received SDP ${signal.sdp.type} from ${senderId}`);
        
        // Handle collision (glare)
        if (signal.sdp.type === 'offer' && peer.connection.signalingState !== 'stable') {
          console.log("SDP Offer collision detected, ignoring incoming offer");
          return;
        }

        await peer.connection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        if (signal.sdp.type === 'offer') {
          const answer = await peer.connection.createAnswer();
          await peer.connection.setLocalDescription(answer);
          socketRef.current?.send(JSON.stringify({
            type: 'signal',
            targetId: senderId,
            senderId: userId,
            signal: { sdp: peer.connection.localDescription }
          }));
        }
      } else if (signal.candidate) {
        try {
          await peer.connection.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch (e) {
          console.warn("Error adding received ice candidate", e);
        }
      }
    } catch (err) {
      console.error("Signal handling error:", err);
    }
  };

  const removePeer = (targetId: string) => {
    const peer = peersRef.current.get(targetId);
    if (peer) {
      peer.connection.close();
      peersRef.current.delete(targetId);
      setPeers(new Map(peersRef.current));
    }
  };

  const toggleMedia = async (type: 'audio' | 'video') => {
    if (!localStream) {
      console.warn("Cannot toggle media: localStream not initialized");
      return;
    }

    const track = type === 'audio' ? localStream.getAudioTracks()[0] : localStream.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      if (type === 'audio') {
        sendMuteStatus(!track.enabled);
      }
    }
  };

  const startScreenShare = async () => {
    try {
      const preset = QUALITY_PRESETS[quality];
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: {
          width: preset.width,
          height: preset.height,
          frameRate: preset.frameRate
        }, 
        audio: true 
      }).catch(() => {
        return navigator.mediaDevices.getDisplayMedia({ 
          video: {
            width: preset.width,
            height: preset.height,
            frameRate: preset.frameRate
          }
        });
      });

      setScreenStream(stream);
      setIsScreenSharing(true);
      stream.getTracks().forEach(t => t.enabled = true);
      const videoTrack = stream.getVideoTracks()[0];
      
      peersRef.current.forEach(peer => {
        const sender = peer.connection.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack).then(() => {
            // Re-apply quality settings after track replacement
            const params = sender.getParameters();
            if (!params.encodings) params.encodings = [{}];
            params.encodings[0].maxBitrate = preset.bitrate;
            sender.setParameters(params).catch(console.error);
          });
        }
      });

      videoTrack.onended = () => stopScreenShare();
      
      return stream;
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        console.warn("Screen sharing was cancelled by the user.");
      } else {
        console.error("Error sharing screen:", err);
      }
      setIsScreenSharing(false);
      return null;
    }
  };

  const stopScreenShare = async () => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
    }

    if (!localStream) {
      setIsScreenSharing(false);
      return;
    }

    const videoTrack = localStream.getVideoTracks()[0];
    const preset = QUALITY_PRESETS[quality];

    peersRef.current.forEach(peer => {
      const sender = peer.connection.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        sender.replaceTrack(videoTrack).then(() => {
          // Re-apply original quality settings
          const params = sender.getParameters();
          if (!params.encodings) params.encodings = [{}];
          params.encodings[0].maxBitrate = preset.bitrate;
          sender.setParameters(params).catch(console.error);
        });
      }
    });
    setIsScreenSharing(false);
  };

  return {
    peers,
    localStream,
    setLocalStream,
    toggleMedia,
    startScreenShare,
    stopScreenShare,
    isScreenSharing,
    messages,
    sendChatMessage,
    isMutedAll,
    toggleMuteAll,
    sendMuteStatus,
    updateProfile,
    quality,
    changeQuality,
    broadcastQuality,
    setBroadcastQuality,
    lobbyRequests,
    isWaitingInLobby,
    isKicked,
    roomTag,
    updateRoomTag,
    incomingCall,
    isOwner,
    joinRoom,
    approveUser,
    rejectUser,
    kickUser,
    deleteRoom,
    directCall,
    setIncomingCall,
    updateRoomSettings
  };
}
