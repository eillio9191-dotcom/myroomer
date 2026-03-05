import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Video, VideoOff, Mic, MicOff, Monitor, MonitorOff, 
  LogOut, Users, Settings, MessageSquare, Plus, Hash,
  Copy, Check, Shield
} from 'lucide-react';
import { useWebRTC, Peer } from './hooks/useWebRTC';

// Generate a random ID for the user
const USER_ID = Math.random().toString(36).substring(7);

export default function App() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [copied, setCopied] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  // Check URL for room ID
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('room');
    if (id) {
      setRoomId(id);
    }
  }, []);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) return;
    
    const finalRoomId = roomId || Math.random().toString(36).substring(7);
    setRoomId(finalRoomId);
    window.history.pushState({}, '', `?room=${finalRoomId}`);
    setIsJoined(true);
  };

  if (!isJoined) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-950/20 via-[#0f1115] to-[#0f1115]">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md glass-panel p-8 rounded-3xl shadow-2xl"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/20">
              <Video className="text-white w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">MyRoomer</h1>
            <p className="text-slate-400 mt-2 text-center">
              {roomId ? `Joining room: ${roomId}` : 'Create a new room to start collaborating'}
            </p>
          </div>

          <form onSubmit={handleJoin} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 ml-1">
                Your Name
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your name..."
                className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
            >
              {roomId ? 'Join Room' : 'Create Room'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 flex justify-center gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <Shield className="w-3 h-3" />
              <span>End-to-end P2P</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              <span>Unlimited users</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return <RoomView roomId={roomId!} userId={USER_ID} username={username} />;
}

function RoomView({ roomId, userId, username }: { roomId: string; userId: string; username: string }) {
  const { 
    peers, localStream, setLocalStream, toggleMedia, 
    startScreenShare, stopScreenShare, isScreenSharing 
  } = useWebRTC(roomId, userId, username);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing media devices:", err);
      }
    };
    initMedia();
  }, []);

  const handleToggleMic = () => {
    toggleMedia('audio');
    setMicOn(!micOn);
  };

  const handleToggleCam = () => {
    toggleMedia('video');
    setCamOn(!camOn);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-screen flex flex-col bg-[#0f1115]">
      {/* Header */}
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-[#0f1115]/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Video className="text-white w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white leading-none">MyRoomer</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Room: {roomId}</span>
              <button 
                onClick={copyLink}
                className="text-slate-500 hover:text-white transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex -space-x-2 mr-4">
            {[...Array(Math.min(peers.size + 1, 4))].map((_, i) => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-[#0f1115] bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
                {i === 0 ? username[0].toUpperCase() : 'P'}
              </div>
            ))}
            {peers.size > 3 && (
              <div className="w-8 h-8 rounded-full border-2 border-[#0f1115] bg-slate-700 flex items-center justify-center text-[10px] font-bold text-white">
                +{peers.size - 3}
              </div>
            )}
          </div>
          <button 
            onClick={() => window.location.href = '/'}
            className="control-btn control-btn-danger !p-2 rounded-lg"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="video-grid max-w-7xl mx-auto h-full content-start">
          {/* Local Video */}
          <div className="video-container group">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover ${!camOn ? 'hidden' : ''}`}
            />
            {!camOn && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center text-3xl font-bold text-slate-500">
                  {username[0].toUpperCase()}
                </div>
              </div>
            )}
            <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 backdrop-blur-md border border-white/10">
              <span className="text-xs font-medium text-white">You</span>
              {!micOn && <MicOff className="w-3 h-3 text-rose-500" />}
            </div>
          </div>

          {/* Peer Videos */}
          {Array.from(peers.values()).map((peer: Peer) => (
            <PeerVideo key={peer.userId} peer={peer} />
          ))}

          {peers.size === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 opacity-20">
              <Users className="w-16 h-16 mb-4" />
              <p className="text-lg font-medium">Waiting for others to join...</p>
              <p className="text-sm">Share the room link to start the meeting</p>
            </div>
          )}
        </div>
      </main>

      {/* Controls */}
      <footer className="h-24 flex items-center justify-center gap-4 px-6 bg-gradient-to-t from-black/50 to-transparent">
        <div className="glass-panel px-6 py-3 rounded-2xl flex items-center gap-4 shadow-2xl">
          <button 
            onClick={handleToggleMic}
            className={`control-btn ${micOn ? 'control-btn-active' : 'control-btn-inactive'}`}
          >
            {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>
          
          <button 
            onClick={handleToggleCam}
            className={`control-btn ${camOn ? 'control-btn-active' : 'control-btn-inactive'}`}
          >
            {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          <div className="w-px h-8 bg-white/10 mx-2" />

          <button 
            onClick={isScreenSharing ? stopScreenShare : startScreenShare}
            className={`control-btn ${isScreenSharing ? 'control-btn-active' : 'control-btn-inactive'}`}
          >
            {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </button>

          <button className="control-btn control-btn-inactive">
            <MessageSquare className="w-5 h-5" />
          </button>

          <button className="control-btn control-btn-inactive">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </footer>
    </div>
  );
}

interface PeerVideoProps {
  peer: Peer;
}

const PeerVideo: React.FC<PeerVideoProps> = ({ peer }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream;
    }
  }, [peer.stream]);

  return (
    <div className="video-container group">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      {!peer.stream && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
          <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center text-3xl font-bold text-slate-500">
            {peer.username[0].toUpperCase()}
          </div>
        </div>
      )}
      <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 backdrop-blur-md border border-white/10">
        <span className="text-xs font-medium text-white">{peer.username}</span>
      </div>
    </div>
  );
}
