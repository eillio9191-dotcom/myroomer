import { useEffect, useRef, useState } from 'react';

export interface Peer {
  userId: string;
  username: string;
  stream?: MediaStream;
  connection: RTCPeerConnection;
}

export function useWebRTC(roomId: string, userId: string, username: string) {
  const [peers, setPeers] = useState<Map<string, Peer>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const peersRef = useRef<Map<string, Peer>>(new Map());

  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  // Initialize local media
  useEffect(() => {
    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        setLocalStream(stream);
      } catch (err) {
        console.error("Error accessing media devices:", err);
      }
    };
    initMedia();
  }, []);

  // Connect to signaling server
  useEffect(() => {
    if (!localStream) return; // wait for localStream
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'join', roomId, userId, username }));
    };

    socket.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      switch (message.type) {
        case 'user-joined':
          await createPeer(message.userId, message.username, true);
          break;
        case 'room-users':
          for (const user of message.users) {
            await createPeer(user.userId, user.username, false);
          }
          break;
        case 'signal':
          await handleSignal(message.senderId, message.signal);
          break;
        case 'user-left':
          removePeer(message.userId);
          break;
      }
    };

    return () => {
      socket.close();
      peersRef.current.forEach(peer => peer.connection.close());
    };
  }, [localStream]); // wait until localStream ready

  const createPeer = async (targetId: string, targetUsername: string, isInitiator: boolean) => {
    if (!localStream) return;

    const pc = new RTCPeerConnection(iceServers);

    const peer: Peer = { userId: targetId, username: targetUsername, connection: pc };

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
        const newPeers = new Map(prev);
        const existing = newPeers.get(targetId);
        if (existing) existing.stream = event.streams[0];
        else newPeers.set(targetId, { ...peer, stream: event.streams[0] });
        return newPeers;
      });
    };

    // Add all local tracks
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

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

  const toggleMedia = (type: 'audio' | 'video') => {
    if (!localStream) return;
    const track = type === 'audio' ? localStream.getAudioTracks()[0] : localStream.getVideoTracks()[0];
    if (track) track.enabled = !track.enabled;
  };

  const startScreenShare = async () => {
    if (!localStream) return;
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
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    peersRef.current.forEach(peer => {
      const sender = peer.connection.getSenders().find(s => s.track?.kind === 'video');
      if (sender) sender.replaceTrack(videoTrack);
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
    isScreenSharing
  };
}