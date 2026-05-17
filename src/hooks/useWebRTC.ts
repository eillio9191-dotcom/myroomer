import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_SERVER_URL = (import.meta as any).env.VITE_SOCKET_URL || 'http://localhost:3000';

export interface Peer {
  userId: string;
  username: string;
  displayName: string;
  avatar?: string;
  stream?: MediaStream;
  connection: RTCPeerConnection;
  isMuted?: boolean;
  camOn?: boolean;
  micOn?: boolean;
  polite?: boolean;
  ignoreOffer?: boolean;
  makingOffer?: boolean;
  makingOfferRef?: React.MutableRefObject<boolean>;
  ignoreOfferRef?: React.MutableRefObject<boolean>;
  iceRestartAttemptsRef?: React.MutableRefObject<number>;
}

export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  username: string;
  displayName: string;
  avatar?: string;
  timestamp: number;
  file?: {
    name: string;
    type: string;
    url: string;
    size: number;
  };
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

export function useWebRTC(roomId: string, userId: string, username: string, displayName: string, avatar?: string, options?: { onMuteForced?: () => void; onUnmuteForced?: () => void }) {
  console.log('useWebRTC initialized with:', { roomId, userId, username, displayName, avatar });
  const [peers, setPeers] = useState<Map<string, Peer>>(new Map());
  const [localStream, _setLocalStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const setLocalStream = (stream: MediaStream | null) => {
    localStreamRef.current = stream;
    _setLocalStream(stream);
  };

  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isMutedAll, setIsMutedAll] = useState(false);
  const [quality, setQuality] = useState<QualityLevel>('720');
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const peersRef = useRef<Map<string, Peer>>(new Map());
  const pendingJoinRef = useRef<{ isOwner: boolean; initialRoomTag?: string } | null>(null);
  const pendingPeerRequestsRef = useRef<Map<string, { targetUsername: string; targetDisplayName: string; targetAvatar?: string; isInitiator: boolean }>>(new Map());

  const turnUrls = ((import.meta as any).env.VITE_TURN_URL || '').split(',').map((url: string) => url.trim()).filter(Boolean);
  const turnUsername = (import.meta as any).env.VITE_TURN_USERNAME;
  const turnPassword = (import.meta as any).env.VITE_TURN_PASSWORD;

  if (!turnUrls.length) {
    console.warn('TURN is not configured. For mandatory ICE/relay support, add VITE_TURN_URL, VITE_TURN_USERNAME, and VITE_TURN_PASSWORD in Render.');
  }

  const iceServers: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.services.mozilla.com' },
      { urls: 'stun:bn-turn2.xirsys.com' },
      ...(turnUrls.length > 0 ? [{
        urls: turnUrls,
        username: turnUsername,
        credential: turnPassword
      }] : [])
    ],
    iceTransportPolicy: turnUrls.length > 0 ? 'relay' : 'all'
  };

  const socketRef = useRef<Socket | null>(null);

  const ensureSocket = () => {
    if (socketRef.current) return socketRef.current;

    const socket = io(SOCKET_SERVER_URL, {
      transports: ['websocket'],
      autoConnect: false
    });

    socketRef.current = socket;
    return socket;
  };

  const canSendSocket = () => !!socketRef.current?.connected;

  const sendState = (message: any) => {
    const socket = socketRef.current;
    if (!socket || !roomId) return;
    socket.emit('room-state', {
      roomId,
      message: {
        ...message,
        timestamp: Date.now(),
        senderId: userId
      }
    });
  };

  const sendControl = (targetId: string, message: any) => {
    if (!targetId) return;
    const socket = socketRef.current;
    if (!socket || !roomId) return;
    socket.emit('control', {
      roomId,
      targetId,
      message: {
        ...message,
        timestamp: Date.now(),
        senderId: userId
      }
    });
  };

  const sendSignal = (targetId: string, signal: any) => {
    if (!targetId) return;
    const socket = socketRef.current;
    if (!socket || !roomId) return;
    socket.emit('signal', {
      roomId,
      targetId,
      signal
    });
  };

  const sendChat = (message: any) => {
    const socket = socketRef.current;
    if (!socket || !roomId) return;
    socket.emit('chat', {
      roomId,
      message: {
        ...message,
        timestamp: Date.now(),
        senderId: userId
      }
    });
  };

  const flushPendingPeerRequests = async () => {
    const queued = Array.from(pendingPeerRequestsRef.current.entries()) as Array<[string, { targetUsername: string; targetDisplayName: string; targetAvatar?: string; isInitiator: boolean }]>
    pendingPeerRequestsRef.current.clear();

    for (const [targetId, request] of queued) {
      await createPeer(targetId, request.targetUsername, request.targetDisplayName, request.targetAvatar, request.isInitiator);
    }
  };

  useEffect(() => {
    if (!localStream) {
      console.log('useEffect localStream: no localStream');
      return;
    }
    
    console.log('useEffect localStream: updating tracks for peers');
    peersRef.current.forEach((peer) => {
      const senders = peer.connection.getSenders();
      const tracksToAdd = localStream.getTracks().filter(track => 
        !senders.some(s => s.track?.kind === track.kind)
      );
      
      tracksToAdd.forEach(track => {
        try {
          peer.connection.addTrack(track, localStream);
        } catch (err) {
          console.error(`Error adding track to peer ${peer.userId}:`, err);
        }
      });
    });

    flushPendingPeerRequests().catch(console.error);
  }, [localStream]);

  const [lobbyRequests, setLobbyRequests] = useState<Peer[]>([]);
  const [isWaitingInLobby, setIsWaitingInLobby] = useState(false);
  const [hasRoomInfo, _setHasRoomInfo] = useState(false);
  const hasRoomInfoRef = useRef(false);
  const setHasRoomInfo = (val: boolean) => {
    hasRoomInfoRef.current = val;
    _setHasRoomInfo(val);
  };

  const displayNameRef = useRef(displayName);
  const avatarRef = useRef(avatar);

  useEffect(() => {
    displayNameRef.current = displayName;
    avatarRef.current = avatar;
  }, [displayName, avatar]);

  const pendingPeerCreatesRef = useRef<Array<{
    targetId: string;
    targetUsername: string;
    targetDisplayName: string;
    targetAvatar?: string;
    isInitiator: boolean;
    camOn?: boolean;
    micOn?: boolean;
  }>>([]);
  const [isForceMuted, setIsForceMuted] = useState(false);
  const [isKicked, setIsKicked] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [ownerKey, setOwnerKey] = useState('');
  const [autoAccept, setAutoAccept] = useState(false);
  const [autoReject, setAutoReject] = useState(false);
  const [broadcastQuality, setBroadcastQuality] = useState(false);
  const [roomTag, setRoomTag] = useState('');
  const [incomingCall, setIncomingCall] = useState<{ callerId: string; callerDisplayName: string; callerAvatar?: string; roomId: string } | null>(null);
  const joinedAtRef = useRef<number | null>(null);
  const ownerIdRef = useRef<string | null>(null);
  
  // Refs to prevent stale closures and ensure latest state
  const localStreamReadyRef = useRef(false);
  const roomInfoReadyRef = useRef(false);
  const isOwnerRef = useRef(false);
  
  useEffect(() => {
    localStreamReadyRef.current = !!localStream;
  }, [localStream]);
  
  useEffect(() => {
    roomInfoReadyRef.current = hasRoomInfo;
  }, [hasRoomInfo]);
  
  useEffect(() => {
    isOwnerRef.current = isOwner;
  }, [isOwner]);

  const attemptJoin = async (isOwner: boolean, initialRoomTag?: string) => {
    if (!roomId) {
      console.error('attemptJoin called with empty roomId');
      return;
    }
    pendingJoinRef.current = null;
    setIsOwner(isOwner);

    const joinedAt = Date.now();
    joinedAtRef.current = joinedAt;
    if (isOwner) {
      ownerIdRef.current = userId;
    }

    const socket = ensureSocket();
    if (!socket) {
      console.error('Socket not available for join');
      return;
    }

    const camOn = localStreamRef.current ? localStreamRef.current.getVideoTracks().some(t => t.enabled) : false;
    const micOn = localStreamRef.current ? localStreamRef.current.getAudioTracks().some(t => t.enabled) : true;

    const userPayload = {
      userId,
      username,
      displayName: displayNameRef.current,
      avatar: avatarRef.current,
      isOwner,
      camOn,
      micOn,
      joinedAt
    };

    socket.emit('join-room', {
      roomId,
      user: userPayload
    });

    if (initialRoomTag) {
      setRoomTag(initialRoomTag);
    }

    sendState({
      type: 'room-info',
      roomId,
      roomTag: initialRoomTag || roomTag,
      autoAccept,
      autoReject,
      isOwner,
      ownerId: isOwner ? userId : ownerIdRef.current
    });
  };

  const leaveRoom = async () => {
    if (!roomId) return;

    const socket = socketRef.current;
    if (!socket) return;

    try {
      socket.emit('leave-room', { roomId, userId });
      socket.disconnect();
    } catch (err) {
      console.error('Failed during leave room:', err);
    } finally {
      socketRef.current = null;
    }
  };

  const queuePeerRequest = (targetId: string, targetUsername: string, targetDisplayName: string, targetAvatar: string | undefined, isInitiator: boolean) => {
    pendingPeerRequestsRef.current.set(targetId, { targetUsername, targetDisplayName, targetAvatar, isInitiator });
  };

  useEffect(() => {
    if (!roomId) {
      console.log('useEffect: no roomId, skipping Socket.IO setup');
      return;
    }

    console.log('useEffect: setting up Socket.IO listeners for roomId:', roomId);

    pendingJoinRef.current = null;
    pendingPeerRequestsRef.current.clear();

    const socket = ensureSocket();
    const startTime = Date.now() - 1000;

    const isMessageFromOwner = (msg: any) => {
      return ownerIdRef.current ? msg.senderId === ownerIdRef.current : true;
    };

    const processStateMessage = async (msg: any) => {
      if (!msg || msg.senderId === userId || msg.timestamp < startTime) return;

      switch (msg.type) {
        case 'room-info':
          console.log('Received room-info:', msg);
          if (msg.roomTag) setRoomTag(msg.roomTag);
          if (msg.autoAccept !== undefined) setAutoAccept(msg.autoAccept);
          if (msg.autoReject !== undefined) setAutoReject(msg.autoReject);
          setHasRoomInfo(true);
          setIsWaitingInLobby(false);
          if (msg.ownerId) {
            ownerIdRef.current = msg.ownerId;
          }
          break;
        case 'you-are-owner':
          console.log('Received you-are-owner');
          setIsOwner(true);
          if (msg.ownerKey) setOwnerKey(msg.ownerKey);
          ownerIdRef.current = msg.senderId;
          break;
        case 'waiting-in-lobby':
          console.log('Received waiting-in-lobby');
          setIsWaitingInLobby(true);
          setHasRoomInfo(false);
          break;
        case 'lobby-request':
          console.log('Received lobby-request:', msg);
          setLobbyRequests(prev => {
            if (prev.find(r => r.userId === msg.userId)) return prev;
            return [...prev, {
              userId: msg.userId,
              username: msg.username,
              displayName: msg.displayName,
              avatar: msg.avatar,
              connection: null as any
            }];
          });
          break;
        case 'lobby-rejected':
          console.log('Received lobby-rejected');
          setIsWaitingInLobby(false);
          alert('Your request to join was rejected.');
          break;
        case 'kicked':
          if (!isMessageFromOwner(msg)) return;
          console.log('Received kicked');
          setIsKicked(true);
          break;
        case 'room-deleted':
          if (!isMessageFromOwner(msg)) return;
          alert('The room has been deleted by the owner.');
          window.location.href = '/';
          break;
        case 'incoming-call':
          setIncomingCall({
            callerId: msg.callerId,
            callerDisplayName: msg.callerDisplayName,
            callerAvatar: msg.callerAvatar,
            roomId: msg.roomId
          });
          break;
        case 'quality-request':
          {
            const peerToUpdate = peersRef.current.get(msg.senderId);
            if (peerToUpdate) {
              const preset = QUALITY_PRESETS[msg.level as QualityLevel];
              const sender = peerToUpdate.connection.getSenders().find(s => s.track?.kind === 'video');
              if (sender) {
                const params = sender.getParameters();
                if (!params.encodings) params.encodings = [{}];
                params.encodings[0].maxBitrate = preset.bitrate;
                sender.setParameters(params).catch(console.error);
              }
            }
          }
          break;
        case 'mute-status':
          setPeers(prev => {
            const newPeers = new Map<string, Peer>(prev);
            const existing = newPeers.get(msg.senderId);
            if (existing) {
              newPeers.set(msg.senderId, {
                ...existing,
                isMuted: msg.isMuted,
                micOn: !msg.isMuted
              });
            }
            return newPeers;
          });
          break;
        case 'cam-status':
          setPeers(prev => {
            const newPeers = new Map<string, Peer>(prev);
            const existing = newPeers.get(msg.senderId);
            if (existing) {
              newPeers.set(msg.senderId, {
                ...existing,
                camOn: msg.camOn
              });
            }
            return newPeers;
          });
          break;
        case 'force-mute':
          if (!isMessageFromOwner(msg)) return;
          if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(track => {
              track.enabled = false;
            });
          }
          setIsForceMuted(true);
          sendMuteStatus(true);
          options?.onMuteForced?.();
          break;
        case 'force-unmute':
          if (!isMessageFromOwner(msg)) return;
          setIsForceMuted(false);
          options?.onUnmuteForced?.();
          break;
        case 'profile-update':
          setPeers(prev => {
            const newPeers = new Map<string, Peer>(prev);
            const existing = newPeers.get(msg.senderId);
            if (existing) {
              newPeers.set(msg.senderId, {
                ...existing,
                displayName: msg.displayName,
                avatar: msg.avatar
              });
            }
            return newPeers;
          });
          break;
        default:
          break;
      }
    };

    const processChatMessage = (msg: any) => {
      if (!msg || msg.senderId === userId || msg.timestamp < startTime) return;
      setMessages(prev => [...prev, {
        id: msg.id || `${msg.senderId}-${msg.timestamp}-${Math.random().toString(36).substr(2, 9)}`,
        text: msg.text,
        senderId: msg.senderId,
        username: msg.username,
        displayName: msg.displayName,
        avatar: msg.avatar,
        timestamp: msg.timestamp,
        file: msg.file
      }]);
    };

    const processControlMessage = (msg: any) => {
      if (!msg || msg.senderId === userId || msg.timestamp < startTime) return;

      switch (msg.type) {
        case 'lobby-approve':
          setIsWaitingInLobby(false);
          setHasRoomInfo(true);
          break;
        case 'lobby-reject':
          setIsWaitingInLobby(false);
          alert('Your request to join was rejected.');
          break;
        case 'kicked':
          setIsKicked(true);
          break;
        case 'force-mute':
          if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(track => {
              track.enabled = false;
            });
          }
          setIsForceMuted(true);
          sendMuteStatus(true);
          options?.onMuteForced?.();
          break;
        case 'permit-speak':
          setIsForceMuted(false);
          if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(track => {
              track.enabled = true;
            });
          }
          options?.onUnmuteForced?.();
          break;
        case 'incoming-call':
          setIncomingCall({
            callerId: msg.callerId,
            callerDisplayName: msg.callerDisplayName,
            callerAvatar: msg.callerAvatar,
            roomId: msg.roomId
          });
          break;
        default:
          break;
      }
    };

    const processSignalMessage = async (msg: any) => {
      if (!msg || msg.senderId === userId || msg.timestamp < startTime) return;
      await handleSignal(msg.senderId, msg.signal);
    };

    const handleUserJoined = async ({ user }: any) => {
      if (!user || user.userId === userId) return;
      if (peersRef.current.has(user.userId)) return;

      // Ensure stream and room info are ready before creating peer
      if (!localStreamReadyRef.current || !roomInfoReadyRef.current) {
        console.log(`Deferring peer creation for ${user.userId}: stream=${localStreamReadyRef.current}, roomInfo=${roomInfoReadyRef.current}`);
        queuePeerRequest(user.userId, user.username, user.displayName, user.avatar, false);
        return;
      }

      const isInitiator = (() => {
        if (isOwnerRef.current && !user.isOwner) return true;
        if (!isOwnerRef.current && user.isOwner) return false;
        if (joinedAtRef.current && user.joinedAt) {
          if (joinedAtRef.current !== user.joinedAt) {
            return joinedAtRef.current < user.joinedAt;
          }
        }
        return userId < user.userId;
      })();

      await createPeer(
        user.userId,
        user.username,
        user.displayName,
        user.avatar,
        isInitiator,
        user.camOn,
        user.micOn
      );
    };

    const handleExistingUsers = async ({ users }: any) => {
      if (!Array.isArray(users)) return;
      
      // Ensure stream and room info are ready before creating peers
      if (!localStreamReadyRef.current || !roomInfoReadyRef.current) {
        console.log(`Deferring existing users processing: stream=${localStreamReadyRef.current}, roomInfo=${roomInfoReadyRef.current}`);
        for (const user of users) {
          if (!user || user.userId === userId) continue;
          if (peersRef.current.has(user.userId)) continue;
          queuePeerRequest(user.userId, user.username, user.displayName, user.avatar, false);
        }
        return;
      }

      for (const user of users) {
        if (!user || user.userId === userId) continue;
        if (peersRef.current.has(user.userId)) continue;

        const isInitiator = (() => {
          if (isOwnerRef.current && !user.isOwner) return true;
          if (!isOwnerRef.current && user.isOwner) return false;
          if (joinedAtRef.current && user.joinedAt) {
            if (joinedAtRef.current !== user.joinedAt) {
              return joinedAtRef.current < user.joinedAt;
            }
          }
          return userId < user.userId;
        })();

        await createPeer(
          user.userId,
          user.username,
          user.displayName,
          user.avatar,
          isInitiator,
          user.camOn,
          user.micOn
        );
      }
    };

    const handleUserLeft = ({ userId: leftUserId }: any) => {
      if (leftUserId && leftUserId !== userId) {
        removePeer(leftUserId);
      }
    };

    const handleSocketDisconnect = (reason: any) => {
      console.log('Socket disconnected:', reason);
    };

    const handleSocketConnect = () => {
      console.log('Socket connected:', socket.id);
    };

    socket.on('connect', handleSocketConnect);
    socket.on('disconnect', handleSocketDisconnect);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('existing-users', handleExistingUsers);
    socket.on('signal', processSignalMessage);
    socket.on('chat', processChatMessage);
    socket.on('room-state', ({ message }: any) => processStateMessage(message));
    socket.on('control', ({ message }: any) => processControlMessage(message));

    socket.connect();

    return () => {
      socket.off('connect', handleSocketConnect);
      socket.off('disconnect', handleSocketDisconnect);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('existing-users', handleExistingUsers);
      socket.off('signal', processSignalMessage);
      socket.off('chat', processChatMessage);
      socket.off('room-state');
      socket.off('control');

      leaveRoom().catch(console.error);
    };
  }, [roomId, userId, username, displayName, avatar, isOwner]);


  const joinRoom = (isOwner: boolean, initialRoomTag?: string) => {
    console.log(`joinRoom called: roomId=${roomId}, isOwner=${isOwner}`);
    if (!roomId) {
      console.error('joinRoom called with empty roomId');
      return;
    }
    attemptJoin(isOwner, initialRoomTag);
  };

  const updateRoomTag = (newTag: string) => {
    if (roomId) {
      sendState({
        type: 'update-room-tag',
        roomTag: newTag
      });
    }
  };

  const approveUser = (targetId: string) => {
    if (roomId) {
      sendControl(targetId, { type: 'lobby-approve' });
      setLobbyRequests(prev => prev.filter(r => r.userId !== targetId));
    }
  };

  const approveAll = () => {
    if (roomId) {
      lobbyRequests.forEach(req => {
        sendControl(req.userId, { type: 'lobby-approve' });
      });
      setLobbyRequests([]);
    }
  };

  const rejectUser = (targetId: string) => {
    if (roomId) {
      sendControl(targetId, { type: 'lobby-reject' });
      setLobbyRequests(prev => prev.filter(r => r.userId !== targetId));
    }
  };

  const rejectAll = () => {
    if (roomId) {
      lobbyRequests.forEach(req => {
        sendControl(req.userId, { type: 'lobby-reject' });
      });
      setLobbyRequests([]);
    }
  };

  const kickUser = (targetId: string) => {
    if (!isOwner) return;
    if (roomId) {
      sendControl(targetId, { type: 'kicked' });
    }
  };

  const deleteRoom = () => {
    if (!isOwner) return;
    if (roomId) {
      sendState({ type: 'delete-room' });
    }
  };

  const forceMute = (targetId?: string, muteAll?: boolean) => {
    console.log('forceMute initiated:', { targetId, muteAll, roomId });
    if (!isOwner) return;
    if (roomId) {
      if (targetId) {
        sendControl(targetId, {
          type: 'force-mute',
          muteAll: false
        });
      } else {
        sendState({
          type: 'force-mute',
          muteAll: true
        });
      }

      // Optimistic local update for owner UI feedback
      setPeers(prev => {
        const next = new Map(prev);
        if (muteAll) {
          next.forEach((peer, id) => {
            next.set(id, { ...peer, isMuted: true });
          });
        } else if (targetId) {
          const peer = next.get(targetId);
          if (peer) {
            next.set(targetId, { ...peer, isMuted: true });
          }
        }
        return next;
      });
    }
  };

  const permitSpeak = (targetId: string) => {
    if (roomId) {
      sendControl(targetId, {
        type: 'permit-speak'
      });

      // Optimistic local update
      setPeers(prev => {
        const next = new Map(prev);
        const peer = next.get(targetId);
        if (peer) {
          next.set(targetId, { ...peer, isMuted: false });
        }
        return next;
      });
    }
  };

  const directCall = (targetId: string, providedRoomId?: string) => {
    if (roomId) {
      sendControl(targetId, {
        type: 'incoming-call',
        callerId: userId,
        callerDisplayName: displayName,
        callerAvatar: avatar,
        roomId: providedRoomId
      });
    }
  };

  const updateRoomSettings = (autoAccept: boolean, autoReject: boolean) => {
    if (roomId) {
      sendState({
        type: 'room-settings',
        autoAccept,
        autoReject
      });
    }
  };

  const updateProfile = (newDisplayName: string, newAvatar?: string) => {
    if (roomId) {
      sendState({
        type: 'profile-update',
        displayName: newDisplayName,
        avatar: newAvatar
      });
    }
  };

  const changeQuality = async (level: QualityLevel) => {
    setQuality(level);
    const preset = QUALITY_PRESETS[level];

    // Notify all peers about our desired reception quality
    peersRef.current.forEach(peer => {
      if (roomId) {
        sendState({
          type: 'quality-request',
          targetId: peer.userId,
          level
        });
      }
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
    if (roomId) {
      sendState({
        type: 'mute-status',
        isMuted
      });
    }
  };
  
  const sendCamStatus = (camOn: boolean) => {
    if (roomId) {
      sendState({
        type: 'cam-status',
        camOn
      });
    }
  };

  const sendChatMessage = (text: string, file?: ChatMessage['file']) => {
    const timestamp = Date.now();
    const msgId = `${userId}-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
    const chatMessage = {
      type: 'chat',
      id: msgId,
      text,
      senderId: userId,
      username,
      displayName,
      avatar,
      timestamp,
      file
    };
    setMessages(prev => [...prev, chatMessage]);
    if (roomId) {
      sendChat(chatMessage);
    }
  };

  const toggleMuteAll = () => {
    if (!isOwner) return;
    const newState = !isMutedAll;
    setIsMutedAll(newState);
    
    // Command all others to mute/unmute
    forceMute(undefined, newState);

    // Update existing peer track states locally (reception)
    peersRef.current.forEach(peer => {
      if (peer.stream) {
        peer.stream.getAudioTracks().forEach(track => {
          track.enabled = !newState;
        });
      }
    });

    // Also update peers map state to trigger re-render of mute icons if needed
    setPeers(prev => {
      const next = new Map(prev);
      next.forEach((peer, id) => {
        next.set(id, { ...peer });
      });
      return next;
    });
  };

  const createPeer = async (targetId: string, targetUsername: string, targetDisplayName: string, targetAvatar: string | undefined, isInitiator: boolean, initialCamOn?: boolean, initialMicOn?: boolean) => {
    const stream = localStreamRef.current;
    console.log(`createPeer called for ${targetId}, initiator: ${isInitiator}, localStream ready: ${!!stream}, roomId=${roomId}`);
    const existingPeer = peersRef.current.get(targetId);
    if (existingPeer) {
      console.log(`Updating existing peer info for ${targetId}`);
      peersRef.current.set(targetId, {
        ...existingPeer,
        username: targetUsername,
        displayName: targetDisplayName,
        avatar: targetAvatar,
        camOn: initialCamOn ?? existingPeer.camOn,
        micOn: initialMicOn ?? existingPeer.micOn
      });
      setPeers(new Map(peersRef.current));
      return;
    }

    if (!canSendSocket()) {
      console.warn(`Deferring peer creation for ${targetId}: socket not ready`);
      queuePeerRequest(targetId, targetUsername, targetDisplayName, targetAvatar, isInitiator);
      return;
    }

    const pc = new RTCPeerConnection(iceServers);
    const makingOfferRef = { current: false };
    const ignoreOfferRef = { current: false };
    const iceRestartAttemptsRef = { current: 0 };
    const MAX_ICE_RESTARTS = 2;

    const peer: Peer = {
      userId: targetId,
      username: targetUsername,
      displayName: targetDisplayName,
      avatar: targetAvatar,
      connection: pc,
      isMuted: initialMicOn === false,
      camOn: initialCamOn ?? true,
      micOn: initialMicOn ?? true,
      polite: !isInitiator,
      ignoreOffer: false,
      makingOffer: false,
      makingOfferRef,
      ignoreOfferRef,
      iceRestartAttemptsRef
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && roomId) {
        sendSignal(targetId, { candidate: event.candidate });
      }
    };

    pc.onnegotiationneeded = async () => {
      try {
        if (makingOfferRef.current) return;
        if (pc.signalingState !== 'stable') return;
        
        makingOfferRef.current = true;
        console.log(`Negotiation needed for ${targetId}`);
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') {
          makingOfferRef.current = false;
          return;
        }
        await pc.setLocalDescription(offer);
        if (roomId) {
          sendSignal(targetId, { sdp: pc.localDescription });
        }
      } catch (err) {
        console.error("Negotiation error:", err);
      } finally {
        makingOfferRef.current = false;
      }
    };

    pc.ontrack = (event) => {
      console.log(`Received remote track from ${targetId}`);
      setPeers(prev => {
        const newPeers = new Map<string, Peer>(prev);
        const existing = newPeers.get(targetId);
        if (existing) {
          newPeers.set(targetId, {
            ...existing,
            stream: event.streams[0]
          });
        }
        return newPeers;
      });
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state with ${targetId}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed') {
        if (iceRestartAttemptsRef.current < MAX_ICE_RESTARTS) {
          console.log(`ICE failed with ${targetId}, attempting restart (${iceRestartAttemptsRef.current + 1}/${MAX_ICE_RESTARTS})...`);
          iceRestartAttemptsRef.current++;
          pc.restartIce();
        } else {
          console.error(`ICE failed too many times with ${targetId}, giving up`);
          removePeer(targetId);
        }
      }
    };

    // Add local tracks if available
    if (stream) {
      stream.getTracks().forEach(track => {
        try {
          pc.addTrack(track, stream);
        } catch (err) {
          console.error(`Error adding track to peer ${targetId}:`, err);
        }
      });
    }

    if (isInitiator) {
      try {
        makingOfferRef.current = true;
        console.log(`Initiating call to ${targetId}`);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (roomId) {
          sendSignal(targetId, { sdp: pc.localDescription });
        }
      } catch (err) {
        console.error("Initial offer error:", err);
      } finally {
        makingOfferRef.current = false;
      }
    }

    peersRef.current.set(targetId, peer);
    setPeers(new Map(peersRef.current));
  };

  const handleSignal = async (senderId: string, signal: any) => {
    let peer = peersRef.current.get(senderId);
    
    // If peer doesn't exist yet, we might need to create it (e.g. receiving an offer before user-joined)
    if (!peer && signal.sdp && signal.sdp.type === 'offer') {
      console.log(`Received offer for non-existent peer ${senderId}, creating now...`);
      await createPeer(senderId, 'Unknown', 'User', undefined, false);
      peer = peersRef.current.get(senderId);
    }

    if (!peer) return;

    try {
      if (signal.sdp) {
        console.log(`Received SDP ${signal.sdp.type} from ${senderId}, signalingState: ${peer.connection.signalingState}`);
        
        // Perfect Negotiation pattern: handle glare (offer collision)
        // If we receive an offer while not in stable state, decide based on polite flag
        if (signal.sdp.type === 'offer') {
          if (peer.connection.signalingState !== 'stable' && !peer.polite) {
            // Impolite peer ignores offer during collision
            console.log(`Offer collision: impolite peer ${senderId} ignoring incoming offer`);
            return;
          }
          // Polite peer accepts and rolls back if needed
          if (peer.connection.signalingState === 'have-local-offer') {
            console.log(`Offer collision: polite peer ${senderId} rolling back local offer`);
            await peer.connection.setLocalDescription({ type: 'rollback' } as any);
          }
        }

        await peer.connection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        
        if (signal.sdp.type === 'offer') {
          const answer = await peer.connection.createAnswer();
          await peer.connection.setLocalDescription(answer);
          if (roomId) {
            sendSignal(senderId, { sdp: peer.connection.localDescription });
          }
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

  const toggleMedia = async (type: 'audio' | 'video', forceState?: boolean) => {
    if (!localStream) {
      console.warn("Cannot toggle media: localStream not initialized");
      return;
    }

    const tracks = type === 'audio' ? localStream.getAudioTracks() : localStream.getVideoTracks();
    let track = tracks[0];

    if (!track || track.readyState === 'ended') {
      // If we're trying to turn it ON but the track is missing or ended
      if (forceState !== false) {
        try {
          const constraints = type === 'audio' ? { audio: true } : { 
            video: { 
              width: { ideal: 1280 }, 
              height: { ideal: 720 },
              frameRate: { ideal: 30 }
            } 
          };
          const newStream = await navigator.mediaDevices.getUserMedia(constraints);
          const newTrack = newStream.getTracks()[0];
          
          if (newTrack) {
            localStream.addTrack(newTrack);
            // Re-create the stream object to trigger React re-renders for consumers of localStream
            const updatedStream = new MediaStream(localStream.getTracks());
            setLocalStream(updatedStream);
            track = newTrack;
            
            // Replace tracks for all peers
            peersRef.current.forEach(peer => {
              const senders = peer.connection.getSenders();
              const sender = senders.find(s => s.track?.kind === type);
              if (sender) {
                sender.replaceTrack(newTrack).catch(console.error);
              } else {
                peer.connection.addTrack(newTrack, localStream);
              }
            });
          }
        } catch (err) {
          console.error(`Failed to acquire ${type} track:`, err);
          return;
        }
      }
    }

    if (track) {
      track.enabled = forceState !== undefined ? forceState : !track.enabled;
      if (type === 'audio') {
        sendMuteStatus(!track.enabled);
      } else {
        sendCamStatus(track.enabled);
      }
    }
  };

  const startScreenShare = async () => {
    try {
      console.log('Attempting to start screen share...');

      // Check if we're in an iframe and suggest opening in new tab
      if (window.self !== window.top) {
        throw new Error("Screen sharing is blocked in the preview iframe. Please click 'Open in New Tab' to use this feature.");
      }

      // Check for HTTPS requirement
      if (!window.isSecureContext && window.location.protocol !== 'http:') {
        throw new Error("Screen sharing requires a secure (HTTPS) connection.");
      }

      const mediaDevices = navigator.mediaDevices as any;
      const getDisplayMedia = (
        mediaDevices?.getDisplayMedia ||
        (navigator as any).getDisplayMedia ||
        (mediaDevices?.webkitGetDisplayMedia) ||
        (mediaDevices?.mozGetDisplayMedia)
      )?.bind(mediaDevices || navigator);

      if (!getDisplayMedia) {
        console.error('getDisplayMedia is not available:', {
          hasMediaDevices: !!navigator.mediaDevices,
          hasGetDisplayMedia: !!navigator.mediaDevices?.getDisplayMedia,
          isSecureContext: window.isSecureContext,
          userAgent: navigator.userAgent
        });

        let errorMsg = "Screen sharing is not supported by your browser or environment.";
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (isMobile) {
          errorMsg = "Screen sharing is not supported on mobile browsers. Please use a desktop browser.";
        } else if (!window.isSecureContext) {
          errorMsg = "Screen sharing requires a secure (HTTPS) connection.";
        } else if (window.self !== window.top) {
          errorMsg = "Screen sharing is blocked in the preview iframe. Please click 'Open in New Tab' to use this feature.";
        }

        throw new Error(errorMsg);
      }

      const preset = QUALITY_PRESETS[quality];

      // Try with preferred constraints
      let stream: MediaStream;
      try {
        stream = await getDisplayMedia({
          video: {
            width: { ideal: preset.width },
            height: { ideal: preset.height },
            frameRate: { max: preset.frameRate }
          },
          audio: true
        });
      } catch (e) {
        console.log('Failed to get screen share with audio, retrying without audio...', e);
        // Fallback without audio
        stream = await getDisplayMedia({
          video: {
            width: { ideal: preset.width },
            height: { ideal: preset.height },
            frameRate: { max: preset.frameRate }
          }
        });
      }

      setScreenStream(stream);
      setIsScreenSharing(true);
      stream.getTracks().forEach(t => t.enabled = true);
      const videoTrack = stream.getVideoTracks()[0];

      peersRef.current.forEach(peer => {
        const senders = peer.connection.getSenders();
        const videoSender = senders.find(s => s.track?.kind === 'video');

        if (videoSender) {
          videoSender.replaceTrack(videoTrack).then(() => {
            // Re-apply quality settings after track replacement
            const params = videoSender.getParameters();
            if (!params.encodings) params.encodings = [{}];
            params.encodings[0].maxBitrate = preset.bitrate;
            videoSender.setParameters(params).catch(console.error);
          });
        } else {
          // If no video sender exists (e.g. cam was off), add the track
          peer.connection.addTrack(videoTrack, stream);
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
      throw err; // Re-throw so App.tsx can handle it
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
    if (!videoTrack) {
      setIsScreenSharing(false);
      return;
    }

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
        }).catch(err => console.error("Error replacing track:", err));
      }
    });
    setIsScreenSharing(false);
  };

const claimOwnership = (code: string) => {
    if (!roomId) return;
    sendState({
      type: 'claim-ownership',
      ownerKey: code
    });
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
    ownerKey,
    autoAccept,
    setAutoAccept,
    autoReject,
    setAutoReject,
    joinRoom,
    approveUser,
    rejectUser,
    approveAll,
    rejectAll,
    kickUser,
    deleteRoom,
    forceMute,
    permitSpeak,
    directCall,
    setIncomingCall,
    updateRoomSettings,
    claimOwnership,
    sendCamStatus,
    isForceMuted
  };
}
