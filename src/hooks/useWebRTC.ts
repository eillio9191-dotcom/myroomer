import { useEffect, useRef, useState } from "react";

type Peer = {
  id: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
};

type UseWebRTCOptions = {
  signalingUrl: string;
  roomId: string;
  userId: string;
  username: string;
};

const iceConfig: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }, // STUN
    // { urls: "turn:your-turn-server:3478", username: "user", credential: "pass" }, // TURN
  ],
};

type QualityLevel = "low" | "medium" | "high";

const QUALITY_PRESETS: Record<QualityLevel, { bitrate: number; scale?: number }> = {
  low: { bitrate: 150_000, scale: 2 },     // أقل استهلاك
  medium: { bitrate: 400_000, scale: 1.5 },
  high: { bitrate: 900_000, scale: 1 },
};

export function useWebRTC({
  signalingUrl,
  roomId,
  userId,
  username,
}: UseWebRTCOptions) {
  const [peers, setPeers] = useState<Map<string, Peer>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [quality, setQuality] = useState<QualityLevel>("medium");

  const socketRef = useRef<WebSocket | null>(null);
  const peersRef = useRef<Map<string, Peer>>(new Map());
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);

  // فتح WebSocket + Auto Reconnect
  useEffect(() => {
    let isClosedManually = false;

    const connect = () => {
      const ws = new WebSocket(signalingUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
        ws.send(
          JSON.stringify({
            type: "join-room",
            roomId,
            userId,
            username,
          })
        );
      };

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case "user-joined":
            await createPeer(msg.userId, true);
            break;

          case "signal":
            await handleSignal(msg.senderId, msg.signal);
            break;

          case "user-left":
            removePeer(msg.userId);
            break;
        }
      };

      ws.onclose = () => {
        if (isClosedManually) return;
        // Auto reconnect
        if (reconnectAttemptsRef.current < 5) {
          const delay = 2000 * (reconnectAttemptsRef.current + 1);
          reconnectAttemptsRef.current += 1;
          reconnectTimerRef.current = setTimeout(connect, delay);
        } else {
          peersRef.current.forEach((p) => p.connection.close());
          peersRef.current.clear();
          setPeers(new Map());
        }
      };
    };

    connect();

    return () => {
      isClosedManually = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      socketRef.current?.close();
      peersRef.current.forEach((p) => p.connection.close());
      peersRef.current.clear();
      setPeers(new Map());
    };
  }, [signalingUrl, roomId, userId, username]);

  // الحصول على الكاميرا/المايك مرة واحدة
  useEffect(() => {
    let cancelled = false;

    const getMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
        if (cancelled) return;
        setLocalStream(stream);
        cameraTrackRef.current = stream.getVideoTracks()[0] || null;
      } catch (err) {
        console.error("Error getUserMedia:", err);
      }
    };

    getMedia();

    return () => {
      cancelled = true;
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // عند توفر localStream → اربط كل الـ Tracks لكل Peer
  useEffect(() => {
    if (!localStream) return;

    peersRef.current.forEach((peer) => {
      const senders = peer.connection.getSenders();
      const existingKinds = new Set(
        senders.map((s) => s.track?.kind).filter(Boolean) as string[]
      );

      localStream.getTracks().forEach((track) => {
        if (!existingKinds.has(track.kind)) {
          peer.connection.addTrack(track, localStream);
        }
      });

      applyOutgoingQualityToPeer(peer, quality);
    });
  }, [localStream, quality]);

  const createPeer = async (targetId: string, isInitiator: boolean) => {
    // ضمان وجود Stream قبل الاتصال
    if (!localStream) return;

    const pc = new RTCPeerConnection(iceConfig);

    const peer: Peer = {
      id: targetId,
      connection: pc,
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.send(
          JSON.stringify({
            type: "signal",
            targetId,
            senderId: userId,
            signal: { candidate: event.candidate },
          })
        );
      }
    };

    pc.ontrack = (event) => {
      setPeers((prev) => {
        const map = new Map(prev);
        const existing = map.get(targetId);
        if (existing) {
          existing.stream = event.streams[0];
          map.set(targetId, { ...existing });
        } else {
          map.set(targetId, { id: targetId, connection: pc, stream: event.streams[0] });
        }
        return map;
      });
    };

    // ربط كل الـ Tracks مباشرة بعد الإنشاء
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    // تطبيق الجودة الحالية على هذا الـ Peer
    applyOutgoingQualityToPeer(peer, quality);

    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current?.send(
        JSON.stringify({
          type: "signal",
          targetId,
          senderId: userId,
          signal: { sdp: offer },
        })
      );
    }

    peersRef.current.set(targetId, peer);
    setPeers(new Map(peersRef.current));
  };

  const handleSignal = async (senderId: string, signal: any) => {
    let peer = peersRef.current.get(senderId);

    if (!peer) {
      await createPeer(senderId, false);
      peer = peersRef.current.get(senderId);
      if (!peer) return;
    }

    const pc = peer.connection;

    if (signal.sdp) {
      await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      if (signal.sdp.type === "offer") {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketRef.current?.send(
          JSON.stringify({
            type: "signal",
            targetId: senderId,
            senderId: userId,
            signal: { sdp: answer },
          })
        );
      }
    } else if (signal.candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
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

  const toggleMedia = (type: "audio" | "video") => {
    if (!localStream) return;
    const track =
      type === "audio"
        ? localStream.getAudioTracks()[0]
        : localStream.getVideoTracks()[0];

    if (track) {
      track.enabled = !track.enabled;
    }
  };

  // مشاركة الشاشة: لا نلمس localStream، فقط نبدّل sender.track
  const startScreenShare = async () => {
    if (isScreenSharing) return;
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) return;

      setIsScreenSharing(true);

      peersRef.current.forEach((peer) => {
        const sender = peer.connection
          .getSenders()
          .find((s) => s.track && s.track.kind === "video");
        if (sender) {
          sender.replaceTrack(screenTrack);
          // نطبق نفس الجودة على مشاركة الشاشة
          applyOutgoingQualityToSender(sender, quality);
        }
      });

      screenTrack.onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.error("Error screen share:", err);
      setIsScreenSharing(false);
    }
  };

  const stopScreenShare = () => {
    if (!isScreenSharing) return;
    const cameraTrack = cameraTrackRef.current;
    if (!cameraTrack) {
      setIsScreenSharing(false);
      return;
    }

    peersRef.current.forEach((peer) => {
      const sender = peer.connection
        .getSenders()
        .find((s) => s.track && s.track.kind === "video");
      if (sender) {
        sender.replaceTrack(cameraTrack);
        applyOutgoingQualityToSender(sender, quality);
      }
    });

    setIsScreenSharing(false);
  };

  // تغيير الجودة (Adaptive Bitrate)
  const changeQuality = (level: QualityLevel) => {
    setQuality(level);
    peersRef.current.forEach((peer) => {
      applyOutgoingQualityToPeer(peer, level);
    });
  };

  const applyOutgoingQualityToPeer = (peer: Peer, level: QualityLevel) => {
    const senders = peer.connection.getSenders();
    senders.forEach((sender) => {
      if (sender.track && sender.track.kind === "video") {
        applyOutgoingQualityToSender(sender, level);
      }
    });
  };

  const applyOutgoingQualityToSender = (sender: RTCRtpSender, level: QualityLevel) => {
    const preset = QUALITY_PRESETS[level];
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}];
    }
    params.encodings[0].maxBitrate = preset.bitrate;
    if (preset.scale) {
      params.encodings[0].scaleResolutionDownBy = preset.scale;
    }
    sender.setParameters(params).catch((err) =>
      console.warn("setParameters error:", err)
    );
  };

  return {
    peers,
    localStream,
    toggleMedia,
    startScreenShare,
    stopScreenShare,
    isScreenSharing,
    quality,
    changeQuality,
  };
}
