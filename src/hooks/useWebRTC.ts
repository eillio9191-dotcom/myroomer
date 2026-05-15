import { useEffect, useRef, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, off, push, set, onDisconnect, onChildAdded, onChildRemoved } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

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

  const turnUrls = (import.meta as any).env.VITE_TURN_URL?.split(',') || [];

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
        username: (import.meta as any).env.VITE_TURN_USERNAME,
        credential: (import.meta as any).env.VITE_TURN_PASSWORD
      }] : [])
    ],
  };

  // Firebase-based messaging instead of WebSocket
  const canSendSocket = () => true; // Always true for Firebase

  const sendToFirebase = (message: any) => {
    const roomRef = ref(database, `rooms/${roomId}/messages`);
    push(roomRef, {
      ...message,
      timestamp: Date.now(),
      senderId: userId
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
        peer.connection.addTrack(track, localStream).catch(err => {
          console.error(`Error adding track to peer ${peer.userId}:`, err);
        });
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

  // Firebase presence join
  const attemptJoin = async (isOwner: boolean, initialRoomTag?: string) => {
    if (!roomId) {
      console.error('attemptJoin called with empty roomId');
      return;
    }
    pendingJoinRef.current = null;
    setIsOwner(isOwner);

    const presenceRef = ref(database, `rooms/${roomId}/users/${userId}`);
    const camOn = localStreamRef.current ? localStreamRef.current.getVideoTracks().some(t => t.enabled) : false;
    const micOn = localStreamRef.current ? localStreamRef.current.getAudioTracks().some(t => t.enabled) : true;

    await set(presenceRef, {
      userId,
      username,
      displayName: displayNameRef.current,
      avatar: avatarRef.current,
      isOwner,
      roomTag: initialRoomTag || roomTag,
      camOn,
      micOn,
      joinedAt: Date.now()
    });
    onDisconnect(presenceRef).remove();

    if (initialRoomTag) {
      setRoomTag(initialRoomTag);
    }

    sendToFirebase({
      type: 'room-info',
      roomId,
      roomTag: initialRoomTag || roomTag,
      autoAccept,
      autoReject,
      isOwner
    });
  };

  const queuePeerRequest = (targetId: string, targetUsername: string, targetDisplayName: string, targetAvatar: string | undefined, isInitiator: boolean) => {
    pendingPeerRequestsRef.current.set(targetId, { targetUsername, targetDisplayName, targetAvatar, isInitiator });
  };

  useEffect(() => {
    if (!roomId) {
      console.log('useEffect: no roomId, skipping Firebase setup');
      return;
    }

    console.log('useEffect: setting up Firebase listeners for roomId:', roomId);

    pendingJoinRef.current = null;
    pendingPeerRequestsRef.current.clear();

    const roomMessagesRef = ref(database, `rooms/${roomId}/messages`);
    const roomUsersRef = ref(database, `rooms/${roomId}/users`);
    const startTime = Date.now() - 1000;

    const processMessage = async (snapshot: any) => {
      const msg = snapshot.val();
      if (!msg || msg.senderId === userId || msg.timestamp < startTime) return;

      switch (msg.type) {
        case 'room-info':
          console.log('Received room-info:', msg);
          if (msg.roomTag) setRoomTag(msg.roomTag);
          if (msg.autoAccept !== undefined) setAutoAccept(msg.autoAccept);
          if (msg.autoReject !== undefined) setAutoReject(msg.autoReject);
          setHasRoomInfo(true);
          setIsWaitingInLobby(false);
          break;
        case 'you-are-owner':
          console.log('Received you-are-owner');
          setIsOwner(true);
          if (msg.ownerKey) setOwnerKey(msg.ownerKey);
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
          console.log('Received kicked');
          setIsKicked(true);
          break;
        case 'room-deleted':
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
        case 'user-joined':
          console.log('Received user-joined:', msg);
          setIsWaitingInLobby(false);
          setLobbyRequests(prev => prev.filter(r => r.userId !== msg.userId));
          if (!hasRoomInfoRef.current) {
            pendingPeerCreatesRef.current.push({
              targetId: msg.userId,
              targetUsername: msg.username,
              targetDisplayName: msg.displayName,
              targetAvatar: msg.avatar,
              isInitiator: true,
              camOn: msg.camOn,
              micOn: msg.micOn
            });
          } else {
            await createPeer(msg.userId, msg.username, msg.displayName, msg.avatar, true, msg.camOn, msg.micOn);
          }
          break;
        case 'room-users':
          console.log('Received room-users:', msg);
          setIsWaitingInLobby(false);
          const userIds = msg.users.map((u: any) => u.userId);
          setLobbyRequests(prev => prev.filter(r => !userIds.includes(r.userId)));
          for (const user of msg.users) {
            if (!hasRoomInfoRef.current) {
              pendingPeerCreatesRef.current.push({
                targetId: user.userId,
                targetUsername: user.username,
                targetDisplayName: user.displayName,
                targetAvatar: user.avatar,
                isInitiator: false,
                camOn: user.camOn,
                micOn: user.micOn
              });
            } else {
              await createPeer(user.userId, user.username, user.displayName, user.avatar, false, user.camOn, user.micOn);
            }
          }
          break;
        case 'signal':
          if (msg.targetId !== userId) return;
          await handleSignal(msg.senderId, msg.signal);
          break;
        case 'user-left':

          removePeer(msg.userId);
          break;
        case 'chat':
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
          break;
        case 'quality-request':
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

    const handleNewUser = async (snapshot: any) => {
      const userEntry = snapshot.val();
      const userKey = snapshot.key;
      if (!userEntry || !userKey || userKey === userId) return;
      if (peersRef.current.has(userKey)) return;

      const isInitiator = userId < userKey;
      await createPeer(
        userEntry.userId,
        userEntry.username,
        userEntry.displayName,
        userEntry.avatar,
        isInitiator,
        userEntry.camOn,
        userEntry.micOn
      );
    };

    const unsubscribeUserAdded = onChildAdded(roomUsersRef, handleNewUser);
    const unsubscribeUserRemoved = onChildRemoved(roomUsersRef, (snapshot) => {
      const userKey = snapshot.key;
      if (userKey && userKey !== userId) {
        removePeer(userKey);
      }
    });
    const unsubscribeMessageAdded = onChildAdded(roomMessagesRef, processMessage);

    return () => {
      off(roomUsersRef);
      off(roomMessagesRef);
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
      sendToFirebase({
        type: 'update-room-tag',
        roomId,
        roomTag: newTag
      });
    }
  };

  const approveUser = (targetId: string) => {
    if (roomId) {
      sendToFirebase({ type: 'lobby-approve', roomId, targetId });
      setLobbyRequests(prev => prev.filter(r => r.userId !== targetId));
    }
  };

  const approveAll = () => {
    if (roomId) {
      lobbyRequests.forEach(req => {
        sendToFirebase({ type: 'lobby-approve', roomId, targetId: req.userId });
      });
      setLobbyRequests([]);
    }
  };

  const rejectUser = (targetId: string) => {
    if (roomId) {
      sendToFirebase({ type: 'lobby-reject', roomId, targetId });
      setLobbyRequests(prev => prev.filter(r => r.userId !== targetId));
    }
  };

  const rejectAll = () => {
    if (roomId) {
      lobbyRequests.forEach(req => {
        sendToFirebase({ type: 'lobby-reject', roomId, targetId: req.userId });
      });
      setLobbyRequests([]);
    }
  };

  const kickUser = (targetId: string) => {
    if (roomId) {
      sendToFirebase({ type: 'kick-user', roomId, targetId });
    }
  };

  const deleteRoom = () => {
    if (roomId) {
      sendToFirebase({ type: 'delete-room', roomId });
    }
  };

  const forceMute = (targetId?: string, muteAll?: boolean) => {
    console.log('forceMute initiated:', { targetId, muteAll, roomId });
    if (roomId) {
      sendToFirebase({
        type: 'force-mute',
        roomId,
        targetId,
        muteAll
      });

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
      sendToFirebase({
        type: 'permit-speak',
        roomId,
        targetId
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
      sendToFirebase({
        type: 'direct-call',
        targetId,
        callerId: userId,
        callerDisplayName: displayName,
        callerAvatar: avatar,
        roomId: providedRoomId
      });
    }
  };

  const updateRoomSettings = (autoAccept: boolean, autoReject: boolean) => {
    if (roomId) {
      sendToFirebase({
        type: 'room-settings',
        roomId,
        autoAccept,
        autoReject
      });
    }
  };

  const updateProfile = (newDisplayName: string, newAvatar?: string) => {
    if (roomId) {
      sendToFirebase({
        type: 'profile-update',
        senderId: userId,
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
        sendToFirebase({
          type: 'quality-request',
          targetId: peer.userId,
          senderId: userId,
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
      sendToFirebase({
        type: 'mute-status',
        senderId: userId,
        isMuted
      });
    }
  };
  
  const sendCamStatus = (camOn: boolean) => {
    if (roomId) {
      sendToFirebase({
        type: 'cam-status',
        senderId: userId,
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
      sendToFirebase(chatMessage);
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
    let makingOffer = false;

    const peer: Peer = {
      userId: targetId,
      username: targetUsername,
      displayName: targetDisplayName,
      avatar: targetAvatar,
      connection: pc,
      isMuted: initialMicOn === false,
      camOn: initialCamOn ?? true,
      micOn: initialMicOn ?? true
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && roomId) {
        sendToFirebase({
          type: 'signal',
          targetId,
          senderId: userId,
          roomId,
          signal: { candidate: event.candidate }
        });
      }
    };

    pc.onnegotiationneeded = async () => {
      try {
        if (makingOffer) return; // Prevent simultaneous offers
        if (pc.signalingState !== 'stable') return;
        
        makingOffer = true;
        console.log(`Negotiation needed for ${targetId}`);
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') {
          makingOffer = false;
          return;
        }
        await pc.setLocalDescription(offer);
        if (roomId) {
          sendToFirebase({
            type: 'signal',
            targetId,
            senderId: userId,
            roomId,
            signal: { sdp: pc.localDescription }
          });
        }
      } catch (err) {
        console.error("Negotiation error:", err);
      } finally {
        makingOffer = false;
      }
    };

    pc.ontrack = (event) => {
      console.log(`Received remote track from ${targetId}`);
      setPeers(prev => {
        const newPeers = new Map<string, Peer>(prev);
        const existing = newPeers.get(targetId);
        if (existing) {
          // Create new peer object instead of mutating
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
        console.log(`ICE failed with ${targetId}, attempting restart...`);
        pc.restartIce();
      }
    };

    // Add local tracks if available
    const senders = pc.getSenders();
    if (stream) {
      stream.getTracks().forEach(track => {
        const alreadyAdded = senders.some(s => s.track?.id === track.id);
        if (!alreadyAdded) {
          pc.addTrack(track, stream);
        }
      });
    }

    if (isInitiator) {
      try {
        makingOffer = true;
        console.log(`Initiating call to ${targetId}`);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (roomId) {
          sendToFirebase({
            type: 'signal',
            targetId,
            senderId: userId,
            roomId,
            signal: { sdp: pc.localDescription }
          });
        }
      } catch (err) {
        console.error("Initial offer error:", err);
      } finally {
        makingOffer = false;
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
          if (roomId) {
            sendToFirebase({
              type: 'signal',
              targetId: senderId,
              senderId: userId,
              roomId,
              signal: { sdp: peer.connection.localDescription }
            });
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
    sendToFirebase({
      type: 'claim-ownership',
      roomId,
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
