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
    { urls: "stun:stun.l.google.com:19302" },
    // { urls: "turn:YOUR_TURN_SERVER", username: "user", credential: "pass" }
  ],
};

type QualityLevel = "low" | "medium" | "high";

const QUALITY_PRESETS: Record<QualityLevel, { bitrate: number; scale: number }> = {
  low: { bitrate: 150_000, scale: 2 },
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
  const pendingPeersRef = useRef<string[]>([]);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);

  // ============================
  // 1) WebSocket + Auto Reconnect
  // ============================
  useEffect(() => {
    let closedManually = false;

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

        // معالجة الـ pending peers بعد reconnect
        if (localStream) {
          pendingPeersRef.current.forEach((id) => createPeer(id, true));
          pendingPeersRef.current = [];
        }
      };

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case "user-joined":
            if (!localStream) {
              pendingPeersRef.current.push(msg.userId);
            } else {
              await createPeer(msg.userId, true);
            }
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
        if (closedManually) return;

        if (reconnectAttemptsRef.current < 5) {
          const delay = 2000 * (reconnectAttemptsRef.current + 1);
          reconnectAttemptsRef.current++;
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
      closedManually = true;
      socketRef.current?.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [signalingUrl, roomId, userId, username]);

  // ============================
  // 2) الحصول على الكاميرا/المايك
  // ============================
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
        cameraTrackRef.current = stream.getVideoTracks()[0];

        // معالجة pending peers
        pendingPeersRef.current.forEach((id) => createPeer(id, true));
        pendingPeersRef.current = [];
      } catch (err) {
        console.error("getUserMedia error:", err);
      }
    };

    getMedia();

    return () => {
      cancelled = true;
      localStream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ============================
  // 3) createPeer
  // ============================
  const createPeer = async (targetId: string, isInitiator: boolean) => {
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
        map.set(targetId, { id: targetId, connection: pc, stream: event.streams[0] });
        return map;
      });
    };

    // renegotiation
    pc.onnegotiationneeded = async () => {
      try {
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
      } catch {}
    };

    // إضافة كل الـ tracks
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    // تطبيق الجودة
    applyQualityToPeer(pc, quality);

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

  // ============================
  // 4) handleSignal
  // ============================
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

  // ============================
  // 5) إزالة Peer
  // ============================
  const removePeer = (id: string) => {
    const peer = peersRef.current.get(id);
    if (peer) {
      peer.connection.close();
      peersRef.current.delete(id);
      setPeers(new Map(peersRef.current));
    }
  };

  // ============================
  // 6) مشاركة الشاشة
  // ============================
  const startScreenShare = async () => {
    if (isScreenSharing) return;

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });

      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) return;

      setIsScreenSharing(true);

      peersRef.current.forEach((peer) => {
        const sender = peer.connection
          .getSenders()
          .find((s) => s.track?.kind === "video");

        if (sender) {
          sender.replaceTrack(screenTrack);
          applyQualityToSender(sender, quality);
        }
      });

      screenTrack.onended = () => stopScreenShare();
    } catch (err) {
      console.error("ScreenShare error:", err);
      setIsScreenSharing(false);
    }
  };

  const stopScreenShare = () => {
    if (!isScreenSharing) return;

    const cameraTrack = cameraTrackRef.current;
    if (!cameraTrack) return;

    peersRef.current.forEach((peer) => {
      const sender = peer.connection
        .getSenders()
        .find((s) => s.track?.kind === "video");

      if (sender) {
        sender.replaceTrack(cameraTrack);
        applyQualityToSender(sender, quality);
      }
    });

    setIsScreenSharing(false);
  };

  // ============================
  // 7) تغيير الجودة
  // ============================
  const changeQuality = (level: QualityLevel) => {
    setQuality(level);

    peersRef.current.forEach((peer) => {
      applyQualityToPeer(peer.connection, level);
    });
  };

  const applyQualityToPeer = (pc: RTCPeerConnection, level: QualityLevel) => {
    pc.getSenders().forEach((sender) => {
      if (sender.track?.kind === "video") {
        applyQualityToSender(sender, level);
      }
    });
  };

  const applyQualityToSender = (sender: RTCRtpSender, level: QualityLevel) => {
    const preset = QUALITY_PRESETS[level];
    const params = sender.getParameters();

    if (!params.encodings) params.encodings = [{}];

    params.encodings[0].maxBitrate = preset.bitrate;
    params.encodings[0].scaleResolutionDownBy = preset.scale;

    sender.setParameters(params).catch(() => {});
  };

  return {
    peers,
    localStream,
    isScreenSharing,
    startScreenShare,
    stopScreenShare,
    changeQuality,
    quality,
  };
}
