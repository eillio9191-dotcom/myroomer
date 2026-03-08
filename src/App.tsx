import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Video, VideoOff, Mic, MicOff, Monitor, MonitorOff, 
  LogOut, Users, Settings, MessageSquare, Plus, Hash, Globe,
  Copy, Check, Clock, ShieldAlert, X, Send, Volume2, VolumeX, Bell, BellOff,
  Sun, Moon, Upload, ArrowLeft, User as UserIcon,
  Maximize2, Minimize2, Search, Phone, UserMinus, CheckCircle2, Trash2
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
  ownedRooms?: string[];
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
    done: "Done",
    quality: "Video Quality",
    qualitySub: "Adjust resolution and bitrate",
    broadcastQuality: "Broadcast Quality",
    broadcastQualitySub: "Apply quality settings to your outgoing stream",
    searchUser: "Search for a user...",
    call: "Call",
    message: "Message",
    preJoin: "Pre-join Settings",
    joinNow: "Join Now",
    waitingApproval: "Waiting for owner approval...",
    lobby: "Lobby",
    approve: "Approve",
    reject: "Reject",
    kick: "Kick",
    deleteRoom: "Delete Room",
    ownedRooms: "My Rooms",
    noOwnedRooms: "You haven't created any rooms yet.",
    incomingCall: "Incoming Call",
    accept: "Accept",
    roomTag: "Room Tag",
    enterRoomTag: "Enter Room Tag (e.g. Family, Work)",
    homeSub: "Connect with your friends and family in secure and private rooms",
    globalSearch: "Search for People by Username",
    userInfo: "User Information",
    search: "Search",
    autoAccept: "Auto-accept all",
    autoReject: "Auto-reject all",
    autoAcceptSub: "Automatically approve all join requests",
    autoRejectSub: "Automatically reject all join requests",
    confirmDelete: "Are you sure you want to delete this room?",
    lobbySub: "The room owner will review your request shortly.",
    offline: "No Internet Connection",
    offlineSub: "Please check your network settings.",
    adminDashboard: "Admin Dashboard",
    allUsers: "All Users",
    totalRooms: "Total Rooms",
    noUsers: "No users found.",
    viewRooms: "View Rooms",
    backToProfile: "Back to Profile",
    ban: "Ban User",
    unban: "Unban User",
    changePassword: "Change Password",
    remove: "Remove",
  },
  ar: {
    room: "الغرفة",
    myRoomer: "MyRoomer",
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
    themePref_light: "فاتح",
    themePref_dark: "داكن",
    langPref: "تفضيل اللغة",
    langSub: "اختر لغتك المفضلة",
    saveChanges: "حفظ التغييرات",
    loginTitle: "تسجيل الدخول إلى MyRoomer",
    loginSub: "أدخل بياناتك للمتابعة",
    username: "اسم المستخدم",
    password: "كلمة المرور",
    displayNameOpt: "اسم العرض (اختياري)",
    signIn: "تسجيل الدخول",
    participants: "الحاضرين",
    status: "الحالة",
    online: "متصل",
    role: "الدور",
    member: "عضو",
    closeProfile: "إغلاق الملف الشخصي",
    chat: "الدردشة",
    typeMessage: "اكتب رسالة...",
    leaveRoom: "مغادرة الغرفة",
    maximize: "تكبير",
    minimize: "تصغير",
    waiting: "في انتظار انضمام الآخرين...",
    shareLink: "شارك رابط الغرفة لبدء الاجتماع",
    you: "أنت",
    settings: "الإعدادات",
    muteAll: "كتم صوت الجميع",
    muteAllSub: "إسكات جميع الأصوات الواردة",
    sounds: "المؤثرات الصوتية",
    soundsSub: "أصوات الانضمام والمغادرة والرسائل",
    done: "تم",
    quality: "جودة الفيديو",
    qualitySub: "ضبط الدقة ومعدل البت",
    broadcastQuality: "جودة البث",
    broadcastQualitySub: "تطبيق إعدادات الجودة على بثك الصادر",
    searchUser: "البحث عن مستخدم باسم المستخدم...",
    call: "اتصال",
    message: "رسالة",
    preJoin: "إعدادات ما قبل الانضمام",
    joinNow: "انضم الآن",
    waitingApproval: "في انتظار موافقة المالك...",
    lobby: "غرفة الانتظار",
    approve: "قبول",
    reject: "رفض",
    kick: "إزالة",
    deleteRoom: "حذف الغرفة",
    ownedRooms: "غرفي",
    noOwnedRooms: "لم تقم بإنشاء أي غرف بعد.",
    incomingCall: "مكالمة واردة",
    accept: "قبول",
    roomTag: "وسم الغرفة",
    enterRoomTag: "أدخل وسم الغرفة (مثلاً: العائلة، العمل)",
    homeSub: "تواصل مع أصدقائك وعائلتك في غرف آمنة وخاصة",
    globalSearch: "البحث عن أشخاص باسم المستخدم",
    userInfo: "معلومات المستخدم",
    search: "بحث",
    autoAccept: "استقبال تلقائي للجميع",
    autoReject: "رفض تلقائي للجميع",
    autoAcceptSub: "الموافقة تلقائياً على جميع طلبات الانضمام",
    autoRejectSub: "رفض تلقائياً جميع طلبات الانضمام",
    confirmDelete: "هل أنت متأكد أنك تريد حذف هذه الغرفة؟",
    lobbySub: "سيقوم مالك الغرفة بمراجعة طلبك قريباً.",
    offline: "لا يوجد اتصال بالإنترنت",
    offlineSub: "يرجى التحقق من إعدادات الشبكة الخاصة بك.",
    adminDashboard: "لوحة التحكم",
    allUsers: "جميع المستخدمين",
    totalRooms: "إجمالي الغرف",
    noUsers: "لم يتم العثور على مستخدمين.",
    viewRooms: "عرض الغرف",
    backToProfile: "العودة للملف الشخصي",
    ban: "حظر المستخدم",
    unban: "إلغاء الحظر",
    changePassword: "تغيير كلمة المرور",
    remove: "إزالة",
  }
};

// Generate a random ID for the user
const USER_ID = Math.random().toString(36).substring(7);

export default function App() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('myroomer_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isJoined, setIsJoined] = useState(false);
  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [roomInput, setRoomInput] = useState('');
  const [roomTagInput, setRoomTagInput] = useState('');
  const [roomTag, setRoomTag] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Persistence
  useEffect(() => {
    if (user) {
      localStorage.setItem('myroomer_user', JSON.stringify(user));
    }
  }, [user]);

  // Online/Offline handling
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Top-level signaling for incoming calls
  const { 
    incomingCall, setIncomingCall, directCall 
  } = useWebRTC(roomId || 'lobby', user?.username || USER_ID, user?.username || '', user?.displayName || '', user?.avatar);

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

  if (!user) {
    return <LoginView onLogin={setUser} language="en" />;
  }

  if (isAdminOpen) {
    return <AdminDashboard onBack={() => setIsAdminOpen(false)} language={user.language} adminUsername={user.username} />;
  }

  if (isProfileOpen) {
    return (
      <ProfileView 
        user={user} 
        setUser={setUser}
        isOnline={isOnline}
        onSave={(updatedUser) => {
          setUser(updatedUser);
          setIsProfileOpen(false);
        }} 
        onBack={() => setIsProfileOpen(false)} 
        onOpenAdmin={() => {
          setIsProfileOpen(false);
          setIsAdminOpen(true);
        }}
      />
    );
  }

  if (isSearchOpen) {
    const t = TRANSLATIONS[user.language];
    return (
      <GlobalSearchView 
        user={user}
        onCall={(targetUsername) => {
          const id = `call-${user.username}-${Date.now()}`;
          setRoomId(id);
          setRoomTag(t.call);
          setIsJoined(true);
          directCall(targetUsername, id);
          setIsSearchOpen(false);
        }}
        onBack={() => setIsSearchOpen(false)}
        onJoinRoom={(id) => {
          setRoomId(id);
          setIsJoined(true);
          setIsSearchOpen(false);
        }}
      />
    );
  }

  if (!isJoined) {
    const t = TRANSLATIONS[user.language];
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 theme-bg-main relative">
        {/* Offline Banner */}
        <AnimatePresence>
          {!isOnline && (
            <motion.div 
              initial={{ y: -100 }}
              animate={{ y: 0 }}
              exit={{ y: -100 }}
              className="fixed top-0 left-0 right-0 z-[200] bg-red-600 text-white py-3 px-4 flex items-center justify-center gap-3 shadow-lg"
            >
              <ShieldAlert className="w-5 h-5 animate-pulse" />
              <div className="text-center">
                <div className="font-bold text-sm">{t.offline}</div>
                <div className="text-[10px] opacity-90">{t.offlineSub}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Incoming Call Modal */}
        <AnimatePresence>
          {incomingCall && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm theme-bg-panel border theme-border rounded-3xl p-8 text-center shadow-2xl">
                <div className="relative inline-block mb-6">
                  <img src={incomingCall.callerAvatar} alt={incomingCall.callerDisplayName} className="w-24 h-24 rounded-full border-4 border-indigo-600 mx-auto" />
                  <div className="absolute -bottom-2 -right-2 bg-emerald-500 p-2 rounded-full text-white animate-bounce"><Video className="w-5 h-5" /></div>
                </div>
                <h2 className="text-xl font-bold theme-text-main mb-2">{incomingCall.callerDisplayName}</h2>
                <p className="theme-text-sub mb-8">{t.incomingCall}</p>
                <div className="flex gap-4">
                  <button onClick={() => { setRoomId(incomingCall.roomId); setIsJoined(true); setIncomingCall(null); }} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3 rounded-2xl transition-all flex items-center justify-center gap-2">
                    <Video className="w-5 h-5" /> {t.accept}
                  </button>
                  <button onClick={() => setIncomingCall(null)} className="flex-1 bg-red-500 hover:bg-red-400 text-white font-bold py-3 rounded-2xl transition-all flex items-center justify-center gap-2">
                    <X className="w-5 h-5" /> {t.reject}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Profile Button */}
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
          className="w-full max-w-lg"
        >
          <div className="flex flex-col items-center mb-12">
            <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-indigo-500/20">
              <Video className="text-white w-10 h-10" />
            </div>
            <h1 className="text-4xl font-black tracking-tight theme-text-main mb-2">{t.myRoomer}</h1>
            <p className="theme-text-sub text-center max-w-sm">
              {t.homeSub}
            </p>
          </div>

          <div className="flex justify-center gap-4 mb-8">
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-2 px-6 py-3 theme-bg-panel border theme-border rounded-2xl theme-text-main hover:opacity-80 transition-all shadow-lg"
            >
              <Search className="w-5 h-5 text-indigo-500" />
              <span className="font-bold">{t.globalSearch}</span>
            </button>
          </div>

          <div className="theme-bg-panel backdrop-blur-md theme-border border p-8 rounded-3xl shadow-2xl space-y-6">
            <div className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  placeholder={t.enterRoomId}
                  className={`w-full theme-bg-main border theme-border rounded-2xl py-4 theme-text-main focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-lg font-bold ${user.language === 'ar' ? 'pr-12 pl-4' : 'pl-12 pr-4'}`}
                />
                <Hash className={`absolute ${user.language === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-5 h-5 theme-text-sub opacity-50`} />
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={roomTagInput}
                  onChange={(e) => setRoomTagInput(e.target.value)}
                  placeholder={t.enterRoomTag}
                  className={`w-full theme-bg-main border theme-border rounded-2xl py-3 theme-text-main focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-sm ${user.language === 'ar' ? 'pr-12 pl-4' : 'pl-12 pr-4'}`}
                />
                <Globe className={`absolute ${user.language === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-5 h-5 theme-text-sub opacity-50`} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => {
                  const id = roomInput.trim() || Math.random().toString(36).substring(7);
                  setRoomId(id);
                  setRoomTag(roomTagInput.trim() || t.room);
                  setUser({ ...user, ownedRooms: [...(user.ownedRooms || []), id] });
                  window.history.pushState({}, '', `?room=${id}`);
                  setIsJoined(true);
                }}
                className="flex flex-col items-center justify-center gap-2 p-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl transition-all shadow-lg shadow-indigo-500/20 group"
              >
                <Plus className="w-6 h-6 group-hover:scale-110 transition-transform" />
                <span className="font-bold text-sm">{t.createRoom}</span>
              </button>
              
              <button
                onClick={() => {
                  if (roomInput.trim()) {
                    setRoomId(roomInput.trim());
                    setRoomTag(roomTagInput.trim() || t.room);
                    window.history.pushState({}, '', `?room=${roomInput.trim()}`);
                    setIsJoined(true);
                  }
                }}
                disabled={!roomInput.trim()}
                className="flex flex-col items-center justify-center gap-2 p-6 theme-bg-panel hover:opacity-80 theme-border border theme-text-main rounded-2xl transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Users className="w-6 h-6 group-hover:scale-110 transition-transform" />
                <span className="font-bold text-sm">{t.joinRoom}</span>
              </button>
            </div>

            {roomId && (
              <div className="pt-4 theme-border border-t">
                <div className="flex items-center justify-between p-3 theme-bg-main rounded-xl theme-border border">
                  <span className="text-sm theme-text-main font-mono">{roomId}</span>
                  <button onClick={() => setIsJoined(true)} className="text-xs font-bold text-indigo-400 hover:text-indigo-300">{t.rejoin}</button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <RoomView 
      roomId={roomId!} 
      setRoomId={setRoomId}
      roomTag={roomTag}
      setRoomTag={setRoomTag}
      userId={USER_ID} 
      user={user}
      setUser={setUser}
      soundsEnabled={soundsEnabled}
      setSoundsEnabled={setSoundsEnabled}
      isOnline={isOnline}
      onLeave={() => setIsJoined(false)}
    />
  );
}

function AdminDashboard({ onBack, language, adminUsername }: { onBack: () => void, language: 'en' | 'ar', adminUsername: string }) {
  const [adminData, setAdminData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const t = TRANSLATIONS[language];

  const fetchData = () => {
    fetch('/api/admin/data')
      .then(res => res.json())
      .then(data => {
        setAdminData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleBan = async (username: string) => {
    const res = await fetch('/api/admin/toggle-ban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, adminUsername })
    });
    if (res.ok) {
      fetchData();
    }
  };

  return (
    <div className="min-h-screen theme-bg-main p-4 md:p-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
              <ArrowLeft className={`w-6 h-6 theme-text-main ${language === 'ar' ? 'rotate-180' : ''}`} />
            </button>
            <h1 className="text-2xl font-bold theme-text-main flex items-center gap-3">
              <ShieldAlert className="w-8 h-8 text-red-500" />
              {t.adminDashboard}
            </h1>
          </div>
          <div className="theme-bg-panel px-4 py-2 rounded-xl border theme-border">
            <span className="text-sm theme-text-sub">{t.allUsers}: {adminData.length}</span>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div className="grid gap-6">
            {adminData.length === 0 ? (
              <div className="text-center py-20 theme-text-sub">{t.noUsers}</div>
            ) : (
              adminData.map((user) => (
                <motion.div 
                  key={user.username}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`theme-bg-panel rounded-3xl p-6 border theme-border shadow-xl ${user.isBanned ? 'border-red-500/50 opacity-80' : ''}`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-indigo-600 overflow-hidden border-2 theme-border">
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white text-xl font-bold">
                            {user.displayName[0]?.toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold theme-text-main">{user.displayName}</h3>
                        <p className="text-sm theme-text-sub">@{user.username}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">{t.password}:</span>
                          <span className="text-xs theme-text-main font-mono bg-slate-800 px-2 py-0.5 rounded">{user.password}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => toggleBan(user.username)}
                        disabled={user.username === '1'}
                        className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${user.isBanned ? 'bg-emerald-500 hover:bg-emerald-400 text-white' : 'bg-red-500 hover:bg-red-400 text-white'} disabled:opacity-50`}
                      >
                        {user.isBanned ? t.unban : t.ban}
                      </button>
                      <div className="text-right">
                        <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">{t.totalRooms}</div>
                        <div className="text-2xl font-bold theme-text-main">{user.ownedRooms.length}</div>
                      </div>
                    </div>
                  </div>

                  {user.ownedRooms.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {user.ownedRooms.map((room: any) => (
                        <div key={room.id} className="flex items-center justify-between p-3 theme-bg-main rounded-xl border theme-border group/room">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <Hash className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                            <div className="truncate">
                              <div className="text-sm font-medium theme-text-main truncate">{room.tag}</div>
                              <div className="text-[10px] theme-text-sub truncate">{room.id}</div>
                            </div>
                          </div>
                          <button 
                            onClick={async () => {
                              if (!window.confirm(t.confirmDelete)) return;
                              const res = await fetch('/api/rooms/delete', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ roomId: room.id, username: user.username })
                              });
                              if (res.ok) {
                                setAdminData(prev => prev.map(u => u.username === user.username ? { ...u, ownedRooms: u.ownedRooms.filter((r: any) => r.id !== room.id) } : u));
                              }
                            }}
                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg opacity-0 group-hover/room:opacity-100 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function ProfileView({ user, setUser, isOnline, onSave, onBack, onOpenAdmin }: { user: User, setUser: (u: User) => void, isOnline: boolean, onSave: (u: User) => void, onBack: () => void, onOpenAdmin: () => void }) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [avatar, setAvatar] = useState(user.avatar);
  const [theme, setTheme] = useState(user.theme);
  const [language, setLanguage] = useState(user.language);
  const [password, setPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = TRANSLATIONS[user.language];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          displayName,
          avatar,
          theme,
          language,
          password: password || undefined
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onSave(data);
    } catch (err) {
      console.error("Failed to save profile:", err);
      // Fallback to local save if server fails
      onSave({ ...user, displayName, avatar, theme, language });
    } finally {
      setIsSaving(false);
    }
  };

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

          <div>
            <label className={`block text-xs font-semibold theme-text-sub uppercase mb-2 ${user.language === 'ar' ? 'mr-1' : 'ml-1'}`}>{t.changePassword}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-900/50 border theme-border rounded-xl px-4 py-3 theme-text-main focus:ring-2 focus:ring-indigo-500/50 outline-none"
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

          {/* Owned Rooms */}
          <div className="p-4 theme-bg-panel rounded-2xl border theme-border">
            <div className={`text-sm font-bold theme-text-main mb-3 ${user.language === 'ar' ? 'text-right' : 'text-left'}`}>{t.ownedRooms}</div>
            <div className="space-y-2">
              {user.ownedRooms && user.ownedRooms.length > 0 ? (
                Array.from(new Set(user.ownedRooms)).map(r => (
                  <div key={r} className="flex items-center justify-between p-3 theme-bg-main rounded-xl border theme-border">
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-indigo-500" />
                      <span className="text-sm theme-text-main font-medium">{r}</span>
                    </div>
                    <button 
                      onClick={async () => {
                        if (!window.confirm(t.confirmDelete)) return;
                        const res = await fetch('/api/rooms/delete', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ roomId: r, username: user.username })
                        });
                        if (res.ok) {
                          setUser({ ...user, ownedRooms: user.ownedRooms?.filter(id => id !== r) });
                        }
                      }} 
                      className="text-red-500 hover:text-red-400 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-xs theme-text-sub text-center py-2">{t.noOwnedRooms}</div>
              )}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleSave}
              disabled={isOnline === false || isSaving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
            >
              {isSaving ? '...' : t.saveChanges}
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('myroomer_user');
                window.location.reload();
              }}
              className="px-6 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-4 rounded-2xl transition-all flex items-center gap-2"
            >
              <LogOut className="w-5 h-5" />
              {t.logout}
            </button>
          </div>

          {/* Admin Button - Only for user 1 */}
          {user.username === '1' && (
            <button
              onClick={onOpenAdmin}
              className="w-full mt-4 p-4 theme-bg-panel border border-red-500/30 hover:border-red-500/60 rounded-2xl flex items-center justify-center gap-3 transition-all group"
            >
              <ShieldAlert className="w-5 h-5 text-red-500 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-bold text-red-500">{t.adminDashboard}</span>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function LoginView({ onLogin, language }: { onLogin: (u: User) => void, language: 'en' | 'ar' }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const t = TRANSLATIONS[language];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onLogin(data);
    } catch (err: any) {
      setError(err.message);
    }
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
          {error && <div className="p-3 bg-red-500/10 border border-red-500/50 text-red-500 text-xs rounded-xl text-center">{error}</div>}
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

function GlobalSearch({ onCall, language, onJoinRoom }: { onCall: (username: string) => void, language: 'en' | 'ar', onJoinRoom: (roomId: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [roomResults, setRoomResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const t = TRANSLATIONS[language];

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setRoomResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [userRes, roomRes] = await Promise.all([
          fetch(`/api/users/search?q=${query}`),
          fetch(`/api/rooms/search?q=${query}`)
        ]);
        const userData = await userRes.json();
        const roomData = await roomRes.json();
        setResults(userData);
        setRoomResults(roomData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="relative w-full max-w-md mx-auto mb-8">
      <div className="relative group">
        <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 theme-text-sub group-focus-within:text-indigo-500 transition-colors ${language === 'ar' ? 'right-4' : 'left-4'}`} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.globalSearch}
          className={`w-full theme-bg-panel border theme-border rounded-2xl py-3 theme-text-main focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all shadow-xl ${language === 'ar' ? 'pr-12 pl-4' : 'pl-12 pr-4'}`}
        />
        {loading && <div className={`absolute top-1/2 -translate-y-1/2 ${language === 'ar' ? 'left-4' : 'right-4'} animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600`}></div>}
      </div>
      <AnimatePresence>
        {(results.length > 0 || roomResults.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-full left-0 right-0 mt-2 theme-bg-panel border theme-border rounded-2xl shadow-2xl z-50 overflow-hidden max-h-96 overflow-y-auto"
          >
            {results.length > 0 && (
              <div className="px-4 py-2 text-[10px] font-bold theme-text-sub uppercase tracking-widest border-b theme-border bg-slate-900/50">{t.allUsers}</div>
            )}
            {results.map((u) => (
              <div key={u.username} className="flex items-center justify-between p-4 hover:bg-indigo-500/10 transition-colors border-b theme-border last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 overflow-hidden border theme-border">
                    {u.avatar ? <img src={u.avatar} alt={u.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <div className="w-full h-full flex items-center justify-center text-white text-sm font-bold">{u.displayName[0].toUpperCase()}</div>}
                  </div>
                  <div>
                    <div className="text-sm font-bold theme-text-main">{u.displayName}</div>
                    <div className="text-xs theme-text-sub">@{u.username}</div>
                  </div>
                </div>
                <button
                  onClick={() => { onCall(u.username); setQuery(''); }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-xl transition-all"
                >
                  <Video className="w-4 h-4" />
                </button>
              </div>
            ))}

            {roomResults.length > 0 && (
              <div className="px-4 py-2 text-[10px] font-bold theme-text-sub uppercase tracking-widest border-b theme-border bg-slate-900/50">{t.totalRooms}</div>
            )}
            {roomResults.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-4 hover:bg-emerald-500/10 transition-colors border-b theme-border last:border-0">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
                    <Hash className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-sm font-bold theme-text-main truncate">{r.tag || r.id}</div>
                    <div className="text-xs theme-text-sub truncate">@{r.owner}</div>
                  </div>
                </div>
                <button
                  onClick={() => { onJoinRoom(r.id); setQuery(''); }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                >
                  {t.joinRoom}
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RoomView({ 
  roomId, setRoomId, roomTag: initialRoomTag, setRoomTag: setAppRoomTag, userId, user, setUser, soundsEnabled, setSoundsEnabled, isOnline, onLeave 
}: { 
  roomId: string; 
  setRoomId: (id: string) => void;
  roomTag: string;
  setRoomTag: (tag: string) => void;
  userId: string; 
  user: User;
  setUser: (u: User) => void;
  soundsEnabled: boolean;
  setSoundsEnabled: (val: boolean) => void;
  isOnline: boolean;
  onLeave: () => void;
}) {
  const t = TRANSLATIONS[user.language];

  const { 
    peers, localStream, setLocalStream, toggleMedia, 
    startScreenShare, stopScreenShare, isScreenSharing,
    messages, sendChatMessage, isMutedAll, toggleMuteAll,
    sendMuteStatus, updateProfile, quality, changeQuality,
    broadcastQuality, setBroadcastQuality,
    lobbyRequests, isWaitingInLobby, isKicked, roomTag, updateRoomTag, incomingCall, isOwner,
    joinRoom, approveUser, rejectUser, kickUser, deleteRoom, setIncomingCall, updateRoomSettings
  } = useWebRTC(roomId, userId, user.username, user.displayName, user.avatar);

  useEffect(() => {
    if (roomTag) setAppRoomTag(roomTag);
  }, [roomTag]);
  
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
  const [isPreJoin, setIsPreJoin] = useState(true);
  const [preJoinMic, setPreJoinMic] = useState(true);
  const [preJoinCam, setPreJoinCam] = useState(true);
  const [autoAccept, setAutoAccept] = useState(false);
  const [autoReject, setAutoReject] = useState(false);

  // Fetch room settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(`/api/rooms/settings?roomId=${roomId}`);
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setAutoAccept(data.autoAccept || false);
            setAutoReject(data.autoReject || false);
          }
        }
      } catch (err) {
        console.error("Error fetching room settings:", err);
      }
    };
    fetchSettings();
  }, [roomId]);

  // Profile editing state
  const [tempDisplayName, setTempDisplayName] = useState(user.displayName);
  const [tempAvatar, setTempAvatar] = useState(user.avatar);

  const prevPeersCount = useRef(peers.size);
  const prevMessagesCount = useRef(messages.length);

  const isSpeaking = useAudioActivity(localStream, micOn);

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
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isPreJoin, isScreenSharing]);

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

  useEffect(() => {
    if (localStream && isPreJoin) {
      const audioTrack = localStream.getAudioTracks()[0];
      const videoTrack = localStream.getVideoTracks()[0];
      if (audioTrack) audioTrack.enabled = preJoinMic;
      if (videoTrack) videoTrack.enabled = preJoinCam;
      sendMuteStatus(!preJoinMic);
    }
  }, [preJoinMic, preJoinCam, localStream, isPreJoin]);

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

  const hasJoined = useRef(false);

  useEffect(() => {
    if (!isPreJoin && !hasJoined.current) {
      joinRoom(false, initialRoomTag);
      hasJoined.current = true;
    }
  }, [isPreJoin]);

  useEffect(() => {
    if (lobbyRequests.length > 0) {
      playSound(SOUNDS.JOIN);
    }
  }, [lobbyRequests.length]);

  if (isKicked) {
    return (
      <div className="min-h-screen flex items-center justify-center theme-bg-main p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold theme-text-main">You have been kicked</h1>
          <button onClick={() => window.location.href = '/'} className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-xl">Go Home</button>
        </div>
      </div>
    );
  }

  if (isWaitingInLobby) {
    return (
      <div className="min-h-screen flex items-center justify-center theme-bg-main p-4">
        <div className="text-center">
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Clock className="w-16 h-16 text-indigo-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold theme-text-main mb-2">{t.waitingApproval}</h2>
            <p className="theme-text-sub max-w-xs">{(t as any).lobbySub || "The room owner will review your request shortly."}</p>
            <button onClick={onLeave} className="mt-6 theme-text-sub hover:theme-text-main transition-colors border border-current px-4 py-2 rounded-xl">{t.leaveRoom}</button>
          </div>
        </div>
      </div>
    );
  }

  if (isPreJoin) {
    return (
      <div className="min-h-screen flex items-center justify-center theme-bg-main p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg theme-bg-panel border theme-border rounded-3xl p-8 shadow-2xl">
          <h1 className="text-2xl font-bold theme-text-main mb-6 text-center">{t.preJoin}</h1>
          <div className="aspect-video bg-slate-900 rounded-2xl mb-6 overflow-hidden relative border theme-border">
            <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            {!preJoinCam && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                <img src={user.avatar} alt={user.displayName} className="w-24 h-24 rounded-full border-4 border-indigo-600" />
              </div>
            )}
          </div>
          <div className="flex justify-center gap-4 mb-8">
            <button onClick={() => setPreJoinMic(!preJoinMic)} className={`p-4 rounded-2xl transition-all ${preJoinMic ? 'bg-indigo-600 text-white' : 'bg-red-500/20 text-red-500'}`}>
              {preJoinMic ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
            </button>
            <button onClick={() => setPreJoinCam(!preJoinCam)} className={`p-4 rounded-2xl transition-all ${preJoinCam ? 'bg-indigo-600 text-white' : 'bg-red-500/20 text-red-500'}`}>
              {preJoinCam ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
            </button>
          </div>
          <button onClick={() => { setIsPreJoin(false); setMicOn(preJoinMic); setCamOn(preJoinCam); }} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-indigo-500/20">
            {t.joinNow}
          </button>
        </motion.div>
      </div>
    );
  }

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
      {/* Offline Banner */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div 
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            exit={{ y: -100 }}
            className="fixed top-0 left-0 right-0 z-[200] bg-red-600 text-white py-3 px-4 flex items-center justify-center gap-3 shadow-lg"
          >
            <ShieldAlert className="w-5 h-5 animate-pulse" />
            <div className="text-center">
              <div className="font-bold text-sm">{t.offline}</div>
              <div className="text-[10px] opacity-90">{t.offlineSub}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lobby Requests (Owner only) */}
      <AnimatePresence>
        {isOwner && lobbyRequests.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, x: 50 }} 
            animate={{ opacity: 1, x: 0 }} 
            exit={{ opacity: 0, x: 50 }} 
            className={`fixed top-20 right-4 z-50 w-80 space-y-2`}
          >
            {lobbyRequests.map(req => (
              <div key={req.userId} className="theme-bg-panel border theme-border p-4 rounded-2xl shadow-2xl flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center overflow-hidden">
                    {req.avatar ? (
                      <img src={req.avatar} alt={req.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-xs font-bold text-slate-400">{req.displayName[0].toUpperCase()}</span>
                    )}
                  </div>
                  <div className="text-sm font-bold theme-text-main">{req.displayName}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approveUser(req.userId)} className="p-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg transition-colors"><Check className="w-4 h-4" /></button>
                  <button onClick={() => rejectUser(req.userId)} className="p-2 bg-red-500 hover:bg-red-400 text-white rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Incoming Call Modal */}
      <AnimatePresence>
        {incomingCall && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm theme-bg-panel border theme-border rounded-3xl p-8 text-center shadow-2xl">
              <div className="relative inline-block mb-6">
                <img src={incomingCall.callerAvatar} alt={incomingCall.callerDisplayName} className="w-24 h-24 rounded-full border-4 border-indigo-600 mx-auto" />
                <div className="absolute -bottom-2 -right-2 bg-emerald-500 p-2 rounded-full text-white animate-bounce"><Video className="w-5 h-5" /></div>
              </div>
              <h2 className="text-xl font-bold theme-text-main mb-2">{incomingCall.callerDisplayName}</h2>
              <p className="theme-text-sub mb-8">{t.incomingCall}</p>
              <div className="flex gap-4">
                <button onClick={() => { setRoomId(incomingCall.roomId); setIncomingCall(null); }} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3 rounded-2xl transition-all flex items-center justify-center gap-2">
                  <Video className="w-5 h-5" /> {t.accept}
                </button>
                <button onClick={() => setIncomingCall(null)} className="flex-1 bg-red-500 hover:bg-red-400 text-white font-bold py-3 rounded-2xl transition-all flex items-center justify-center gap-2">
                  <X className="w-5 h-5" /> {t.reject}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="h-16 border-b theme-border flex items-center justify-between px-6 theme-bg-panel backdrop-blur-md z-10 shrink-0 relative">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Video className="text-white w-5 h-5" />
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-2">
              <span className="text-[10px] theme-text-sub uppercase tracking-widest font-bold opacity-60">{t.myRoomer} • {roomId}</span>
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

        {/* Centered Room Name Badge */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/40 rounded-2xl flex items-center gap-2 shadow-[0_0_15px_rgba(99,102,241,0.1)] backdrop-blur-sm"
          >
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <h2 className="text-sm font-black theme-text-main leading-none tracking-tight whitespace-nowrap">
              {roomTag || roomId}
            </h2>
          </motion.div>
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
              {isOwner && lobbyRequests.length > 0 && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[8px] font-bold text-white border border-white/20 animate-bounce">
                  {lobbyRequests.length}
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
                  className={`absolute top-12 right-0 w-64 theme-bg-panel border theme-border rounded-2xl shadow-2xl p-4 z-50`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold theme-text-sub uppercase tracking-widest">{t.participants} ({peers.size + 1})</h3>
                    <button onClick={() => setIsParticipantsOpen(false)}><X className="w-3 h-3 theme-text-sub" /></button>
                  </div>
                  <div className={`space-y-3 max-h-80 overflow-y-auto ${user.language === 'ar' ? 'pl-2' : 'pr-2'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white overflow-hidden">
                        {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : user.displayName[0].toUpperCase()}
                      </div>
                      <span className="text-sm theme-text-main font-medium">{user.displayName} ({t.you})</span>
                    </div>
                    {Array.from(peers.values()).map((peer: Peer) => (
                      <div key={peer.userId} className="flex items-center justify-between group">
                        <button 
                          onClick={() => setViewingProfile(peer)}
                          className="flex items-center gap-3 p-1 hover:opacity-80 rounded-lg transition-colors text-left flex-1"
                        >
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 overflow-hidden">
                            {peer.avatar ? <img src={peer.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : peer.displayName[0].toUpperCase()}
                          </div>
                          <span className="text-sm theme-text-sub">{peer.displayName}</span>
                        </button>
                        {isOwner && (
                          <button 
                            onClick={() => kickUser(peer.userId)}
                            className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                            title={t.remove}
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
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
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setViewingProfile(null)}
                          className="flex-1 bg-slate-800 hover:bg-slate-700 theme-text-main font-bold py-4 rounded-2xl transition-all"
                        >
                          {t.closeProfile}
                        </button>
                        {isOwner && viewingProfile.username !== user.username && (
                          <button 
                            onClick={() => { kickUser((viewingProfile as any).userId); setViewingProfile(null); }}
                            className="flex-1 bg-red-500 hover:bg-red-400 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
                          >
                            <UserMinus className="w-5 h-5" />
                            {t.remove}
                          </button>
                        )}
                      </div>
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
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded-full bg-slate-700/50 border border-white/10 overflow-hidden">
                          {msg.avatar ? (
                            <img src={msg.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-slate-400">
                              {msg.displayName[0].toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="text-[10px] font-bold text-indigo-400/90">{msg.displayName}</div>
                      </div>
                    )}
                    <div className="leading-relaxed break-words">{msg.text}</div>
                    <div className={`text-[9px] mt-1.5 font-medium ${msg.senderId === userId ? 'text-right opacity-60' : 'text-left opacity-40'}`}>
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
                {isOwner && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold theme-text-sub uppercase tracking-widest">{t.roomTag}</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={initialRoomTag} 
                        onChange={(e) => setAppRoomTag(e.target.value)}
                        className="flex-1 theme-bg-main border theme-border rounded-xl px-4 py-2 theme-text-main outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                      <button 
                        onClick={() => updateRoomTag(initialRoomTag)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-xs"
                      >
                        {t.saveChanges}
                      </button>
                    </div>
                  </div>
                )}

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

                {isOwner && (
                  <div className="space-y-4 pt-4 border-t theme-border">
                    <div className="flex items-center justify-between">
                      <div className={`${user.language === 'ar' ? 'text-right' : 'text-left'}`}>
                        <div className="text-sm font-semibold theme-text-main">{t.autoAccept}</div>
                        <div className="text-xs theme-text-sub">{t.autoAcceptSub}</div>
                      </div>
                      <button 
                        onClick={() => {
                          const newVal = !autoAccept;
                          setAutoAccept(newVal);
                          if (newVal) setAutoReject(false);
                          updateRoomSettings(newVal, newVal ? false : autoReject);
                          fetch('/api/rooms/settings', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ roomId, username: user.username, settings: { autoAccept: newVal, autoReject: newVal ? false : autoReject } })
                          });
                        }}
                        className={`w-12 h-6 rounded-full transition-all relative ${autoAccept ? 'bg-indigo-600' : 'bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${autoAccept ? (user.language === 'ar' ? 'left-1' : 'right-1') : (user.language === 'ar' ? 'right-1' : 'left-1')}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className={`${user.language === 'ar' ? 'text-right' : 'text-left'}`}>
                        <div className="text-sm font-semibold theme-text-main">{t.autoReject}</div>
                        <div className="text-xs theme-text-sub">{t.autoRejectSub}</div>
                      </div>
                      <button 
                        onClick={() => {
                          const newVal = !autoReject;
                          setAutoReject(newVal);
                          if (newVal) setAutoAccept(false);
                          updateRoomSettings(newVal ? false : autoAccept, newVal);
                          fetch('/api/rooms/settings', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ roomId, username: user.username, settings: { autoAccept: newVal ? false : autoAccept, autoReject: newVal } })
                          });
                        }}
                        className={`w-12 h-6 rounded-full transition-all relative ${autoReject ? 'bg-indigo-600' : 'bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${autoReject ? (user.language === 'ar' ? 'left-1' : 'right-1') : (user.language === 'ar' ? 'right-1' : 'left-1')}`} />
                      </button>
                    </div>
                  </div>
                )}

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

                <div className="flex items-center justify-between">
                  <div className={`${user.language === 'ar' ? 'text-right' : 'text-left'}`}>
                    <div className="text-sm font-semibold theme-text-main">{t.broadcastQuality}</div>
                    <div className="text-xs theme-text-sub">{t.broadcastQualitySub}</div>
                  </div>
                  <button 
                    onClick={() => setBroadcastQuality(!broadcastQuality)}
                    className={`p-3 rounded-xl transition-all ${broadcastQuality ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                  >
                    <Globe className="w-5 h-5" />
                  </button>
                </div>

                <div className="pt-6 theme-border border-t">
                  <div className={`${user.language === 'ar' ? 'text-right' : 'text-left'} mb-4`}>
                    <div className="text-sm font-semibold theme-text-main">{t.quality}</div>
                    <div className="text-xs theme-text-sub">{t.qualitySub}</div>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {(['1080', '720', '480', '360', '240'] as const).map((level) => (
                      <button
                        key={level}
                        onClick={() => changeQuality(level)}
                        className={`py-2 rounded-lg text-xs font-bold transition-all ${
                          quality === level 
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {level}p
                      </button>
                    ))}
                  </div>
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

function GlobalSearchView({ user, onCall, onBack, onJoinRoom }: { user: User, onCall: (u: string) => void, onBack: () => void, onJoinRoom: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [roomResults, setRoomResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const t = TRANSLATIONS[user.language];

  const handleSearch = async () => {
    if (query.length < 1) return;
    setLoading(true);
    try {
      const [userRes, roomRes] = await Promise.all([
        fetch(`/api/users/search?q=${encodeURIComponent(query)}`),
        fetch(`/api/rooms/search?q=${encodeURIComponent(query)}`)
      ]);
      const userData = await userRes.json();
      const roomData = await roomRes.json();
      setResults(userData);
      setRoomResults(roomData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-0 md:p-4 theme-bg-main">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl theme-bg-panel backdrop-blur-md theme-border border rounded-none md:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-screen md:h-[80vh]"
      >
        <div className="p-4 md:p-6 border-b theme-border flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:opacity-80 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 theme-text-main" />
            </button>
            <h1 className="text-xl font-bold theme-text-main">{t.globalSearch}</h1>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 theme-text-sub opacity-50" />
              <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={t.searchUser}
                className="w-full theme-bg-main border theme-border rounded-md pl-10 pr-4 py-2 theme-text-main outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
            <button 
              onClick={handleSearch}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-md font-bold text-sm transition-all shadow-lg shadow-indigo-500/20"
            >
              {t.search}
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Results List */}
          <div className="w-full md:w-1/2 border-b md:border-b-0 md:border-r theme-border overflow-y-auto p-4 space-y-4">
            {results.length > 0 && (
              <div className="space-y-2">
                <div className="px-3 py-1 text-[10px] font-bold theme-text-sub uppercase tracking-widest">{t.allUsers}</div>
                {results.map((u: any) => (
                  <button 
                    key={u.username}
                    onClick={() => setSelectedUser(u)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${selectedUser?.username === u.username ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'hover:bg-white/5 theme-text-main'}`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center overflow-hidden">
                      {u.avatar ? (
                        <img src={u.avatar} alt={u.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="text-xs font-bold text-slate-400">{u.displayName[0].toUpperCase()}</span>
                      )}
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-sm">{u.displayName}</div>
                      <div className={`text-xs ${selectedUser?.username === u.username ? 'text-white/70' : 'theme-text-sub'}`}>@{u.username}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {roomResults.length > 0 && (
              <div className="space-y-2">
                <div className="px-3 py-1 text-[10px] font-bold theme-text-sub uppercase tracking-widest">{t.totalRooms}</div>
                {roomResults.map((r: any) => (
                  <div 
                    key={r.id}
                    className="w-full flex items-center justify-between gap-3 p-3 rounded-2xl transition-all hover:bg-white/5 theme-text-main border theme-border"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
                        <Hash className="w-5 h-5 text-indigo-500" />
                      </div>
                      <div className="overflow-hidden text-left">
                        <div className="text-sm font-bold truncate">{r.tag || r.id}</div>
                        <div className="text-[10px] opacity-70 truncate">@{r.owner}</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => onJoinRoom(r.id)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-xl text-xs font-bold transition-all"
                    >
                      {t.joinRoom}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {results.length === 0 && roomResults.length === 0 && query.length >= 1 && !loading && (
              <div className="text-center py-12 theme-text-sub opacity-50">No results found</div>
            )}
            {query.length === 0 && (
              <div className="text-center py-12 theme-text-sub opacity-50">Type to search users or rooms...</div>
            )}
          </div>

          {/* User Details */}
          <div className="w-full md:w-1/2 p-8 flex flex-col items-center justify-center text-center bg-black/5">
            {selectedUser ? (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} key={selectedUser.username} className="w-full">
                <div className="relative inline-block mb-6">
                  <div className="w-32 h-32 rounded-3xl border-4 border-indigo-600 shadow-2xl mx-auto overflow-hidden bg-slate-800 flex items-center justify-center">
                    {selectedUser.avatar ? (
                      <img src={selectedUser.avatar} alt={selectedUser.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-4xl font-bold text-slate-400">{selectedUser.displayName[0].toUpperCase()}</span>
                    )}
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-emerald-500 w-6 h-6 rounded-full border-4 theme-bg-panel" />
                </div>
                <h2 className="text-2xl font-bold theme-text-main mb-1">{selectedUser.displayName}</h2>
                <p className="theme-text-sub mb-8">@{selectedUser.username}</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => onCall(selectedUser.username)}
                    className="flex flex-col items-center justify-center gap-2 p-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl transition-all shadow-lg shadow-indigo-500/20 group"
                  >
                    <Video className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-xs">{t.call}</span>
                  </button>
                  <button 
                    className="flex flex-col items-center justify-center gap-2 p-4 theme-bg-main hover:opacity-80 border theme-border theme-text-main rounded-2xl transition-all group"
                  >
                    <MessageSquare className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-xs">{t.message}</span>
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="text-center theme-text-sub opacity-30">
                <UserIcon className="w-16 h-16 mx-auto mb-4" />
                <p>{t.userInfo}</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
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
