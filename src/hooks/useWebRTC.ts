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

export function useWebRTC(roomId: string, userId: string, username: string, displayName: string, avatar?: string) {
  const [peers, setPeers] = useState<Map<string, Peer>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isMutedAll, setIsMutedAll] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const peersRef = useRef<Map<string, Peer>>(new Map());

  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ],
  };

  // 🔹 Capture local media immediately
  useEffect(() => {
    const initLocalStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        setLocalStream(stream);
      } catch (err) {
        console.error("Error accessing local media:", err);
      }
    };
    initLocalStream();
  }, []);

  // 🔹 Add local tracks to all existing peers whenever localStream changes
  useEffect(() => {
    if (localStream) {
      peersRef.current.forEach(peer => {
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

    return () => {
      socket.close();
      peersRef.current.forEach(peer => peer.connection.close());
    };
  }, [roomId, userId]);

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
        peer.stream.getAudioTracks().forEach(track => track.enabled = !newState);
      }
    });
  };

  const createPeer = async (targetId: string, targetUsername: string, targetDisplayName: string, targetAvatar: string | undefined, isInitiator: boolean) => {

    const pc = new RTCPeerConnection(iceServers);

    pc.onconnectionstatechange = () => console.log("Connection state:", pc.connectionState);
    pc.oniceconnectionstatechange = () => console.log("ICE state:", pc.iceConnectionState);

    const peer: Peer = { userId: targetId, username: targetUsername, displayName: targetDisplayName, avatar: targetAvatar, connection: pc, isMuted: false };

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

    // 🔹 Receive remote tracks
    pc.ontrack = (event) => {
      setPeers(prev => {
        const newPeers = new Map(prev);
        const existing = newPeers.get(targetId);
        if (existing) {
          existing.stream = event.streams[0];
        } else {
          newPeers.set(targetId, { userId: targetId, username: targetUsername, displayName: targetDisplayName, avatar: targetAvatar, connection: pc, stream: event.streams[0], isMuted: false });
        }
        return newPeers;
      });
    };

    // 🔹 Add local tracks if ready
    if (localStream) {
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }

    // 🔹 Initiator creates offer
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
      peersRef.current.forEach(peer => stream.getTracks().forEach(track => peer.connection.addTrack(track, stream)));
      return;
    }

    const track = type === 'audio' ? localStream.getAudioTracks()[0] : localStream.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      if (type === 'audio') sendMuteStatus(!track.enabled);
    }
  };

  const startScreenShare = async () => {
    if (!localStream) return null;
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }).catch(() => navigator.mediaDevices.getDisplayMedia({ video: true }));
      setIsScreenSharing(true);

      const videoTrack = screenStream.getVideoTracks()[0];
      const audioTrack = screenStream.getAudioTracks()[0];

      peersRef.current.forEach(peer => {
        const senders = peer.connection.getSenders();
        const videoSender = senders.find(s => s.track?.kind === 'video');
        if (videoSender) videoSender.replaceTrack(videoTrack);

        if (audioTrack) {
          const audioSender = senders.find(s => s.track?.kind === 'audio');
          if (audioSender) audioSender.replaceTrack(audioTrack);
        }
      });

      videoTrack.onended = () => stopScreenShare();

      return screenStream;
    } catch (err: any) {
      console.error("Screen share error:", err);
      setIsScreenSharing(false);
      return null;
    }
  };

  const stopScreenShare = async () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];

    peersRef.current.forEach(peer => {
      const videoSender = peer.connection.getSenders().find(s => s.track?.kind === 'video');
      if (videoSender) videoSender.replaceTrack(videoTrack);
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
    updateProfile
  };
}