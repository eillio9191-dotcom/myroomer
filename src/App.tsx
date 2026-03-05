import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Video, VideoOff, Mic, MicOff, Monitor, MonitorOff, 
  LogOut, Users, Settings, MessageSquare, Plus, Hash,
  Copy, Check, Shield, X, Send, Volume2, VolumeX, Bell, BellOff,
  Sun, Moon, Upload, ArrowLeft, User as UserIcon,
  Maximize2, Minimize2
} from 'lucide-react';
import { useWebRTC, Peer, ChatMessage } from './hooks/useWebRTC';
import { useAudioActivity } from './hooks/useAudioActivity';

// Sound effect URLs
const SOUNDS = {
  JOIN: 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3',
  LEAVE: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3',
  MESSAGE: 'https://assets.mixkit.co/active_storage/sfx/2357/2357-preview.mp3' // Short "dn" sound
};

interface User {
  username: string;
  displayName: string;
  avatar: string;
  theme: 'light' | 'dark';
  language: 'en' | 'ar';
}

const TRANSLATIONS = {
  en: {
    room: "Room",
    myRoomer: "MyRoomer",
    connected: "Connected",
    copyLink: "Copy Room Link",
    createRoom: "Create Room",
    joinRoom: "Join Room",
    enterRoomId: "Enter Room ID or Name",
    currentRoom: "Current Room",
    rejoin: "Rejoin",
    logout: "Logout",
    p2p: "End-to-end P2P",
    unlimited: "Unlimited users",
    userProfile: "User Profile",
    displayName: "Display Name",
    avatarUrl: "Avatar URL",
    themePref: "Theme Preference",
    themeSub: "Switch between light and dark",
    langPref: "Language Preference",
    langSub: "Choose your preferred language",
    saveChanges: "Save Changes",
    loginTitle: "Login to MyRoomer",
    loginSub: "Enter your credentials to continue",
    username: "Username",
    password: "Password",
    displayNameOpt: "Display Name (Optional)",
    signIn: "Sign In",
    participants: "Participants",
    status: "Status",
    online: "Online",
    role: "Role",
    member: "Member",
    closeProfile: "Close Profile",
    chat: "Chat",
    typeMessage: "Type a message...",
    leaveRoom: "Leave Room",
    maximize: "Maximize",
    minimize: "Minimize",
    waiting: "Waiting for others to join...",
    shareLink: "Share the room link to start the meeting",
    you: "You",
    settings: "Settings",
    muteAll: "Mute All Participants",
    muteAllSub: "Silence all incoming audio",
    sounds: "Sound Effects",
    soundsSub: "Join, leave, and message sounds",
    done: "Done"
  },
  ar: {
    room: "الغرفة",
    myRoomer: "ماي رومر",
    connected: "متصل",
    copyLink: "نسخ رابط الغرفة",
    createRoom: "إنشاء غرفة",
    joinRoom: "انضمام للغرفة",
    enterRoomId: "أدخل معرف الغرفة أو اسمها",
    currentRoom: "الغرفة الحالية",
    rejoin: "إعادة الانضمام",
    logout: "تسجيل الخروج",
    p2p: "تشفير P2P من طرف لطرف",
    unlimited: "مستخدمون غير محدودين",
    userProfile: "ملف المستخدم",
    displayName: "اسم العرض",
    avatarUrl: "رابط الصورة الرمزية",
    themePref: "تفضيل المظهر",
    themeSub: "التبديل بين المظهر الفاتح والداكن",
    langPref: "تفضيل اللغة",
    langSub: "اختر لغتك المفضلة",
    saveChanges: "حفظ التغييرات",
    loginTitle: "تسجيل الدخول إلى ماي رومر",
    loginSub: "أدخل بياناتك للمتابعة",
    username: "اسم المستخدم",
    password: "كلمة المرور",
    displayNameOpt: "اسم العرض (اختياري)",
    signIn: "تسجيل الدخول",
    participants: "المشاركون",
    status: "الحالة",
    online: "متصل",
    role: "الدور",
    member: "عضو",
    closeProfile: "إغلاق الملف",
    chat: "الدردشة",
    typeMessage: "اكتب رسالة...",
    leaveRoom: "مغادرة الغرفة",
    maximize: "تكبير",
    minimize: "تصغير",
    waiting: "بانتظار انضمام الآخرين...",
    shareLink: "شارك رابط الغرفة لبدء الاجتماع",
    you: "أنت",
    settings: "الإعدادات",
    muteAll: "كتم أصوات الحضور",
    muteAllSub: "إسكات جميع الأصوات الواردة",
    sounds: "تأثيرات صوتية",
    soundsSub: "أصوات الانضمام والمغادرة والرسائل",
    done: "تم"
  }
};

// Generate a random ID for the user
const USER_ID = Math.random().toString(36).substring(7);

export default function App() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [roomInput, setRoomInput] = useState('');

  // Apply theme and language to body
  useEffect(() => {
    if (user) {
      document.body.classList.remove('light-theme', 'dark-theme');
      document.body.classList.add(`${user.theme}-theme`);
      document.documentElement.dir = user.language === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = user.language;
    } else {
      document.body.classList.add('dark-theme');
      document.documentElement.dir = 'ltr';
    }
  }, [user?.theme, user?.language]);

  // Check URL for room ID
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('room');
    if (id) {
      setRoomId(id);
    }
  }, []);

  const handleLogin = (username: string, displayName: string, avatar: string) => {
    setUser({ username, displayName, avatar, theme: 'dark', language: 'en' });
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    const finalRoomId = roomId || Math.random().toString(36).substring(7);
    setRoomId(finalRoomId);
    window.history.pushState({}, '', `?room=${finalRoomId}`);
    setIsJoined(true);
  };

  if (!user) {
    return <LoginView onLogin={handleLogin} language="en" />;
  }

  if (isProfileOpen) {
    return (
      <ProfileView 
        user={user} 
        onSave={(updatedUser) => {
          setUser(updatedUser);
          setIsProfileOpen(false);
        }} 
        onBack={() => setIsProfileOpen(false)} 
      />
    );
  }

  if (!isJoined) {
    const t = TRANSLATIONS[user.language];
    return (
      <div className="min-h-screen flex items-center justify-center p-4 theme-bg-main">
        {/* Profile Button in Top Left */}
        <div className={`fixed top-6 ${user.language === 'ar' ? 'right-6' : 'left-6'} z-50`}>
          <button 
            onClick={() => setIsProfileOpen(true)}
            className="flex items-center gap-3 p-2 pr-4 theme-bg-panel hover:opacity-80 theme-border border rounded-full transition-all group shadow-lg"
          >
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center overflow-hidden border-2 border-white/20">
              {user.avatar ? (
                <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-white font-bold">{user.displayName[0].toUpperCase()}</span>
              )}
            </div>
            <div className={`${user.language === 'ar' ? 'text-right' : 'text-left'}`}>
              <div className="text-xs font-bold theme-text-main group-hover:text-indigo-400 transition-colors">{user.displayName}</div>
              <div className="text-[10px] theme-text-sub">@{user.username}</div>
            </div>
          </button>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md theme-bg-panel backdrop-blur-md theme-border border p-8 rounded-3xl shadow-2xl"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/20 overflow-hidden">
              {user.avatar ? (
                <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-white text-2xl font-bold">{user.displayName[0].toUpperCase()}</span>
              )}
            </div>
            <h1 className="text-3xl font-bold tracking-tight theme-text-main">{t.myRoomer}</h1>
            <p className="theme-text-sub mt-2 text-center">
              Collaborate in real-time with high-quality video and chat.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-4">
              <div className="relative">
                <input
                  type="text"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  placeholder={t.enterRoomId}
                  className="w-full theme-bg-panel border theme-border rounded-2xl px-5 py-4 theme-text-main focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                />
                <Hash className={`absolute ${user.language === 'ar' ? 'left-5' : 'right-5'} top-1/2 -translate-y-1/2 w-5 h-5 theme-text-sub opacity-50`} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    const id = Math.random().toString(36).substring(7);
                    setRoomId(id);
                    window.history.pushState({}, '', `?room=${id}`);
                    setIsJoined(true);
                  }}
                  className="flex flex-col items-center justify-center gap-3 p-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl transition-all shadow-lg shadow-indigo-500/20 group"
                >
                  <Plus className="w-8 h-8 group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-sm">{t.createRoom}</span>
                </button>
                
                <button
                  onClick={() => {
                    if (roomInput.trim()) {
                      setRoomId(roomInput.trim());
                      window.history.pushState({}, '', `?room=${roomInput.trim()}`);
                      setIsJoined(true);
                    }
                  }}
                  disabled={!roomInput.trim()}
                  className="flex flex-col items-center justify-center gap-3 p-6 theme-bg-panel hover:opacity-80 theme-border border theme-text-main rounded-2xl transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Hash className="w-8 h-8 group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-sm">{t.joinRoom}</span>
                </button>
              </div>
            </div>

            {roomId && (
              <div className="pt-4 theme-border border-t">
                <div className={`text-[10px] theme-text-sub uppercase tracking-widest font-bold mb-2 ${user.language === 'ar' ? 'mr-1' : 'ml-1'}`}>{t.currentRoom}</div>
                <div className="flex items-center justify-between p-3 theme-bg-panel rounded-xl theme-border border">
                  <span className="text-sm theme-text-main font-mono">{roomId}</span>
                  <button 
                    onClick={() => setIsJoined(true)}
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300"
                  >
                    {t.rejoin}
                  </button>
                </div>
              </div>
            )}
            
            <button
              type="button"
              onClick={() => setUser(null)}
              className="w-full theme-text-sub hover:theme-text-main text-xs font-medium py-2 transition-colors"
            >
              {t.logout}
            </button>
          </div>

          <div className="mt-8 pt-6 theme-border border-t flex justify-center gap-4 text-xs theme-text-sub">
            <div className="flex items-center gap-1">
              <Shield className="w-3 h-3" />
              <span>{t.p2p}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              <span>{t.unlimited}</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <RoomView 
      roomId={roomId!} 
      userId={USER_ID} 
      user={user}
      setUser={setUser}
      soundsEnabled={soundsEnabled}
      setSoundsEnabled={setSoundsEnabled}
      onLeave={() => setIsJoined(false)}
    />
  );
}

function ProfileView({ user, onSave, onBack }: { user: User, onSave: (u: User) => void, onBack: () => void }) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [avatar, setAvatar] = useState(user.avatar);
  const [theme, setTheme] = useState(user.theme);
  const [language, setLanguage] = useState(user.language);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = TRANSLATIONS[user.language];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 theme-bg-main">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md theme-bg-panel backdrop-blur-md theme-border border p-8 rounded-3xl shadow-2xl"
      >
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onBack} className={`p-2 hover:opacity-80 rounded-full transition-colors ${user.language === 'ar' ? 'rotate-180' : ''}`}>
            <ArrowLeft className="w-5 h-5 theme-text-sub" />
          </button>
          <h1 className="text-xl font-bold theme-text-main">{t.userProfile}</h1>
        </div>

        <div className="flex flex-col items-center mb-8">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full bg-indigo-600 flex items-center justify-center overflow-hidden border-4 theme-border shadow-2xl">
              {avatar ? (
                <img src={avatar} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-white text-3xl font-bold">{displayName[0]?.toUpperCase() || 'U'}</span>
              )}
            </div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg transition-all"
            >
              <Upload className="w-4 h-4" />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
              accept="image/*"
            />
          </div>
          <div className="mt-4 text-center">
            <div className="text-lg font-bold theme-text-main">{displayName}</div>
            <div className="text-sm theme-text-sub">@{user.username}</div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className={`block text-xs font-semibold theme-text-sub uppercase mb-2 ${user.language === 'ar' ? 'mr-1' : 'ml-1'}`}>{t.displayName}</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-slate-900/50 border theme-border rounded-xl px-4 py-3 theme-text-main focus:ring-2 focus:ring-indigo-500/50 outline-none"
            />
          </div>

          <div>
            <label className={`block text-xs font-semibold theme-text-sub uppercase mb-2 ${user.language === 'ar' ? 'mr-1' : 'ml-1'}`}>{t.avatarUrl}</label>
            <input
              type="text"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              className="w-full bg-slate-900/50 border theme-border rounded-xl px-4 py-3 theme-text-main focus:ring-2 focus:ring-indigo-500/50 outline-none"
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div className="flex items-center justify-between p-4 theme-bg-panel rounded-2xl border theme-border">
            <div className={`${user.language === 'ar' ? 'text-right' : 'text-left'}`}>
              <div className="text-sm font-bold theme-text-main">{t.themePref}</div>
              <div className="text-xs theme-text-sub">{t.themeSub}</div>
            </div>
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`p-3 rounded-xl transition-all ${theme === 'light' ? 'bg-slate-200 text-slate-900' : 'bg-slate-800 text-white'}`}
            >
              {theme === 'light' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>

          <div className="flex items-center justify-between p-4 theme-bg-panel rounded-2xl border theme-border">
            <div className={`${user.language === 'ar' ? 'text-right' : 'text-left'}`}>
              <div className="text-sm font-bold theme-text-main">{t.langPref}</div>
              <div className="text-xs theme-text-sub">{t.langSub}</div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setLanguage('en')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${language === 'en' ? 'bg-indigo-600 text-white' : 'theme-bg-main theme-text-sub'}`}
              >
                EN
              </button>
              <button 
                onClick={() => setLanguage('ar')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${language === 'ar' ? 'bg-indigo-600 text-white' : 'theme-bg-main theme-text-sub'}`}
              >
                AR
              </button>
            </div>
          </div>

          <button
            onClick={() => onSave({ ...user, displayName, avatar, theme, language })}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-indigo-500/20"
          >
            {t.saveChanges}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function LoginView({ onLogin, language }: { onLogin: (u: string, d: string, a: string) => void, language: 'en' | 'ar' }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatar, setAvatar] = useState(`https://picsum.photos/seed/${Math.random()}/200`);
  const t = TRANSLATIONS[language];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(username, displayName || username, avatar);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 theme-bg-main">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md theme-bg-panel border theme-border p-8 rounded-3xl shadow-2xl"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 mx-auto shadow-lg shadow-indigo-500/20">
            <Video className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold theme-text-main">{t.loginTitle}</h1>
          <p className="theme-text-sub text-sm mt-1">{t.loginSub}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-xs font-semibold theme-text-sub uppercase mb-2 ${language === 'ar' ? 'mr-1' : 'ml-1'}`}>{t.username}</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-900/50 border theme-border rounded-xl px-4 py-3 theme-text-main focus:ring-2 focus:ring-indigo-500/50 outline-none"
              placeholder="johndoe"
            />
          </div>
          <div>
            <label className={`block text-xs font-semibold theme-text-sub uppercase mb-2 ${language === 'ar' ? 'mr-1' : 'ml-1'}`}>{t.password}</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-900/50 border theme-border rounded-xl px-4 py-3 theme-text-main focus:ring-2 focus:ring-indigo-500/50 outline-none"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className={`block text-xs font-semibold theme-text-sub uppercase mb-2 ${language === 'ar' ? 'mr-1' : 'ml-1'}`}>{t.displayNameOpt}</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-slate-900/50 border theme-border rounded-xl px-4 py-3 theme-text-main focus:ring-2 focus:ring-indigo-500/50 outline-none"
              placeholder="John Doe"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/20 mt-4"
          >
            {t.signIn}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function RoomView({ 
  roomId, userId, user, setUser, soundsEnabled, setSoundsEnabled, onLeave 
}: { 
  roomId: string; 
  userId: string; 
  user: User;
  setUser: (u: User) => void;
  soundsEnabled: boolean;
  setSoundsEnabled: (val: boolean) => void;
  onLeave: () => void;
}) {
  const t = TRANSLATIONS[user.language];

  const { 
    peers, localStream, setLocalStream, toggleMedia, 
    startScreenShare, stopScreenShare, isScreenSharing,
    messages, sendChatMessage, isMutedAll, toggleMuteAll,
    sendMuteStatus, updateProfile
  } = useWebRTC(roomId, userId, user.username, user.displayName, user.avatar);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [viewingProfile, setViewingProfile] = useState<{ username: string, displayName: string, avatar?: string } | null>(null);
  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatInput, setChatInput] = useState('');
  
  // Profile editing state
  const [tempDisplayName, setTempDisplayName] = useState(user.displayName);
  const [tempAvatar, setTempAvatar] = useState(user.avatar);

  const prevPeersCount = useRef(peers.size);
  const prevMessagesCount = useRef(messages.length);

  const isSpeaking = useAudioActivity(localStream, micOn);

  const playSound = (url: string) => {
    if (!soundsEnabled) return;
    const audio = new Audio(url);
    audio.play().catch(e => console.warn("Audio play blocked:", e));
  };

  const handleUpdateProfile = () => {
    const newUser = { ...user, displayName: tempDisplayName, avatar: tempAvatar };
    setUser(newUser);
    updateProfile(tempDisplayName, tempAvatar);
  };

  // Trigger sounds for peers joining/leaving
  useEffect(() => {
    if (peers.size > prevPeersCount.current) {
      playSound(SOUNDS.JOIN);
    } else if (peers.size < prevPeersCount.current) {
      playSound(SOUNDS.LEAVE);
    }
    prevPeersCount.current = peers.size;
  }, [peers.size]);

  // Trigger sounds for new messages
  useEffect(() => {
    if (messages.length > prevMessagesCount.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.senderId !== userId) {
        playSound(SOUNDS.MESSAGE);
      }
    }
    prevMessagesCount.current = messages.length;
  }, [messages.length, userId]);

  useEffect(() => {
    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        // Initial mute status
        sendMuteStatus(!stream.getAudioTracks()[0].enabled);
      } catch (err) {
        console.error("Error accessing media devices:", err);
      }
    };
    initMedia();
  }, []);

  // Handle unread messages
  useEffect(() => {
    if (!isChatOpen && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.senderId !== userId) {
        setUnreadCount(prev => prev + 1);
      }
    }
  }, [messages, isChatOpen, userId]);

  // Reset unread count when chat opens
  useEffect(() => {
    if (isChatOpen) {
      setUnreadCount(0);
    }
  }, [isChatOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleToggleMic = () => {
    toggleMedia('audio');
    setMicOn(!micOn);
  };

  const handleToggleCam = () => {
    toggleMedia('video');
    setCamOn(!camOn);
  };

  const handleStartScreenShare = async () => {
    const screenStream = await startScreenShare();
    if (screenStream && localVideoRef.current) {
      localVideoRef.current.srcObject = screenStream;
    }
  };

  const handleStopScreenShare = async () => {
    await stopScreenShare();
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChatMessage(chatInput);
    setChatInput('');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-screen flex flex-col theme-bg-main overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b theme-border flex items-center justify-between px-6 theme-bg-panel backdrop-blur-md z-10 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Video className="text-white w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black theme-text-main leading-none tracking-tight">{t.room}: {roomId}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] theme-text-sub uppercase tracking-widest font-bold opacity-60">{t.myRoomer} • {t.connected}</span>
              <button 
                onClick={copyLink}
                className="theme-text-sub hover:theme-text-main transition-colors"
                title={t.copyLink}
              >
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <button 
              onClick={() => setIsParticipantsOpen(!isParticipantsOpen)}
              className={`flex ${user.language === 'ar' ? 'space-x-reverse -space-x-2 ml-4' : '-space-x-2 mr-4'} hover:opacity-80 transition-opacity cursor-pointer`}
            >
              {[...Array(Math.min(peers.size + 1, 4))].map((_, i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 theme-border bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400 overflow-hidden">
                  {i === 0 ? (
                    user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : user.displayName[0].toUpperCase()
                  ) : 'P'}
                </div>
              ))}
              {peers.size > 3 && (
                <div className="w-8 h-8 rounded-full border-2 theme-border bg-slate-700 flex items-center justify-center text-[10px] font-bold text-white">
                  +{peers.size - 3}
                </div>
              )}
            </button>

            {/* Participants Dropdown */}
            <AnimatePresence>
              {isParticipantsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-12 right-0 w-64 theme-bg-panel border theme-border rounded-2xl shadow-2xl p-4 z-50"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold theme-text-sub uppercase tracking-widest">{t.participants} ({peers.size + 1})</h3>
                    <button onClick={() => setIsParticipantsOpen(false)}><X className="w-3 h-3 theme-text-sub" /></button>
                  </div>
                  <div className={`space-y-3 max-h-60 overflow-y-auto ${user.language === 'ar' ? 'pl-2' : 'pr-2'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white overflow-hidden">
                        {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : user.displayName[0].toUpperCase()}
                      </div>
                      <span className="text-sm theme-text-main font-medium">{user.displayName} ({t.you})</span>
                    </div>
                    {Array.from(peers.values()).map((peer: Peer) => (
                      <button 
                        key={peer.userId} 
                        onClick={() => setViewingProfile(peer)}
                        className="w-full flex items-center gap-3 p-1 hover:opacity-80 rounded-lg transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 overflow-hidden">
                          {peer.avatar ? <img src={peer.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : peer.displayName[0].toUpperCase()}
                        </div>
                        <span className="text-sm theme-text-sub">{peer.displayName}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Profile Detail Modal */}
            <AnimatePresence>
              {viewingProfile && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-[100] p-4 pt-32">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="w-full max-w-xs theme-bg-panel border theme-border rounded-3xl shadow-2xl p-6 text-center relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-full h-24 bg-indigo-600/10 -z-10" />
                    
                    <button 
                      onClick={() => setViewingProfile(null)}
                      className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors theme-text-sub z-10"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <div className="w-28 h-28 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4 overflow-hidden border-4 theme-border mt-2 shadow-xl">
                      {viewingProfile.avatar ? (
                        <img src={viewingProfile.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="text-4xl font-bold text-slate-500">{viewingProfile.displayName[0].toUpperCase()}</span>
                      )}
                    </div>
                    <h3 className="text-2xl font-bold theme-text-main tracking-tight">{viewingProfile.displayName}</h3>
                    <p className="text-sm theme-text-sub mb-8 font-medium">@{viewingProfile.username}</p>
                    
                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div className="p-3 theme-bg-main rounded-2xl border theme-border">
                          <div className="text-[10px] theme-text-sub uppercase font-bold mb-1">{t.status}</div>
                          <div className="text-xs theme-text-main font-bold flex items-center justify-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            {t.online}
                          </div>
                        </div>
                        <div className="p-3 theme-bg-main rounded-2xl border theme-border">
                          <div className="text-[10px] theme-text-sub uppercase font-bold mb-1">{t.role}</div>
                          <div className="text-xs theme-text-main font-bold">{t.member}</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => setViewingProfile(null)}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-indigo-500/30"
                      >
                        {t.closeProfile}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Video Grid */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className={`${spotlightId ? 'flex flex-col lg:flex-row gap-4 h-full max-w-[1600px] mx-auto' : 'video-grid max-w-7xl mx-auto'}`}>
            {spotlightId ? (
              <>
                {/* Spotlight View */}
                <div className="flex-1 relative bg-black/20 rounded-3xl overflow-hidden border-2 theme-border shadow-2xl min-h-[300px]">
                  {spotlightId === userId ? (
                    <div className="w-full h-full relative">
                      <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className={`w-full h-full object-contain ${!camOn ? 'hidden' : ''}`}
                      />
                      {!camOn && (
                        <div className="absolute inset-0 flex items-center justify-center theme-bg-main">
                          <div className="w-48 h-48 rounded-full theme-bg-panel flex items-center justify-center text-6xl font-bold theme-text-sub overflow-hidden border-4 theme-border">
                            {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : user.displayName[0].toUpperCase()}
                          </div>
                        </div>
                      )}
                      <div className="absolute bottom-6 left-6 flex items-center gap-3 px-4 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 shadow-lg">
                        <div className={`w-3 h-3 rounded-full ${isSpeaking ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                        <span className="text-sm font-bold text-white">{user.displayName} ({t.you})</span>
                      </div>
                    </div>
                  ) : (
                    <SpotlightPeerVideo 
                      peer={peers.get(spotlightId)!} 
                      onMinimize={() => setSpotlightId(null)}
                      t={t}
                    />
                  )}
                  <button 
                    onClick={() => setSpotlightId(null)}
                    className={`absolute top-6 ${user.language === 'ar' ? 'left-6' : 'right-6'} p-3 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white rounded-full transition-all border border-white/10 shadow-xl z-20`}
                    title={t.minimize}
                  >
                    <Minimize2 className="w-6 h-6" />
                  </button>
                </div>

                {/* Sidebar for other participants */}
                <div className="lg:w-72 flex lg:flex-col gap-4 overflow-x-auto lg:overflow-y-auto pb-4 lg:pb-0 shrink-0">
                  {spotlightId !== userId && (
                    <div 
                      onClick={() => setSpotlightId(userId)}
                      className={`relative w-48 lg:w-full aspect-video rounded-2xl overflow-hidden border-2 cursor-pointer hover:opacity-90 transition-all shrink-0 ${isSpeaking ? 'border-emerald-500' : 'theme-border'}`}
                    >
                      <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className={`w-full h-full object-cover pointer-events-none ${!camOn ? 'hidden' : ''}`}
                      />
                      {!camOn && (
                        <div className="absolute inset-0 flex items-center justify-center theme-bg-main">
                          <div className="w-12 h-12 rounded-full theme-bg-panel flex items-center justify-center text-lg font-bold theme-text-sub overflow-hidden border theme-border">
                            {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : user.displayName[0].toUpperCase()}
                          </div>
                        </div>
                      )}
                      <div className={`absolute bottom-2 ${user.language === 'ar' ? 'right-2' : 'left-2'} px-2 py-1 rounded bg-black/60 backdrop-blur-sm text-[10px] font-bold text-white`}>
                        {t.you}
                      </div>
                    </div>
                  )}
                  {Array.from(peers.values()).filter((p: Peer) => p.userId !== spotlightId).map((peer: Peer) => (
                    <div 
                      key={peer.userId}
                      onClick={() => setSpotlightId(peer.userId)}
                      className="relative w-48 lg:w-full aspect-video rounded-2xl overflow-hidden border-2 theme-border cursor-pointer hover:opacity-90 transition-all shrink-0"
                    >
                      <MiniPeerVideo peer={peer} />
                      <div className={`absolute bottom-2 ${user.language === 'ar' ? 'right-2' : 'left-2'} px-2 py-1 rounded bg-black/60 backdrop-blur-sm text-[10px] font-bold text-white`}>
                        {peer.displayName}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                {/* Normal Grid View */}
                <div 
                  className={`video-container group transition-all duration-300 border-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                    isSpeaking ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 
                    !micOn ? 'border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.3)]' : 
                    'theme-border'
                  }`}
                >
                  <div className="w-full h-full relative" onClick={() => setViewingProfile(user)}>
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className={`w-full h-full object-cover ${!camOn ? 'hidden' : ''}`}
                    />
                    {!camOn && (
                      <div className="absolute inset-0 flex items-center justify-center theme-bg-main">
                        <div className="w-24 h-24 rounded-full theme-bg-panel flex items-center justify-center text-3xl font-bold theme-text-sub overflow-hidden border-2 theme-border">
                          {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : user.displayName[0].toUpperCase()}
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 shadow-lg">
                      <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.8)] ${isSpeaking ? 'bg-emerald-400 animate-pulse scale-110' : 'bg-slate-500'}`} />
                      <span className="text-xs font-bold text-white tracking-wide">{user.displayName} ({t.you})</span>
                      {!micOn && <MicOff className="w-3 h-3 text-rose-500 ml-1" />}
                    </div>
                  </div>
                  
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSpotlightId(userId); }}
                    className={`absolute top-3 ${user.language === 'ar' ? 'left-3' : 'right-3'} p-2 bg-black/40 hover:bg-black/60 backdrop-blur-md text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all border border-white/10`}
                    title={t.maximize}
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Peer Videos */}
                {Array.from(peers.values()).map((peer: Peer) => (
                  <PeerVideo 
                    key={peer.userId} 
                    peer={peer} 
                    onClick={() => setViewingProfile(peer)}
                    onMaximize={() => setSpotlightId(peer.userId)}
                    t={t}
                    language={user.language}
                  />
                ))}

                {peers.size === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-20 opacity-20">
                    <Users className="w-16 h-16 mb-4" />
                    <p className="text-lg font-medium">{t.waiting}</p>
                    <p className="text-sm">{t.shareLink}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </main>

        {/* Chat Panel */}
        <AnimatePresence>
          {isChatOpen && (
            <motion.aside
              initial={{ x: user.language === 'ar' ? '-100%' : '100%' }}
              animate={{ x: 0 }}
              exit={{ x: user.language === 'ar' ? '-100%' : '100%' }}
              className={`chat-panel ${user.language === 'ar' ? 'left-0 border-r' : 'right-0 border-l'}`}
            >
              <div className="h-16 border-b theme-border flex items-center justify-between px-6 shrink-0">
                <h3 className="text-sm font-bold theme-text-main">{t.chat}</h3>
                <button 
                  onClick={() => setIsChatOpen(false)}
                  className="p-2 hover:opacity-80 rounded-lg theme-text-sub"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 flex flex-col"
              >
                {messages.map((msg, i) => (
                  <div 
                    key={i}
                    className={`chat-message ${msg.senderId === userId ? 'chat-message-mine' : 'chat-message-other'}`}
                  >
                    {msg.senderId !== userId && (
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-4 h-4 rounded-full bg-slate-700 overflow-hidden">
                          {msg.avatar ? (
                            <img src={msg.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[8px] text-slate-400">
                              {msg.displayName[0].toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="text-[10px] font-bold text-indigo-400">{msg.displayName}</div>
                      </div>
                    )}
                    <div className="text-sm">{msg.text}</div>
                    <div className={`text-[9px] opacity-50 mt-1 ${user.language === 'ar' ? 'text-left' : 'text-right'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSendChat} className="p-4 border-t theme-border flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={t.typeMessage}
                  className="flex-1 theme-bg-panel border theme-border rounded-xl px-4 py-2 text-sm theme-text-main focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
                <button 
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all disabled:opacity-50"
                >
                  <Send className={`w-4 h-4 ${user.language === 'ar' ? 'rotate-180' : ''}`} />
                </button>
              </form>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Controls */}
      <footer className="h-24 flex items-center justify-center gap-4 px-6 bg-gradient-to-t from-black/20 to-transparent shrink-0">
        <div className="theme-bg-panel backdrop-blur-md border theme-border px-4 md:px-6 py-3 rounded-2xl flex items-center gap-2 md:gap-4 shadow-2xl">
          <button 
            onClick={isScreenSharing ? handleStopScreenShare : handleStartScreenShare}
            className={`control-btn ${isScreenSharing ? 'control-btn-active' : 'control-btn-inactive'}`}
          >
            {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </button>

          <button 
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`control-btn ${isChatOpen ? 'control-btn-active' : 'control-btn-inactive'} relative`}
          >
            <MessageSquare className="w-5 h-5" />
            {!isChatOpen && unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-[10px] font-bold text-white rounded-full flex items-center justify-center border-2 theme-border animate-bounce">
                {unreadCount}
              </span>
            )}
          </button>

          <div className="w-px h-8 theme-border border-l mx-1 md:mx-2" />

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

          <button 
            onClick={onLeave}
            className="control-btn control-btn-danger"
            title={t.leaveRoom}
          >
            <LogOut className="w-5 h-5" />
          </button>

          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="control-btn control-btn-inactive"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </footer>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="settings-overlay">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="settings-modal"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold theme-text-main">{t.settings}</h3>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-2 hover:opacity-80 rounded-lg theme-text-sub"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className={`${user.language === 'ar' ? 'text-right' : 'text-left'}`}>
                    <div className="text-sm font-semibold theme-text-main">{t.muteAll}</div>
                    <div className="text-xs theme-text-sub">{t.muteAllSub}</div>
                  </div>
                  <button 
                    onClick={toggleMuteAll}
                    className={`p-3 rounded-xl transition-all ${isMutedAll ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                  >
                    {isMutedAll ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className={`${user.language === 'ar' ? 'text-right' : 'text-left'}`}>
                    <div className="text-sm font-semibold theme-text-main">{t.sounds}</div>
                    <div className="text-xs theme-text-sub">{t.soundsSub}</div>
                  </div>
                  <button 
                    onClick={() => setSoundsEnabled(!soundsEnabled)}
                    className={`p-3 rounded-xl transition-all ${soundsEnabled ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                  >
                    {soundsEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                  </button>
                </div>

                <div className="pt-6 theme-border border-t">
                  <button 
                    onClick={() => setIsSettingsOpen(false)}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition-all"
                  >
                    {t.done}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface PeerVideoProps {
  peer: Peer;
  onClick: () => void;
  onMaximize: () => void;
  t: any;
  language: 'en' | 'ar';
}

const PeerVideo: React.FC<PeerVideoProps> = ({ peer, onClick, onMaximize, t, language }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isSpeaking = useAudioActivity(peer.stream || null, !peer.isMuted);

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream;
    }
  }, [peer.stream]);

  return (
    <div 
      className={`video-container group transition-all duration-300 border-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
        isSpeaking ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 
        peer.isMuted ? 'border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.3)]' : 
        'theme-border'
      }`}
    >
      <div className="w-full h-full relative" onClick={onClick}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        {!peer.stream && (
          <div className="absolute inset-0 flex items-center justify-center theme-bg-main">
            <div className="w-24 h-24 rounded-full theme-bg-panel flex items-center justify-center text-3xl font-bold theme-text-sub overflow-hidden border-2 theme-border">
              {peer.avatar ? <img src={peer.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : peer.displayName[0].toUpperCase()}
            </div>
          </div>
        )}
        <div className={`absolute bottom-3 ${language === 'ar' ? 'right-3' : 'left-3'} flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 shadow-lg`}>
          <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.8)] ${isSpeaking ? 'bg-emerald-400 animate-pulse scale-110' : 'bg-slate-500'}`} />
          <span className="text-xs font-bold text-white tracking-wide">{peer.displayName}</span>
          {peer.isMuted && <MicOff className="w-3 h-3 text-rose-500 ml-1" />}
        </div>
      </div>

      <button 
        onClick={(e) => { e.stopPropagation(); onMaximize(); }}
        className={`absolute top-3 ${language === 'ar' ? 'left-3' : 'right-3'} p-2 bg-black/40 hover:bg-black/60 backdrop-blur-md text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all border border-white/10`}
        title={t.maximize}
      >
        <Maximize2 className="w-4 h-4" />
      </button>
    </div>
  );
}

const SpotlightPeerVideo: React.FC<{ peer: Peer, onMinimize: () => void, t: any }> = ({ peer, t }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isSpeaking = useAudioActivity(peer.stream || null, !peer.isMuted);

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream;
    }
  }, [peer.stream]);

  return (
    <div className="w-full h-full relative">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-contain"
      />
      {!peer.stream && (
        <div className="absolute inset-0 flex items-center justify-center theme-bg-main">
          <div className="w-48 h-48 rounded-full theme-bg-panel flex items-center justify-center text-6xl font-bold theme-text-sub overflow-hidden border-4 theme-border">
            {peer.avatar ? <img src={peer.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : peer.displayName[0].toUpperCase()}
          </div>
        </div>
      )}
      <div className="absolute bottom-6 left-6 flex items-center gap-3 px-4 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 shadow-lg">
        <div className={`w-3 h-3 rounded-full ${isSpeaking ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
        <span className="text-sm font-bold text-white tracking-wide">{peer.displayName}</span>
        {peer.isMuted && <MicOff className="w-4 h-4 text-rose-500 ml-1" />}
      </div>
    </div>
  );
}

const MiniPeerVideo: React.FC<{ peer: Peer }> = ({ peer }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream;
    }
  }, [peer.stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className="w-full h-full object-cover pointer-events-none"
    />
  );
}
