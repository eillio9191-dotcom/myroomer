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

export type QualityPreset = '1080p' | '720p' | '480p' | '360p' | '240p';

interface QualitySettings {
  width: number;
  height: number;
  frameRate: number;
  videoBitrate: number;
  screenFrameRate: number;
  screenBitrate: number;
}

const QUALITY_CONFIGS: Record<QualityPreset, QualitySettings> = {
  '1080p': { width: 1920, height: 1080, frameRate: 30, videoBitrate: 4000000, screenFrameRate: 30, screenBitrate: 6000000 },
  '720p': { width: 1280, height: 720, frameRate: 30, videoBitrate: 2000000, screenFrameRate: 15, screenBitrate: 3000000 },
  '480p': { width: 854, height: 480, frameRate: 24, videoBitrate: 1000000, screenFrameRate: 10, screenBitrate: 1500000 },
  '360p': { width: 640, height: 360, frameRate: 20, videoBitrate: 500000, screenFrameRate: 5, screenBitrate: 800000 },
  '240p': { width: 426, height: 240, frameRate: 15, videoBitrate: 200000, screenFrameRate: 5, screenBitrate: 400000 },
};

const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export function useWebRTC(roomId: string, userId: string, username: string, displayName?: string, avatar?: string) {

  const [peers, setPeers] = useState<Map<string, Peer>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMutedAll, setIsMutedAll] = useState(false);
  const [quality, setQuality] = useState<QualityPreset>('720p');

  const socketRef = useRef<WebSocket | null>(null);
  const peersRef = useRef<Map<string, Peer>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const retryTimeouts = useRef<Map<string, any>>(new Map());

  const applyBitrate = useCallback((pc: RTCPeerConnection, bitrate: number) => {
    pc.getSenders().forEach(sender => {
      if (sender.track?.kind === 'video') {
        const parameters = sender.getParameters();
        if (!parameters.encodings) parameters.encodings = [{}];
        parameters.encodings[0].maxBitrate = bitrate;
        sender.setParameters(parameters).catch(console.error);
      }
    });
  }, []);

  const changeQuality = useCallback(async (newQuality: QualityPreset) => {

    setQuality(newQuality);
    const config = QUALITY_CONFIGS[newQuality];

    if (localStreamRef.current) {

      const videoTrack = localStreamRef.current.getVideoTracks()[0];

      if (videoTrack && !isScreenSharing) {

        await videoTrack.applyConstraints({
          width: { ideal: config.width },
          height: { ideal: config.height },
          frameRate: { ideal: config.frameRate }
        });

      }

      const bitrate = isScreenSharing ? config.screenBitrate : config.videoBitrate;

      peersRef.current.forEach(peer => {
        applyBitrate(peer.connection, bitrate);
      });

    }

  }, [isScreenSharing, applyBitrate]);

  useEffect(() => {

    const initMedia = async () => {

      try {

        const config = QUALITY_CONFIGS[quality];

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: {
            width: { ideal: config.width },
            height: { ideal: config.height },
            frameRate: { ideal: config.frameRate }
          }
        });

        setLocalStream(stream);
        localStreamRef.current = stream;

      } catch (err) {

        console.error("Media error", err);

      }

    };

    initMedia();

  }, []);

  useEffect(() => {

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

    socketRef.current = socket;

    socket.onopen = () => {

      socket.send(JSON.stringify({
        type: 'join',
        roomId,
        userId,
        username,
        displayName,
        avatar
      }));

    };

    socket.onmessage = async (event) => {

      const msg = JSON.parse(event.data);

      switch (msg.type) {

        case 'user-joined':
          await createPeer(msg.userId, msg.username, msg.displayName, msg.avatar, true);
          break;

        case 'room-users':
          for (const u of msg.users) {
            if (u.userId !== userId)
              await createPeer(u.userId, u.username, u.displayName, u.avatar, false);
          }
          break;

        case 'signal':
          await handleSignal(msg.senderId, msg.signal);
          break;

        case 'user-left':
          removePeer(msg.userId);
          break;

        case 'chat':
          setMessages(prev => [...prev, msg]);
          break;

      }

    };

    return () => {

      socket.close();

      peersRef.current.forEach(p => p.connection.close());

    };

  }, [roomId, userId]);

  const createPeer = async (
    targetId: string,
    targetUsername: string,
    targetDisplayName?: string,
    targetAvatar?: string,
    isInitiator = false
  ) => {

    if (!localStreamRef.current) return;

    const pc = new RTCPeerConnection(iceServers);

    const peer: Peer = {
      userId: targetId,
      username: targetUsername,
      displayName: targetDisplayName,
      avatar: targetAvatar,
      connection: pc
    };

    pc.onicecandidate = (e) => {

      if (e.candidate) {

        socketRef.current?.send(JSON.stringify({
          type: 'signal',
          targetId,
          senderId: userId,
          signal: { candidate: e.candidate }
        }));

      }

    };

    pc.ontrack = (event) => {

      setPeers(prev => {

        const map = new Map(prev);
        map.set(targetId, { ...peer, stream: event.streams[0] });
        peersRef.current = map;
        return map;

      });

    };

    localStreamRef.current.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current!);
    });

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

    }

    if (signal.candidate) {

      await peer.connection.addIceCandidate(new RTCIceCandidate(signal.candidate));

    }

  };

  const removePeer = (id: string) => {

    const peer = peersRef.current.get(id);

    if (peer) {

      peer.connection.close();

      peersRef.current.delete(id);

      setPeers(new Map(peersRef.current));

    }

  };

  const toggleMedia = (type: 'audio' | 'video') => {

    const track =
      type === 'audio'
        ? localStreamRef.current?.getAudioTracks()[0]
        : localStreamRef.current?.getVideoTracks()[0];

    if (track) track.enabled = !track.enabled;

  };

  const startScreenShare = async () => {

    if (!localStreamRef.current) return;

    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true
    });

    setIsScreenSharing(true);

    const videoTrack = screenStream.getVideoTracks()[0];

    peersRef.current.forEach(peer => {

      const sender = peer.connection.getSenders().find(s => s.track?.kind === 'video');

      if (sender) sender.replaceTrack(videoTrack);

    });

    videoTrack.onended = stopScreenShare;

  };

  const stopScreenShare = () => {

    const videoTrack = localStreamRef.current?.getVideoTracks()[0];

    peersRef.current.forEach(peer => {

      const sender = peer.connection.getSenders().find(s => s.track?.kind === 'video');

      if (sender && videoTrack) sender.replaceTrack(videoTrack);

    });

    setIsScreenSharing(false);

  };

  const sendChatMessage = (text: string) => {

    socketRef.current?.send(JSON.stringify({
      type: 'chat',
      text,
      senderId: userId,
      username,
      displayName,
      avatar,
      timestamp: Date.now()
    }));

  };

  const toggleMuteAll = () => {

    const state = !isMutedAll;
    setIsMutedAll(state);

    peersRef.current.forEach(p => {
      p.stream?.getAudioTracks().forEach(t => t.enabled = !state);
    });

  };

  return {
    peers,
    localStream,
    messages,
    toggleMedia,
    startScreenShare,
    stopScreenShare,
    isScreenSharing,
    sendChatMessage,
    isMutedAll,
    toggleMuteAll,
    quality,
    changeQuality
  };

}