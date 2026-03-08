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
  '1080': { width: 1920, height: 1080, frameRate: 30, bitrate: 4000000 },
  '720': { width: 1280, height: 720, frameRate: 30, bitrate: 2000000 },
  '480': { width: 854, height: 480, frameRate: 30, bitrate: 1000000 },
  '360': { width: 640, height: 360, frameRate: 30, bitrate: 600000 },
  '240': { width: 426, height: 240, frameRate: 15, bitrate: 300000 },
};

export function useWebRTC(roomId: string, userId: string, username: string, displayName: string, avatar?: string) {
  const [peers, setPeers] = useState<Map<string, Peer>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isMutedAll, setIsMutedAll] = useState(false);
  const [quality, setQuality] = useState<QualityLevel>('720');
  const socketRef = useRef<WebSocket | null>(null);
  const peersRef = useRef<Map<string, Peer>>(new Map());

  const iceServers: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:bn-turn2.xirsys.com' },
      // Add TURN servers here for relay support when P2P fails
      ...((import.meta as any).env.VITE_TURN_URL ? [{
        urls: (import.meta as any).env.VITE_TURN_URL,
        username: (import.meta as any).env.VITE_TURN_USERNAME,
        credential: (import.meta as any).env.VITE_TURN_PASSWORD
      }] : [])
    ],
    iceCandidatePoolSize: 10,
  };

  useEffect(() => {
    if (localStream) {
      peersRef.current.forEach(peer => {
        // Only add tracks if they haven't been added yet
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
            video: { width: preset.width, height: preset.height, frameRate: preset.frameRate },
            audio: true
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
    const pc = new RTCPeerConnection(iceServers);

    const peer: Peer = {
      userId: targetId,
      username: targetUsername,
      displayName: targetDisplayName,
      avatar: targetAvatar,
      connection: pc,
      isMuted: false // Default to false, will be updated by mute-status
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

    pc.ontrack = (event) => {
      setPeers(prev => {
        const newPeers = new Map<string, Peer>(prev);
        const existing = newPeers.get(targetId);
        if (existing) {
          existing.stream = event.streams[0];
        }
        return newPeers;
      });
    };

    // Add local tracks if available
    if (localStream) {
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }

    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current?.send(JSON.stringify({
        type: 'signal',
        targetId,
        senderId: userId,
        signal: { sdp: offer }
      }));
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
        socketRef.current?.send(JSON.stringify({
          type: 'signal',
          targetId: senderId,
          senderId: userId,
          signal: { sdp: answer }
        }));
      }
    } else if (signal.candidate) {
      await peer.connection.addIceCandidate(new RTCIceCandidate(signal.candidate));
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      setLocalStream(stream);
      peersRef.current.forEach(peer => {
        stream.getTracks().forEach(track => peer.connection.addTrack(track, stream));
      });
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
      // Some browsers/OS don't support system audio sharing, so we handle it gracefully
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
        video: {
          width: preset.width,
          height: preset.height,
          frameRate: preset.frameRate
        }, 
        audio: true 
      }).catch(() => {
        // Fallback to video only if audio sharing is rejected or unsupported
        return navigator.mediaDevices.getDisplayMedia({ 
          video: {
            width: preset.width,
            height: preset.height,
            frameRate: preset.frameRate
          }
        });
      });

      setIsScreenSharing(true);
      const videoTrack = screenStream.getVideoTracks()[0];
      
      peersRef.current.forEach(peer => {
        const sender = peer.connection.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
          // Set bitrate for screen share
          const params = sender.getParameters();
          if (!params.encodings) params.encodings = [{}];
          params.encodings[0].maxBitrate = preset.bitrate;
          sender.setParameters(params).catch(console.error);
        }
      });

      videoTrack.onended = () => stopScreenShare();
      
      return screenStream;
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
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    peersRef.current.forEach(peer => {
      const sender = peer.connection.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        sender.replaceTrack(videoTrack);
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
