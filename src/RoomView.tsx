import { useEffect, useRef, useState } from "react";
import { useWebRTC, Peer } from "./hooks/useWebRTC"; // صححنا المسار
import { MicOff, Video, LogOut, MessageSquare, Users, Copy, Check } from "lucide-react";

interface RoomViewProps {
  roomId: string;
  userId: string;
  username: string;
}

export default function RoomView({ roomId, userId, username }: RoomViewProps) {
  const { 
    peers, localStream, toggleMedia, 
    messages, sendMessage
  } = useWebRTC(roomId, userId, username);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [copied, setCopied] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

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

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendMessage(chatInput.trim());
    setChatInput('');
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
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                Room: {roomId}
              </span>
              <button onClick={copyLink} className="text-slate-500 hover:text-white transition-colors">
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>
        <button 
          onClick={() => window.location.href = '/'}
          className="control-btn control-btn-danger !p-2 rounded-lg"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        <div className="video-grid max-w-7xl mx-auto h-full flex-1 p-6 overflow-auto content-start">
          <div className="video-container group">
            <video ref={localVideoRef} autoPlay muted playsInline className={`w-full h-full object-cover ${!camOn ? 'hidden' : ''}`} />
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

          {Array.from(peers.values()).map((peer: Peer) => (
            <div key={peer.userId} className="video-container">
              <video autoPlay playsInline />
            </div>
          ))}

          {peers.size === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 opacity-20">
              <Users className="w-16 h-16 mb-4" />
              <p className="text-lg font-medium">Waiting for others to join...</p>
            </div>
          )}
        </div>

        {/* Chat Sidebar */}
        <div className={`bg-slate-900/90 p-4 gap-4 transition-transform duration-300
          ${chatOpen ? 'translate-x-0' : 'translate-x-full'} 
          fixed right-0 top-16 h-[calc(100%-4rem)] w-80 md:relative md:translate-x-0 md:flex flex-col rounded-l-2xl`}>
          <h3 className="text-white font-bold text-lg">Chat</h3>
          <div className="flex-1 overflow-y-auto flex flex-col gap-2 mt-2">
            {messages.map((msg, i) => (
              <div key={i} className="p-2 rounded-lg bg-slate-800 text-white">
                <span className="font-bold">{msg.username}: </span>{msg.text}
              </div>
            ))}
          </div>
          <form onSubmit={handleSendMessage} className="flex gap-2 mt-2">
            <input 
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 rounded-lg bg-slate-700 text-white focus:outline-none"
            />
            <button type="submit" className="bg-indigo-600 px-4 py-2 rounded-lg text-white">Send</button>
          </form>
        </div>
      </main>

      {/* Chat Toggle for Mobile */}
      <button 
        className="fixed bottom-32 right-4 md:hidden bg-indigo-600 p-3 rounded-full shadow-lg z-20"
        onClick={() => setChatOpen(!chatOpen)}
      >
        <MessageSquare className="w-5 h-5 text-white" />
      </button>
    </div>
  );
}