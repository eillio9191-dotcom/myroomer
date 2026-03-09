import { useEffect, useRef, useState } from "react";

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

export type QualityLevel = "1080" | "720" | "480" | "360" | "240";

export interface QualityPreset {
  width: number;
  height: number;
  frameRate: number;
  bitrate: number;
}

export const QUALITY_PRESETS: Record<QualityLevel, QualityPreset> = {
  "1080": { width: 1920, height: 1080, frameRate: 30, bitrate: 4_000_000 },
  "720": { width: 1280, height: 720, frameRate: 30, bitrate: 2_000_000 },
  "480": { width: 854, height: 480, frameRate: 30, bitrate: 1_000_000 },
  "360": { width: 640, height: 360, frameRate: 30, bitrate: 600_000 },
  "240": { width: 426, height: 240, frameRate: 15, bitrate: 300_000 },
};

export function useWebRTC(
  roomId: string,
  userId: string,
  username: string,
  displayName: string,
  avatar?: string
) {
  const [peers, setPeers] = useState<Map<string, Peer>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isMutedAll, setIsMutedAll] = useState(false);
  const [quality, setQuality] = useState<QualityLevel>("720");
  const [broadcastQuality, setBroadcastQuality] = useState(false);

  const [lobbyRequests, setLobbyRequests] = useState<Peer[]>([]);
  const [isWaitingInLobby, setIsWaitingInLobby] = useState(false);
  const [isKicked, setIsKicked] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [roomTag, setRoomTag] = useState("");
  const [incomingCall, setIncomingCall] = useState<{
    callerId: string;
    callerDisplayName: string;
    callerAvatar?: string;
    roomId: string;
  } | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const peersRef = useRef<Map<string, Peer>>(new Map());
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const pendingPeersRef = useRef<
    { userId: string; username: string; displayName: string; avatar?: string; isInitiator: boolean }[]
  >([]);

  const iceServers: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
      { urls: "stun:stun.services.mozilla.com" },
      { urls: "stun:bn-turn2.xirsys.com" },
      ...((import.meta as any).env.VITE_TURN_URL
        ? [
            {
              urls: (import.meta as any).env.VITE_TURN_URL,
              username: (import.meta as any).env.VITE_TURN_USERNAME,
              credential: (import.meta as any).env.VITE_TURN_PASSWORD,
            },
          ]
        : []),
    ],
  };

  // ربط الـ tracks الجديدة بكل الـ peers عند توفر localStream
  useEffect(() => {
    if (!localStream) return;
    cameraTrackRef.current = localStream.getVideoTracks()[0] || null;

    peersRef.current.forEach((peer) => {
      const senders = peer.connection.getSenders();
      localStream.getTracks().forEach((track) => {
        const alreadyAdded = senders.some((s) => s.track?.id === track.id);
        if (!alreadyAdded) {
          peer.connection.addTrack(track, localStream);
        }
      });
    });

    // معالجة الـ pending peers
    if (pendingPeersRef.current.length > 0) {
      pendingPeersRef.current.forEach((p) =>
        createPeer(p.userId, p.username, p.displayName, p.avatar, p.isInitiator)
      );
      pendingPeersRef.current = [];
    }
  }, [localStream]);

  // WebSocket + إشارات الغرفة
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    socketRef.current = socket;

    socket.onopen = () => {
      // الانضمام يتم من joinRoom من الواجهة
    };

    socket.onmessage = async (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case "room-info":
          if (message.roomTag) setRoomTag(message.roomTag);
          break;

        case "you-are-owner":
          setIsOwner(true);
          break;

        case "waiting-in-lobby":
          setIsWaitingInLobby(true);
          break;

        case "lobby-request":
          setLobbyRequests((prev) => {
            if (prev.find((r) => r.userId === message.userId)) return prev;
            return [
              ...prev,
              {
                userId: message.userId,
                username: message.username,
                displayName: message.displayName,
                avatar: message.avatar,
                connection: null as any,
              },
            ];
          });
          break;

        case "lobby-rejected":
          setIsWaitingInLobby(false);
          alert("Your request to join was rejected.");
          break;

        case "kicked":
          setIsKicked(true);
          break;

        case "room-deleted":
          alert("The room has been deleted by the owner.");
          window.location.href = "/";
          break;

        case "incoming-call":
          setIncomingCall({
            callerId: message.callerId,
            callerDisplayName: message.callerDisplayName,
            callerAvatar: message.callerAvatar,
            roomId: message.roomId,
          });
          break;

        case "user-joined":
          setIsWaitingInLobby(false);
          setLobbyRequests((prev) => prev.filter((r) => r.userId !== message.userId));
          await safeCreatePeer(
            message.userId,
            message.username,
            message.displayName,
            message.avatar,
            true
          );
          break;

        case "room-users":
          setIsWaitingInLobby(false);
          const userIds = message.users.map((u: any) => u.userId);
          setLobbyRequests((prev) => prev.filter((r) => !userIds.includes(r.userId)));
          for (const user of message.users) {
            await safeCreatePeer(
              user.userId,
              user.username,
              user.displayName,
              user.avatar,
              false
            );
          }
          break;

        case "signal":
          await handleSignal(message.senderId, message.signal);
          break;

        case "user-left":
          removePeer(message.userId);
          break;

        case "chat":
          setMessages((prev) => [
            ...prev,
            {
              text: message.text,
              senderId: message.senderId,
              username: message.username,
              displayName: message.displayName,
              avatar: message.avatar,
              timestamp: message.timestamp,
            },
          ]);
          break;

        case "quality-request": {
          const peerToUpdate = peersRef.current.get(message.senderId);
          if (peerToUpdate) {
            const preset = QUALITY_PRESETS[message.level as QualityLevel];
            const sender = peerToUpdate.connection
              .getSenders()
              .find((s) => s.track?.kind === "video");
            if (sender) {
              const params = sender.getParameters();
              if (!params.encodings) params.encodings = [{}];
              params.encodings[0].maxBitrate = preset.bitrate;
              sender.setParameters(params).catch(console.error);
            }
          }
          break;
        }

        case "mute-status":
          setPeers((prev) => {
            const newPeers = new Map<string, Peer>(prev);
            const existing = newPeers.get(message.senderId);
            if (existing) {
              existing.isMuted = message.isMuted;
              newPeers.set(message.senderId, { ...existing });
            }
            return newPeers;
          });
          break;

        case "profile-update":
          setPeers((prev) => {
            const newPeers = new Map<string, Peer>(prev);
            const existing = newPeers.get(message.senderId);
            if (existing) {
              existing.displayName = message.displayName;
              existing.avatar = message.avatar;
              newPeers.set(message.senderId, { ...existing });
            }
            return newPeers;
          });
          break;
      }
    };

    return () => {
      socket.close();
      peersRef.current.forEach((peer) => peer.connection.close());
    };
  }, [roomId, userId]);

  const joinRoom = (owner: boolean, initialRoomTag?: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "join",
          roomId,
          userId,
          username,
          displayName,
          avatar,
          isOwner: owner,
          roomTag: initialRoomTag,
        })
      );
    }
  };

  const updateRoomTag = (newTag: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "update-room-tag",
          roomId,
          roomTag: newTag,
        })
      );
    }
  };

  const approveUser = (targetId: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({ type: "lobby-approve", roomId, targetId })
      );
      setLobbyRequests((prev) => prev.filter((r) => r.userId !== targetId));
    }
  };

  const rejectUser = (targetId: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({ type: "lobby-reject", roomId, targetId })
      );
      setLobbyRequests((prev) => prev.filter((r) => r.userId !== targetId));
    }
  };

  const kickUser = (targetId: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({ type: "kick-user", roomId, targetId })
      );
    }
  };

  const deleteRoom = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "delete-room", roomId }));
    }
  };

  const directCall = (targetUsername: string, providedRoomId?: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "direct-call",
          targetUsername,
          callerId: userId,
          callerDisplayName: displayName,
          callerAvatar: avatar,
          roomId: providedRoomId,
        })
      );
    }
  };

  const updateRoomSettings = (autoAccept: boolean, autoReject: boolean) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "room-settings",
          roomId,
          autoAccept,
          autoReject,
        })
      );
    }
  };

  const updateProfile = (newDisplayName: string, newAvatar?: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "profile-update",
          senderId: userId,
          displayName: newDisplayName,
          avatar: newAvatar,
        })
      );
    }
  };

  const changeQuality = async (level: QualityLevel) => {
    setQuality(level);
    const preset = QUALITY_PRESETS[level];

    // طلب من الآخرين تعديل جودة البث الذي يرسلونه لنا
    peersRef.current.forEach((peer) => {
      socketRef.current?.send(
        JSON.stringify({
          type: "quality-request",
          targetId: peer.userId,
          senderId: userId,
          level,
        })
      );
    });

    // تغيير جودة البث الذي نرسله نحن (اختياري)
    if (broadcastQuality && localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        try {
          await videoTrack.applyConstraints({
            width: preset.width,
            height: preset.height,
            frameRate: preset.frameRate,
          });
        } catch {
          const newStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: preset.width,
              height: preset.height,
              frameRate: preset.frameRate,
            },
            audio: true,
          });
          const newVideoTrack = newStream.getVideoTracks()[0];
          const oldVideoTrack = localStream.getVideoTracks()[0];
          localStream.removeTrack(oldVideoTrack);
          localStream.addTrack(newVideoTrack);
          cameraTrackRef.current = newVideoTrack;

          peersRef.current.forEach((peer) => {
            const sender = peer.connection
              .getSenders()
              .find((s) => s.track?.kind === "video");
            if (sender) sender.replaceTrack(newVideoTrack);
          });
        }
      }

      peersRef.current.forEach((peer) => {
        const senders = peer.connection.getSenders();
        senders.forEach((sender) => {
          if (sender.track?.kind === "video") {
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
      socketRef.current.send(
        JSON.stringify({
          type: "mute-status",
          senderId: userId,
          isMuted,
        })
      );
    }
  };

  const sendChatMessage = (text: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "chat",
          text,
          senderId: userId,
          username,
          displayName,
          avatar,
          timestamp: Date.now(),
        })
      );
    }
  };

  const toggleMuteAll = () => {
    const newState = !isMutedAll;
    setIsMutedAll(newState);
    peersRef.current.forEach((peer) => {
      if (peer.stream) {
        peer.stream.getAudioTracks().forEach((track) => {
          track.enabled = !newState;
        });
      }
    });
  };

  const safeCreatePeer = async (
    targetId: string,
    targetUsername: string,
    targetDisplayName: string,
    targetAvatar: string | undefined,
    isInitiator: boolean
  ) => {
    if (!localStream) {
      pendingPeersRef.current.push({
        userId: targetId,
        username: targetUsername,
        displayName: targetDisplayName,
        avatar: targetAvatar,
        isInitiator,
      });
      return;
    }
    await createPeer(
      targetId,
      targetUsername,
      targetDisplayName,
      targetAvatar,
      isInitiator
    );
  };

  const createPeer = async (
    targetId: string,
    targetUsername: string,
    targetDisplayName: string,
    targetAvatar: string | undefined,
    isInitiator: boolean
  ) => {
    if (!localStream) return;

    console.log(`Creating peer for ${targetId}, initiator: ${isInitiator}`);
    const pc = new RTCPeerConnection(iceServers);

    const peer: Peer = {
      userId: targetId,
      username: targetUsername,
      displayName: targetDisplayName,
      avatar: targetAvatar,
      connection: pc,
      isMuted: false,
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

    pc.oniceconnectionstatechange = () => {
      console.log(
        `ICE connection state with ${targetId}: ${pc.iceConnectionState}`
      );
    };

    pc.onnegotiationneeded = async () => {
      if (!isInitiator) return;
      try {
        if (pc.signalingState !== "stable") return;
        console.log(`Negotiation needed for ${targetId}`);
        const offer = await pc.createOffer();
        if (pc.signalingState !== "stable") return;
        await pc.setLocalDescription(offer);
        socketRef.current?.send(
          JSON.stringify({
            type: "signal",
            targetId,
            senderId: userId,
            signal: { sdp: pc.localDescription },
          })
        );
      } catch (err) {
        console.error("Negotiation error:", err);
      }
    };

    pc.ontrack = (event) => {
      console.log(`Received remote track from ${targetId}`);
      setPeers((prev) => {
        const newPeers = new Map<string, Peer>(prev);
        const existing = newPeers.get(targetId);
        if (existing) {
          existing.stream = event.streams[0];
          newPeers.set(targetId, { ...existing });
        } else {
          newPeers.set(targetId, {
            userId: targetId,
            username: targetUsername,
            displayName: targetDisplayName,
            avatar: targetAvatar,
            connection: pc,
            stream: event.streams[0],
            isMuted: false,
          });
        }
        return newPeers;
      });
    };

    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    peersRef.current.set(targetId, peer);
    setPeers(new Map(peersRef.current));
  };

  const handleSignal = async (senderId: string, signal: any) => {
    let peer = peersRef.current.get(senderId);

    if (!peer) {
      console.log("No peer for sender, creating one on the fly:", senderId);
      await safeCreatePeer(senderId, "Unknown", "Unknown", undefined, false);
      peer = peersRef.current.get(senderId);
      if (!peer) return;
    }

    try {
      if (signal.sdp) {
        console.log(`Received SDP ${signal.sdp.type} from ${senderId}`);

        if (
          signal.sdp.type === "offer" &&
          peer.connection.signalingState !== "stable"
        ) {
          console.log("SDP Offer collision detected, ignoring incoming offer");
          return;
        }

        await peer.connection.setRemoteDescription(
          new RTCSessionDescription(signal.sdp)
        );
        if (signal.sdp.type === "offer") {
          const answer = await peer.connection.createAnswer();
          await peer.connection.setLocalDescription(answer);
          socketRef.current?.send(
            JSON.stringify({
              type: "signal",
              targetId: senderId,
              senderId: userId,
              signal: { sdp: peer.connection.localDescription },
            })
          );
        }
      } else if (signal.candidate) {
        try {
          await peer.connection.addIceCandidate(
            new RTCIceCandidate(signal.candidate)
          );
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

  const toggleMedia = async (type: "audio" | "video") => {
    if (!localStream) {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      stream.getTracks().forEach((t) => (t.enabled = true));
      setLocalStream(stream);
      peersRef.current.forEach((peer) => {
        stream.getTracks().forEach((track) =>
          peer.connection.addTrack(track, stream)
        );
      });
      return;
    }

    const track =
      type === "audio"
        ? localStream.getAudioTracks()[0]
        : localStream.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      if (type === "audio") {
        sendMuteStatus(!track.enabled);
      }
    }
  };

  const startScreenShare = async () => {
    if (isScreenSharing) return;

    try {
      const preset = QUALITY_PRESETS[quality];

      const screenStream = await navigator.mediaDevices
        .getDisplayMedia({
          video: {
            width: preset.width,
            height: preset.height,
            frameRate: preset.frameRate,
          },
          audio: true,
        })
        .catch(() => {
          return navigator.mediaDevices.getDisplayMedia({
            video: {
              width: preset.width,
              height: preset.height,
              frameRate: preset.frameRate,
            },
          });
        });

      if (!screenStream) return;

      setIsScreenSharing(true);
      screenStream.getTracks().forEach((t) => (t.enabled = true));
      const videoTrack = screenStream.getVideoTracks()[0];
      if (!videoTrack) return;

      if (localStream) {
        cameraTrackRef.current = localStream.getVideoTracks()[0] || null;
      }

      peersRef.current.forEach((peer) => {
        const sender = peer.connection
          .getSenders()
          .find((s) => s.track?.kind === "video");
        if (sender) {
          sender.replaceTrack(videoTrack);
          const params = sender.getParameters();
          if (!params.encodings) params.encodings = [{}];
          params.encodings[0].maxBitrate = preset.bitrate;
          sender.setParameters(params).catch(console.error);
        }
      });

      videoTrack.onended = () => stopScreenShare();
      return screenStream;
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        console.warn("Screen sharing was cancelled by the user.");
      } else {
        console.error("Error sharing screen:", err);
      }
      setIsScreenSharing(false);
      return null;
    }
  };

  const stopScreenShare = () => {
    const cameraTrack = cameraTrackRef.current;
    if (!cameraTrack) {
      setIsScreenSharing(false);
      return;
    }

    peersRef.current.forEach((peer) => {
      const sender = peer.connection
        .getSenders()
        .find((s) => s.track?.kind === "video");
      if (sender) {
        sender.replaceTrack(cameraTrack);
      }
    });

    setIsScreenSharing(false);
  };

  return {
    peers,
    localStream,
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
    updateRoomSettings,
  };
}
