import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Video, VideoOff, Mic, MicOff, Monitor, MonitorOff, 
  LogOut, Users, Settings, MessageSquare, Plus, Globe,
  Copy, Check, Clock, ShieldAlert, X, Send, SendHorizontal, Volume2, VolumeX, Bell, BellOff, Link, Share2,
  Sun, Moon, Upload, ArrowLeft, User as UserIcon, ShieldCheck, FileText, Image as ImageIcon, ExternalLink,
  Maximize2, Minimize2, Search, Phone, UserMinus, CheckCircle2, Trash2,
  ChevronLeft, PhoneOff, Circle, Paperclip, LayoutGrid, Calendar
} from 'lucide-react';
import { useWebRTC, Peer, ChatMessage } from './hooks/useWebRTC';
import { useAudioActivity } from './hooks/useAudioActivity';

// Sound effect URLs
const SOUNDS = {
  JOIN: 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3',
  LEAVE: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3',
  MESSAGE: 'https://assets.mixkit.co/active_storage/sfx/2357/2357-preview.mp3' // Short "dn" sound
};

interface RoomMeta {
  id: string;
  tag: string;
}

interface User {
  username: string;
  displayName: string;
  avatar: string;
  theme: 'light' | 'dark';
  language: 'en' | 'ar';
  ownedRooms?: RoomMeta[];
  blockedUsers?: string[];
}

const TRANSLATIONS = {
  en: {
    room: "Room",
    myRoomer: "MyRoomer",
    connected: "Connected",
    copyLink: "Copy Room Link",
    copyRoomId: "Copy Room ID",
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
    joinWithoutMedia: "Join without Camera/Mic",
    waitingApproval: "Waiting for owner approval...",
    lobby: "Lobby",
    approve: "Approve",
    reject: "Reject",
    approveAll: "Approve All",
    rejectAll: "Reject All",
    kick: "Kick",
    deleteRoom: "Delete Room",
    ownedRooms: "My Rooms",
    noOwnedRooms: "You haven't created any rooms yet.",
    incomingCall: "Incoming Call",
    accept: "Accept",
    block: "Block",
    unblock: "Unblock",
    blocked: "Blocked",
    notifications: "Notifications",
    notificationsSub: "Get notified of incoming calls",
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
    roomExists: "Room already exists and is owned by someone else.",
    roomNotFound: "Room not found. Please create it first.",
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
    installApp: "Install",
    installAppSub: "Install MyRoomer on your device",
    permitSpeak: "Permit Speak",
    muteUser: "Mute User",
    muteEveryone: "Mute Everyone",
    screenShareError: "Screen sharing error",
    screenShareNotSupported: "Screen sharing is restricted in this preview. Please use the 'Open in New Tab' button to enable screen sharing.",
    screenShareDenied: "Screen sharing permission denied.",
    openInNewTab: "Open in New Tab",
    record: "Record Meeting",
    stopVideo: "Stop Video",
    startVideo: "Start Video",
    mute: "Mute",
    unmute: "Unmute",
    leave: "Leave",
    share: "Share Screen",
    stopShare: "Stop Sharing"
  },
  ar: {
    room: "الغرفة",
    myRoomer: "MyRoomer",
    connected: "متصل",
    copyLink: "نسخ رابط الغرفة",
    copyRoomId: "نسخ معرف الغرفة",
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
    joinWithoutMedia: "انضم بدون كاميرا/مايك",
    waitingApproval: "في انتظار موافقة المالك...",
    lobby: "غرفة الانتظار",
    approve: "قبول",
    reject: "رفض",
    approveAll: "قبول الكل",
    rejectAll: "رفض الكل",
    kick: "إزالة",
    deleteRoom: "حذف الغرفة",
    ownedRooms: "غرفي",
    noOwnedRooms: "لم تقم بإنشاء أي غرف بعد.",
    incomingCall: "مكالمة واردة",
    accept: "قبول",
    block: "حظر",
    unblock: "إلغاء الحظر",
    blocked: "محظور",
    notifications: "الإشعارات",
    notificationsSub: "تلقي إشعارات عند ورود مكالمات",
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
    roomExists: "الغرفة موجودة بالفعل ومملوكة لشخص آخر.",
    roomNotFound: "الغرفة غير موجودة. يرجى إنشاؤها أولاً.",
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
    installApp: "تثبيت",
    installAppSub: "تثبيت MyRoomer على جهازك",
    permitSpeak: "فتح المايك",
    muteUser: "إسكات",
    muteEveryone: "إسكات الجميع",
    screenShareError: "خطأ في مشاركة الشاشة",
    screenShareNotSupported: "مشاركة الشاشة مقيدة في هذه النافذة. يرجى استخدام زر 'الفتح في نافذة جديدة' لتمكين مشاركة الشاشة.",
    screenShareDenied: "تم رفض إذن مشاركة الشاشة.",
    openInNewTab: "فتح في نافذة جديدة",
    record: "تسجيل الاجتماع",
    stopVideo: "إيقاف الكاميرا",
    startVideo: "تشغيل الكاميرا",
    mute: "كتم الصوت",
    unmute: "إلغاء الكتم",
    leave: "مغادرة",
    share: "مشاركة الشاشة",
    stopShare: "إيقاف المشاركة"
  }
};

// Generate a random ID for the user
const USER_ID = Math.random().toString(36).substring(7);

export default function App() {
  const [roomId, setRoomId] = useState<string | null>(null);

  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('myroomer_user');
    if (!saved) return null;
    try {
      const parsed = JSON.parse(saved);
      // Migration: ownedRooms strings to objects
      if (parsed.ownedRooms && parsed.ownedRooms.length > 0 && typeof parsed.ownedRooms[0] === 'string') {
        parsed.ownedRooms = parsed.ownedRooms.map((room: string) => ({ id: room, tag: room }));
      }
      // Ensure unique ownedRooms by id
      if (parsed.ownedRooms) {
        const seen = new Set();
        parsed.ownedRooms = parsed.ownedRooms.filter((rm: any) => {
          if (!rm || typeof rm !== 'object' || !rm.id) return false;
          if (seen.has(rm.id)) return false;
          seen.add(rm.id);
          return true;
        });
      }
      return parsed;
    } catch (e) {
      console.error("Failed to parse user from localStorage", e);
      return null;
    }
  });
  const [isJoined, setIsJoined] = useState(false);
  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(Notification.permission === 'granted');

  const requestNotificationPermission = async () => {
    const permission = await Notification.requestPermission();
    setIsNotificationsEnabled(permission === 'granted');
  };

  const showNotification = (title: string, body: string, icon?: string) => {
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon });
    }
  };

  const handleBlockUser = async (targetUsername: string) => {
    if (!user) return;
    try {
      const res = await fetch('/api/users/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username, targetUsername })
      });
      if (res.ok) {
        const updatedUser = await res.json();
        setUser(updatedUser);
      }
    } catch (err) {
      console.error("Failed to block user:", err);
    }
  };

  const handleUnblockUser = async (targetUsername: string) => {
    if (!user) return;
    try {
      const res = await fetch('/api/users/unblock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username, targetUsername })
      });
      if (res.ok) {
        const updatedUser = await res.json();
        setUser(updatedUser);
      }
    } catch (err) {
      console.error("Failed to unblock user:", err);
    }
  };
  const [roomInput, setRoomInput] = useState('');
  const [roomTagInput, setRoomTagInput] = useState('');
  const [roomTag, setRoomTag] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // PWA Install Prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

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

  // Top-level signaling for incoming calls (only when user logged in to avoid multiple connections)
  const { 
    incomingCall, setIncomingCall, directCall 
  } = useWebRTC((user && !isJoined) ? 'lobby' : '', user?.username || '', user?.username || '', user?.displayName || '', user?.avatar);

  useEffect(() => {
    if (incomingCall) {
      const t = TRANSLATIONS[user?.language || 'en'];
      showNotification(t.incomingCall, `${incomingCall.callerDisplayName} ${t.call}`, incomingCall.callerAvatar);
    }
  }, [incomingCall]);

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
    console.log('URL params room:', id);
    if (id) {
      console.log('Setting roomId from URL:', id);
      setRoomId(id.toLowerCase());
    }
  }, []);

  if (!user) {
    return <LoginView onLogin={setUser} language="en" deferredPrompt={deferredPrompt} onInstall={handleInstallClick} />;
  }

  const t = TRANSLATIONS[user.language];

  return (
    <div className="relative min-h-screen theme-bg-main overflow-x-hidden">
      <AnimatePresence>
        {isAdminOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-[200] overflow-y-auto"
          >
            <AdminDashboard onBack={() => setIsAdminOpen(false)} language={user.language} adminUsername={user.username} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isProfileOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 z-[150] overflow-y-auto"
          >
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
              deferredPrompt={deferredPrompt}
              onInstall={handleInstallClick}
              isNotificationsEnabled={isNotificationsEnabled}
              onRequestNotifications={requestNotificationPermission}
              onUnblock={handleUnblockUser}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ opacity: 0, x: user.language === 'ar' ? '-100%' : '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: user.language === 'ar' ? '-100%' : '100%' }}
            className="fixed inset-0 z-[140] overflow-y-auto"
          >
            <GlobalSearchView 
              user={user}
              onBack={() => setIsSearchOpen(false)}
              onCall={(targetId) => {
                const t = TRANSLATIONS[user.language];
                const id = `call-${user.username}-${Date.now()}`.toLowerCase();
                setRoomId(id);
                setRoomTag(t.call);
                setIsJoined(true);
                directCall(targetId, id);
                setIsSearchOpen(false);
              }}
              onJoinRoom={(id) => {
                setRoomId(id.toLowerCase());
                setIsJoined(true);
                setIsSearchOpen(false);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {!isJoined ? (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 relative">
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
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }} 
                className="w-full max-w-md theme-bg-panel border theme-border rounded-[40px] p-10 text-center shadow-[0_0_50px_rgba(79,70,229,0.3)] relative overflow-hidden"
              >
                {/* Animated background pulse */}
                <div className="absolute inset-0 bg-gradient-to-b from-indigo-600/10 to-transparent pointer-events-none" />
                
                <div className="relative inline-block mb-8">
                  <div className="absolute inset-0 bg-indigo-500 rounded-full animate-ping opacity-20 scale-150" />
                  <img src={incomingCall.callerAvatar} alt={incomingCall.callerDisplayName} className="w-32 h-32 rounded-full border-4 border-indigo-600 mx-auto relative z-10 shadow-2xl" />
                  <div className="absolute -bottom-2 -right-2 bg-emerald-500 p-3 rounded-full text-white animate-bounce shadow-lg z-20">
                    <Phone className="w-6 h-6" />
                  </div>
                </div>

                <h2 className="text-3xl font-black theme-text-main mb-2 tracking-tight">{incomingCall.callerDisplayName}</h2>
                <p className="theme-text-sub text-lg mb-10 opacity-70 font-medium">{t.incomingCall}</p>

                <div className="grid grid-cols-1 gap-4">
                  <button 
                    onClick={() => { setRoomId(incomingCall.roomId.toLowerCase()); setIsJoined(true); setIncomingCall(null); }} 
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-black py-5 rounded-3xl transition-all flex items-center justify-center gap-3 text-lg shadow-xl shadow-emerald-500/20 group"
                  >
                    <Video className="w-6 h-6 group-hover:scale-110 transition-transform" /> {t.accept}
                  </button>
                  
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setIncomingCall(null)} 
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-3xl transition-all flex items-center justify-center gap-2"
                    >
                      <X className="w-5 h-5" /> {t.reject}
                    </button>
                    
                    <button 
                      onClick={() => {
                        handleBlockUser(incomingCall.callerId);
                        setIncomingCall(null);
                      }} 
                      className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold py-4 rounded-3xl transition-all flex items-center justify-center gap-2 border border-red-500/30"
                    >
                      <UserMinus className="w-5 h-5" /> {t.block}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Profile Button */}
        <div className={`fixed top-6 ${user.language === 'ar' ? 'right-6' : 'left-6'} z-50`}>
          <button 
            onClick={() => setIsProfileOpen(true)}
            className="flex items-center gap-3 p-1.5 pr-4 theme-bg-panel hover:scale-105 active:scale-95 theme-border border rounded-full transition-all group shadow-xl backdrop-blur-xl"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center overflow-hidden border-2 border-white/20 shadow-inner">
              {user.avatar ? (
                <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-white font-bold text-sm">{user.displayName[0].toUpperCase()}</span>
              )}
            </div>
            <div className={`${user.language === 'ar' ? 'text-right' : 'text-left'}`}>
              <div className="text-xs font-bold theme-text-main group-hover:text-indigo-400 transition-colors leading-none mb-0.5">{user.displayName}</div>
              <div className="text-[10px] theme-text-sub opacity-70 leading-none">@{user.username}</div>
            </div>
          </button>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-xl"
        >
          <div className="flex flex-col items-center mb-16">
            <motion.div 
              animate={{ 
                rotate: [0, 5, -5, 0],
                scale: [1, 1.05, 0.95, 1]
              }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
              className="w-24 h-24 bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-500 rounded-[2rem] flex items-center justify-center mb-8 shadow-[0_20px_50px_rgba(79,70,229,0.4)] border border-white/20 relative"
            >
              <div className="absolute inset-0 bg-white/20 rounded-[2rem] blur-xl animate-pulse" />
              <Video className="text-white w-12 h-12 drop-shadow-2xl relative z-10" />
            </motion.div>
            <h1 className="text-7xl font-black tracking-tighter theme-text-main mb-4 text-gradient">
              {t.myRoomer}
            </h1>
            <p className="theme-text-sub text-center max-w-sm text-base leading-relaxed opacity-80 font-medium">
              {t.homeSub}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-10">
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center justify-center gap-3 px-8 py-4 theme-bg-panel border theme-border rounded-3xl theme-text-main hover:scale-105 active:scale-95 transition-all shadow-2xl group min-w-[200px]"
            >
              <div className="p-2 bg-indigo-500/10 rounded-xl group-hover:bg-indigo-500/20 transition-colors">
                <Search className="w-5 h-5 text-indigo-500" />
              </div>
              <span className="font-black text-lg">{t.globalSearch}</span>
            </button>

            {deferredPrompt && (
              <button 
                onClick={handleInstallClick}
                className="flex items-center justify-center gap-2 px-6 py-4 theme-text-sub hover:theme-text-main transition-all text-sm font-bold group"
              >
                <div className="p-2 bg-white/5 rounded-xl group-hover:bg-white/10 transition-colors">
                  <Plus className="w-4 h-4" />
                </div>
                {t.installApp}
              </button>
            )}
          </div>

          <div className="theme-bg-panel backdrop-blur-2xl theme-border border p-10 rounded-[3rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] space-y-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />
            
            <div className="space-y-6">
              <div className="relative group">
                <div className={`absolute ${user.language === 'ar' ? 'right-5' : 'left-5'} top-1/2 -translate-y-1/2 p-2 bg-theme-accent/10 rounded-xl group-focus-within:bg-theme-accent/20 transition-all`}>
                  <Globe className="w-5 h-5 text-theme-accent" />
                </div>
                <input
                  type="text"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  placeholder={t.enterRoomId}
                  className={`w-full theme-bg-main border theme-border rounded-3xl py-5 theme-text-main focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all text-xl font-black ${user.language === 'ar' ? 'pr-16 pl-6' : 'pl-16 pr-6'} shadow-inner`}
                />
              </div>

              <div className="relative group">
                <div className={`absolute ${user.language === 'ar' ? 'right-5' : 'left-5'} top-1/2 -translate-y-1/2 p-2 bg-purple-500/10 rounded-xl group-focus-within:bg-purple-500/20 transition-all`}>
                  <Globe className="w-5 h-5 text-purple-500" />
                </div>
                <input
                  type="text"
                  value={roomTagInput}
                  onChange={(e) => setRoomTagInput(e.target.value)}
                  placeholder={t.enterRoomTag}
                  className={`w-full theme-bg-main border theme-border rounded-3xl py-4 theme-text-main focus:ring-4 focus:ring-purple-500/20 outline-none transition-all text-base font-bold ${user.language === 'ar' ? 'pr-16 pl-6' : 'pl-16 pr-6'} shadow-inner`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={async () => {
                  const id = (roomInput.trim() || Math.random().toString(36).substring(7)).toLowerCase();
                  const tag = roomTagInput.trim() || t.room;
                  
                  try {
                    const res = await fetch('/api/rooms/create', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ roomId: id, username: user.username, roomTag: tag })
                    });
                    
                    if (!res.ok) {
                      const data = await res.json();
                      alert(data.error || t.roomExists);
                      return;
                    }
                    
                    setRoomId(id.toLowerCase());
                    setRoomTag(tag);
                    setUser({ ...user, ownedRooms: [...(user.ownedRooms || []), { id: id.toLowerCase(), tag }] });
                    window.history.pushState({}, '', `?room=${id.toLowerCase()}`);
                    setIsJoined(true);
                  } catch (err) {
                    console.error(err);
                  }
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-black py-5 rounded-[2rem] transition-all shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:-translate-y-1 active:translate-y-0 text-lg flex items-center justify-center gap-3 group"
              >
                <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500" />
                {t.createRoom}
              </button>
              
              <button
                onClick={async () => {
                  const id = roomInput.trim().toLowerCase();
                  if (id) {
                    try {
                      const res = await fetch(`/api/rooms/exists?roomId=${id}`);
                      const data = await res.json();
                      if (!data.exists) {
                        alert(t.roomNotFound);
                        return;
                      }
                      setRoomId(id.toLowerCase());
                      setRoomTag(roomTagInput.trim() || t.room);
                      window.history.pushState({}, '', `?room=${id.toLowerCase()}`);
                      setIsJoined(true);
                    } catch (err) {
                      console.error(err);
                    }
                  }
                }}
                disabled={!roomInput.trim()}
                className="bg-white/5 hover:bg-white/10 theme-text-main font-black py-5 rounded-[2rem] transition-all border theme-border hover:border-indigo-500/50 text-lg flex items-center justify-center gap-3 hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                <Globe className="w-6 h-6 text-indigo-500" />
                {t.joinRoom}
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

          {deferredPrompt && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-12 text-center"
            >
              <button 
                onClick={handleInstallClick}
                className="inline-flex items-center gap-2 theme-text-sub hover:theme-text-main transition-colors text-sm font-medium underline underline-offset-4 decoration-indigo-500/30"
              >
                {t.installApp}
              </button>
            </motion.div>
          )}
        </motion.div>
      </div>
      ) : (
        <RoomView 
          roomId={roomId!} 
          setRoomId={setRoomId}
          roomTag={roomTag}
          setRoomTag={setRoomTag}
          userId={user.username} 
          user={user}
          setUser={setUser}
          soundsEnabled={soundsEnabled}
          setSoundsEnabled={setSoundsEnabled}
          isOnline={isOnline}
          onLeave={() => setIsJoined(false)}
          deferredPrompt={deferredPrompt}
          onInstall={handleInstallClick}
          setIsProfileOpen={setIsProfileOpen}
          setIsSearchOpen={setIsSearchOpen}
        />
      )}
    </div>
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
                      {user.ownedRooms.map((room: any, idx: number) => (
                        <div key={`${room.id}-${idx}`} className="flex items-center justify-between p-3 theme-bg-main rounded-xl border theme-border group/room">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <Globe className="w-4 h-4 text-indigo-500 flex-shrink-0" />
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

function ProfileView({ user, setUser, isOnline, onSave, onBack, onOpenAdmin, deferredPrompt, onInstall, isNotificationsEnabled, onRequestNotifications, onUnblock }: { user: User, setUser: (u: User) => void, isOnline: boolean, onSave: (u: User) => void, onBack: () => void, onOpenAdmin: () => void, deferredPrompt: any, onInstall: () => void, isNotificationsEnabled: boolean, onRequestNotifications: () => void, onUnblock: (u: string) => void }) {
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
              <div className="text-sm font-bold theme-text-main">{t.notifications}</div>
              <div className="text-xs theme-text-sub">{t.notificationsSub}</div>
            </div>
            <button 
              onClick={onRequestNotifications}
              className={`p-3 rounded-xl transition-all ${isNotificationsEnabled ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              {isNotificationsEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
            </button>
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

          {/* Blocked Users */}
          {user.blockedUsers && user.blockedUsers.length > 0 && (
            <div className="p-4 theme-bg-panel rounded-2xl border theme-border">
              <div className={`text-sm font-bold theme-text-main mb-3 ${user.language === 'ar' ? 'text-right' : 'text-left'}`}>{t.blocked}</div>
              <div className="space-y-2">
                {Array.from(new Set(user.blockedUsers)).map((u, idx) => (
                  <div key={`${u}-${idx}`} className="flex items-center justify-between p-3 theme-bg-main rounded-xl border theme-border">
                    <div className="flex items-center gap-2">
                      <UserMinus className="w-4 h-4 text-red-500" />
                      <span className="text-sm theme-text-main font-medium">@{u}</span>
                    </div>
                    <button 
                      onClick={() => onUnblock(u)}
                      className="text-indigo-500 hover:text-indigo-400 text-xs font-bold"
                    >
                      {t.unblock}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Owned Rooms */}
          <div className="p-4 theme-bg-panel rounded-2xl border theme-border">
            <div className={`text-sm font-bold theme-text-main mb-3 ${user.language === 'ar' ? 'text-right' : 'text-left'}`}>{t.ownedRooms}</div>
            <div className="space-y-2">
              {user.ownedRooms && user.ownedRooms.length > 0 ? (
                user.ownedRooms.map((rm, idx) => (
                  <div key={`${rm.id}-${idx}`} className="flex items-center justify-between p-3 theme-bg-main rounded-xl border theme-border">
                    <div className="flex items-center gap-2">
                       <Globe className="w-4 h-4 text-indigo-500" />
                       <div className="flex flex-col">
                         <span className="text-sm theme-text-main font-medium">{rm.tag}</span>
                         <span className="text-[10px] theme-text-sub font-medium">{rm.id}</span>
                       </div>
                    </div>
                    <button 
                      onClick={async () => {
                        if (!window.confirm(t.confirmDelete)) return;
                        const res = await fetch('/api/rooms/delete', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ roomId: rm.id, username: user.username })
                        });
                        if (res.ok) {
                          setUser({ ...user, ownedRooms: user.ownedRooms?.filter(r => r.id !== rm.id) });
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

          {/* PWA Install Button */}
          {deferredPrompt && (
            <button
              onClick={onInstall}
              className="w-full mt-4 p-4 theme-bg-panel border theme-border hover:theme-border-main rounded-2xl flex items-center justify-center gap-3 transition-all group"
            >
              <Upload className="w-5 h-5 theme-text-sub group-hover:theme-text-main transition-colors" />
              <div className="text-left">
                <div className="text-sm font-bold theme-text-main">{t.installApp}</div>
                <div className="text-[10px] theme-text-sub">{t.installAppSub}</div>
              </div>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function LoginView({ onLogin, language, deferredPrompt, onInstall }: { onLogin: (u: User) => void, language: 'en' | 'ar', deferredPrompt: any, onInstall: () => void }) {
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
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center mb-6 mx-auto shadow-2xl shadow-indigo-500/40 border border-white/20">
            <Video className="text-white w-10 h-10 drop-shadow-lg" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter theme-text-main mb-1">{t.loginTitle}</h1>
          <p className="theme-text-sub text-sm mt-1 opacity-70">{t.loginSub}</p>
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

        {deferredPrompt && (
          <div className="mt-8 pt-6 border-t theme-border">
            <button 
              onClick={onInstall}
              className="w-full text-center py-2 theme-text-sub hover:theme-text-main transition-all font-bold text-sm underline underline-offset-4 decoration-indigo-500/30"
            >
              {t.installApp}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

const PeerMicIndicator: React.FC<{ stream?: MediaStream, micOn?: boolean, isLocal?: boolean, isSpeakingLocal?: boolean, volumeLocal?: number }> = ({ stream, micOn, isLocal, isSpeakingLocal, volumeLocal }) => {
  const { isSpeaking: isSpeakingPeer, volume: volumePeer } = useAudioActivity(stream || null, micOn);
  const speaking = isLocal ? isSpeakingLocal : isSpeakingPeer;
  const volume = isLocal ? volumeLocal : volumePeer;
  
  const greenOpacity = Math.min(1, (volume || 0) / 100);
  const glowSize = Math.min(15, (volume || 0) / 6);

  if (!micOn) {
    return (
      <div className="p-1 rounded-full bg-rose-500/20 text-rose-500 shadow-sm">
        <MicOff className="w-3.5 h-3.5" />
      </div>
    );
  }

  return (
    <div 
      className={`p-1 rounded-full transition-all duration-100 ${speaking ? 'text-white' : 'text-emerald-400'}`}
      style={{ 
        backgroundColor: speaking ? `rgba(16, 185, 129, ${0.3 + greenOpacity * 0.7})` : 'rgba(16, 185, 129, 0.15)',
        boxShadow: speaking ? `0 0 ${8 + glowSize}px rgba(16, 185, 129, ${0.4 + greenOpacity * 0.6})` : 'none',
        transform: `scale(${speaking ? 1 + greenOpacity * 0.15 : 1})`
      }}
    >
      <Mic className={`w-3.5 h-3.5 ${speaking ? 'animate-pulse' : ''}`} />
    </div>
  );
};

const RoomInfoCard: React.FC<{ roomId: string, language: 'en' | 'ar' }> = ({ roomId, language }) => {
  const [roomData, setRoomData] = useState<any>(null);
  const [uptime, setUptime] = useState('00:00:00');
  const t = TRANSLATIONS[language];

  useEffect(() => {
    fetch(`/api/rooms/exists?roomId=${roomId}`)
      .then(res => res.json())
      .then(data => {
        if (data.exists) {
          // If the room exists, fetch its details
          fetch(`/api/rooms/details?roomId=${roomId}`)
            .then(res => res.json())
            .then(details => setRoomData(details))
            .catch(console.error);
        }
      });
  }, [roomId]);

  useEffect(() => {
    if (!roomData?.createdAt) return;
    
    const interval = setInterval(() => {
      const now = Date.now();
      const start = new Date(roomData.createdAt).getTime();
      const diff = Math.max(0, now - start);
      
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      
      setUptime(`${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [roomData?.createdAt]);

  if (!roomData) return (
    <div className="profile-card animate-pulse opacity-50">
      <div className="w-14 h-14 rounded-2xl bg-white/20" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-24 bg-white/20 rounded" />
        <div className="h-3 w-16 bg-white/20 rounded" />
      </div>
    </div>
  );

  return (
    <div className="profile-card group">
      <div className="w-14 h-14 rounded-2xl bg-white/10 flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/20 shadow-inner">
        {roomData.ownerAvatar ? (
          <img src={roomData.ownerAvatar} alt={roomData.ownerDisplayName} className="w-full h-full object-cover" />
        ) : (
          <div className="text-white font-black text-xl">{roomData.ownerDisplayName?.[0]?.toUpperCase()}</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-black text-white/60 uppercase tracking-widest flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5" />
          {language === 'ar' ? 'المالك' : 'Owner'}
        </div>
        <div className="text-xl font-black text-white truncate drop-shadow-sm">{roomData.ownerDisplayName}</div>
        <div className="text-sm text-slate-300 truncate mt-1">{roomData.tag}</div>
        <div className="flex items-center gap-3 mt-2 text-[10px] font-bold">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/10">
            <Globe className="w-3 h-3 text-emerald-400" />
            {roomData.tag}
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/20 text-indigo-200 border border-indigo-500/30">
            <Clock className="w-3 h-3" />
            {uptime}
          </div>
        </div>
      </div>
    </div>
  );
};

function RoomView({ 
  roomId, setRoomId, roomTag: initialRoomTag, setRoomTag: setAppRoomTag, userId, user, setUser, soundsEnabled, setSoundsEnabled, isOnline, onLeave, deferredPrompt, onInstall, setIsProfileOpen, setIsSearchOpen 
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
  deferredPrompt: any;
  onInstall: () => void;
  setIsProfileOpen: (val: boolean) => void;
  setIsSearchOpen: (val: boolean) => void;
}) {
  console.log('RoomView rendered with roomId:', roomId, 'userId:', userId);

  const t = TRANSLATIONS[user.language];

  const [isLobbyToastVisible, setIsLobbyToastVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activePeerId, setActivePeerId] = useState<string | null>(null);
  const lobbyToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { 
    peers, localStream, setLocalStream, toggleMedia, 
    startScreenShare, stopScreenShare, isScreenSharing,
    messages, sendChatMessage, isMutedAll, toggleMuteAll,
    sendMuteStatus, sendCamStatus, updateProfile, quality, changeQuality,
    broadcastQuality, setBroadcastQuality,
    lobbyRequests, isWaitingInLobby, isKicked, roomTag, updateRoomTag, incomingCall, isOwner, ownerKey,
    autoAccept, setAutoAccept, autoReject, setAutoReject,
    joinRoom, approveUser, rejectUser, approveAll, rejectAll, kickUser, deleteRoom, 
    forceMute, permitSpeak,
    setIncomingCall, updateRoomSettings, claimOwnership,
    isForceMuted
  } = useWebRTC(roomId, userId, user.username, user.displayName, user.avatar, {
    onMuteForced: () => setMicOn(false),
    onUnmuteForced: () => setMicOn(true)
  });

  useEffect(() => {
    if (lobbyRequests.length > 0 && isOwner) {
      setIsLobbyToastVisible(true);
      if (lobbyToastTimeoutRef.current) clearTimeout(lobbyToastTimeoutRef.current);
      lobbyToastTimeoutRef.current = setTimeout(() => setIsLobbyToastVisible(false), 5000);
    }
  }, [lobbyRequests.length, isOwner]);

  useEffect(() => {
    if (roomTag) setAppRoomTag(roomTag);
  }, [roomTag]);
  
  const preJoinVideoRef = useRef<HTMLVideoElement>(null);
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const spotlightVideoRef = useRef<HTMLVideoElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'general' | 'media' | 'room' | 'security'>('general');
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [viewingProfile, setViewingProfile] = useState<Peer | null>(null);
  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatInput, setChatInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPreJoin, setIsPreJoin] = useState(true);
  const [preJoinMic, setPreJoinMic] = useState(true);
  const [preJoinCam, setPreJoinCam] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);

  // Sync viewingProfile and activePeerId with peers map if it's open
  useEffect(() => {
    if (viewingProfile) {
      if (!peers.has(viewingProfile.userId)) {
        setViewingProfile(null);
      } else {
        const updatedPeer = peers.get(viewingProfile.userId);
        if (updatedPeer) {
          setViewingProfile(updatedPeer);
        }
      }
    }
    if (activePeerId && !peers.has(activePeerId)) {
      setActivePeerId(null);
    }
  }, [peers, viewingProfile?.userId, activePeerId]);

  const playSound = useCallback((url: string) => {
    if (!soundsEnabled) return;
    const audio = new Audio(url);
    audio.play().catch(() => {});
  }, [soundsEnabled]);

  // Profile editing state
  const [tempDisplayName, setTempDisplayName] = useState(user.displayName);
  const [tempAvatar, setTempAvatar] = useState(user.avatar);

  const prevPeersCount = useRef(peers.size);
  const prevMessagesCount = useRef(messages.length);

  const { isSpeaking, volume } = useAudioActivity(localStream, micOn);

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
    if (!localStream) return;

    const videoElement = isPreJoin
      ? preJoinVideoRef.current
      : spotlightId === userId
        ? spotlightVideoRef.current
        : mainVideoRef.current;

    if (!videoElement) return;

    videoElement.srcObject = localStream;
    // Always try to play if element exists and we have a stream
    videoElement.play().catch((err) => {
      console.warn("Local video play blocked or failed:", err);
    });
  }, [localStream, isPreJoin, isScreenSharing, camOn, spotlightId, userId]);

  const handleStream = useCallback((stream: MediaStream) => {
    stream.getTracks().forEach(t => t.enabled = true);
    setLocalStream(stream);
    if (preJoinVideoRef.current) {
      preJoinVideoRef.current.srcObject = stream;
    }
    // Initial mute status
    if (stream.getAudioTracks().length > 0) {
      sendMuteStatus(!stream.getAudioTracks()[0].enabled);
    } else {
      sendMuteStatus(true);
    }
  }, [setLocalStream]);

  const initMedia = useCallback(async () => {
    if (localStream) return;
    
    if (!window.isSecureContext) {
      setMediaError("Media access requires a secure (HTTPS) connection. Your current connection is not secure or your browser is restricting access.");
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMediaError("Your browser doesn't support camera/microphone access in this context. This is often caused by an insecure connection, being inside an iframe, or an outdated browser. Please try opening the app in a new tab.");
      return;
    }

    try {
      setMediaError(null);
      // Try to get video and audio with resilient defaults
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: { 
          width: { min: 640, ideal: 1280 }, 
          height: { min: 480, ideal: 720 },
          frameRate: { ideal: 30 }
        } 
      }).catch(async (err) => {
        console.warn("Standard constraints failed, trying minimal fallbacks:", err);
        // Fallback 1: Any video + audio
        try {
          return await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        } catch (f1Err) {
          // Fallback 2: Just audio
          try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setCamOn(false);
            setPreJoinCam(false);
            return audioStream;
          } catch (audioErr) {
            // Fallback 3: Just video
            try {
              const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
              setMicOn(false);
              setPreJoinMic(false);
              return videoStream;
            } catch (videoErr) {
              throw new Error(user.language === 'ar' ? "تعذر الوصول إلى الكاميرا أو الميكروفون. يرجى التحقق من الأذونات." : "Could not access camera or microphone. Please check permissions.");
            }
          }
        }
      });
      handleStream(stream);
    } catch (err: any) {
      console.warn("Final initialization failure:", err);
      setLoading(false);
      const errorName = err.name || "";
      const errorMessage = err.message || String(err);

      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError' || errorMessage.toLowerCase().includes('denied')) {
        setMediaError(user.language === 'ar' ? "تم رفض الإذن. يرجى السماح بالوصول من إعدادات المتصفح." : "Permission denied. Please allow access in browser settings.");
      } else {
        setMediaError(errorMessage);
      }
    }
  }, [localStream, handleStream, user.language]);

  useEffect(() => {
    initMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Cleanup blob URLs when messages change or component unmounts
  useEffect(() => {
    return () => {
      // Cleanup blob URLs from messages
      messages.forEach(msg => {
        if (msg.file?.url && msg.file.url.startsWith('blob:')) {
          URL.revokeObjectURL(msg.file.url);
        }
      });
    };
  }, [messages]);

  const hasJoined = useRef(false);

  useEffect(() => {
    if (!isPreJoin && !hasJoined.current) {
      console.log('Calling joinRoom from App.tsx');
      joinRoom(false, initialRoomTag);
      hasJoined.current = true;
    }
  }, [isPreJoin]);

  useEffect(() => {
    if (lobbyRequests.length > 0) {
      playSound(SOUNDS.JOIN);
    }
  }, [lobbyRequests.length, playSound]);

  useEffect(() => {
    if (preJoinVideoRef.current && localStream) {
      preJoinVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isPreJoin]);

  useEffect(() => {
    if (mainVideoRef.current && localStream) {
      mainVideoRef.current.srcObject = localStream;
    }
    if (spotlightVideoRef.current && localStream && spotlightId === userId) {
      spotlightVideoRef.current.srcObject = localStream;
    }
  }, [localStream, spotlightId, userId]);

  useEffect(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => { track.enabled = camOn; });
    }
  }, [camOn, localStream]);

  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => { track.enabled = micOn; });
    }
  }, [micOn, localStream]);

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
            <video 
              ref={preJoinVideoRef}
              autoPlay 
              muted 
              playsInline 
              className="w-full h-full object-cover" 
            />
            {mediaError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/98 p-6 text-center z-50 overflow-y-auto">
                <ShieldAlert className="w-12 h-12 text-red-500 mb-4 shrink-0" />
                <h3 className="text-white font-bold text-lg mb-2">{user.language === 'ar' ? 'مشكلة في أذونات الوسائط' : 'Media Permission Issue'}</h3>
                <p className="text-sm text-red-400 mb-6 font-medium leading-relaxed max-w-sm">{mediaError}</p>
                
                <div className="flex flex-col gap-3 w-full max-w-xs mb-4">
                  <button 
                    onClick={initMedia}
                    className="w-full bg-indigo-600 text-white px-4 py-3 rounded-xl text-xs font-bold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                  >
                    {t.retry || (user.language === 'ar' ? 'إعادة المحاولة' : 'Retry Access')}
                  </button>
                  {window.self !== window.top && (
                    <button 
                      onClick={() => window.open(window.location.href, '_blank')}
                      className="w-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 px-4 py-3 rounded-xl text-xs font-bold hover:bg-indigo-600/30 transition-all active:scale-95"
                    >
                      {user.language === 'ar' ? 'فتح في نافذة جديدة' : 'Open in New Tab (Recommended)'}
                    </button>
                  )}
                  <button 
                    onClick={() => { setIsPreJoin(false); setMicOn(false); setCamOn(false); setPreJoinMic(false); setPreJoinCam(false); }}
                    className="w-full bg-slate-800 text-slate-400 border border-slate-700 px-4 py-3 rounded-xl text-xs font-bold hover:bg-slate-700 transition-all"
                  >
                    {t.joinWithoutMedia || (user.language === 'ar' ? 'الانضمام بدون وسائط' : "Join without Camera/Mic")}
                  </button>
                </div>
              </div>
            )}
            {!mediaError && !localStream && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 p-6 text-center z-40">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-white text-sm font-medium">
                  {user.language === 'ar' ? 'يرجى السماح بالوصول للكاميرا من الرسالة التي ستظهر في المتصفح' : 'Please allow camera access from the browser prompt'}
                </p>
              </div>
            )}
            {!preJoinCam && !mediaError && (
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

  const handleUpdateProfile = () => {
    const newUser = { ...user, displayName: tempDisplayName, avatar: tempAvatar };
    setUser(newUser);
    updateProfile(tempDisplayName, tempAvatar);
  };

  const onProfileBack = () => {
    setIsProfileOpen(false);
  };

  const handleToggleMic = () => {
    if (isForceMuted) {
      alert(user.language === 'ar' ? 'لقد قام مالك الغرفة بكتم صوتك. لا يمكنك إلغاء الكتم حتى يسمح لك.' : 'The room owner has muted you. You cannot unmute until permitted.');
      return;
    }
    toggleMedia('audio');
    setMicOn(!micOn);
  };

  const handleToggleCam = () => {
    toggleMedia('video');
    const newState = !camOn;
    setCamOn(newState);
    sendCamStatus(newState);
  };

  const handleStartScreenShare = async () => {
    try {
      const screenStream = await startScreenShare();
      const activeVideoRef = spotlightId === userId ? spotlightVideoRef : mainVideoRef;
      if (screenStream && activeVideoRef.current) {
        activeVideoRef.current.srcObject = screenStream;
      }
    } catch (err: any) {
      console.error("Screen share error:", err);
      const isBlocked = err.message?.includes("blocked") || err.message?.includes("iframe") || err.message?.includes("not supported by your browser or environment");
      const isDenied = err.name === 'NotAllowedError' || 
                      err.message?.toLowerCase().includes("denied") || 
                      err.message?.toLowerCase().includes("permission") || 
                      err.message?.toLowerCase().includes("cancel");

      if (isBlocked || err.name === 'TypeError') {
        if (confirm(`${t.screenShareNotSupported}\n\n${user.language === 'ar' ? 'هل تريد الفتح في نافذة جديدة؟' : 'Would you like to open in a new tab now?'}`)) {
          window.open(window.location.href, '_blank');
        }
      } else if (isDenied) {
        console.warn("Screen share denied or cancelled by user");
        // No alert
      } else {
        alert(`${t.screenShareError}: ${err.message || String(err)}`);
      }
    }
  };

  const handleStopScreenShare = async () => {
    await stopScreenShare();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create a blob URL for the file that can be downloaded properly
    const blobUrl = URL.createObjectURL(file);

    const chatFile = {
      name: file.name,
      type: file.type,
      url: blobUrl,
      size: file.size
    };
    sendChatMessage("", chatFile);
    e.target.value = ''; // Reset input
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChatMessage(chatInput);
    setChatInput('');
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className="main-dashboard-layout">
        {/* Lobby Toast Notification */}
        <AnimatePresence>
          {isLobbyToastVisible && lobbyRequests.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 50, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: 50, x: '-50%' }}
              className="fixed bottom-32 left-1/2 z-[100] w-full max-w-sm"
              onClick={() => setIsParticipantsOpen(true)}
            >
              <div className="mx-4 p-4 theme-bg-panel border-2 border-indigo-500 rounded-[28px] shadow-2xl flex items-center gap-4 cursor-pointer hover:scale-105 transition-all">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center animate-pulse">
                  <UserIcon className="w-6 h-6 text-indigo-500" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-black theme-text-main">
                    {t.lobby} ({lobbyRequests.length})
                  </div>
                  <div className="text-[10px] theme-text-sub font-medium">
                    {user.language === 'ar' ? 'هناك مستخدمون بانتظار الموافقة' : 'Users are waiting for your approval'}
                  </div>
                </div>
                <div className="p-2 bg-indigo-500 text-white rounded-xl">
                  <ChevronLeft className={`w-4 h-4 ${user.language === 'ar' ? 'rotate-90' : '-rotate-90'}`} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Left Sidebar */}
        <aside className="nav-sidebar">
          <div className="w-12 h-12 bg-[#5e5ce6] rounded-[18px] flex items-center justify-center mb-8 shadow-lg shadow-[#5e5ce6]/20">
            <Plus className="text-white w-6 h-6" />
          </div>

          <div className="flex flex-col gap-4">
            <div className="nav-icon" onClick={() => alert(user.language === 'ar' ? 'لوحة القيادة - قريباً' : 'Dashboard - Coming soon')}>
              <LayoutGrid className="w-6 h-6" />
            </div>
            <div className="nav-icon" onClick={() => alert(user.language === 'ar' ? 'الجدول الزمني - قريباً' : 'Schedule - Coming soon')}>
              <Calendar className="w-6 h-6" />
            </div>
            <div 
              className={`nav-icon ${isParticipantsOpen ? 'active' : ''} relative`} 
              onClick={() => { setIsParticipantsOpen(!isParticipantsOpen); setIsChatOpen(false); }}
              title={t.participants}
            >
              <Users className="w-6 h-6" />
              {isOwner && lobbyRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 text-[8px] font-bold text-white rounded-full flex items-center justify-center border-2 border-[#111119] animate-bounce">
                  {lobbyRequests.length}
                </span>
              )}
            </div>
            <div 
              className={`nav-icon ${isChatOpen ? 'active' : ''} relative`} 
              onClick={() => { setIsChatOpen(!isChatOpen); setIsParticipantsOpen(false); }}
            >
              <MessageSquare className="w-6 h-6" />
              {unreadCount > 0 && !isChatOpen && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-4 px-1 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </div>
            <div 
              className="nav-icon"
              onClick={() => setIsShareOpen(true)}
            >
              <Share2 className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-auto flex flex-col gap-4">
            <div className="nav-icon" onClick={() => setIsSettingsOpen(true)}>
              <Settings className="w-6 h-6" />
            </div>
            <div className="nav-icon text-rose-500 hover:bg-rose-500/10" onClick={onLeave}>
              <LogOut className="w-6 h-6" />
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0b0b13]">
          {/* Top Header */}
          <header className="dashboard-header">
            <div className="flex items-center gap-4 flex-1">
              <button 
                onClick={() => setRoomId('')}
                className="p-3 rounded-2xl bg-[#111119] border border-white/5 text-[#4a4a6a] hover:text-white transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="search-bar">
                <Search className="w-4 h-4 text-[#4a4a6a]" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value && !isParticipantsOpen && !isChatOpen) {
                      setIsParticipantsOpen(true);
                      setIsChatOpen(false);
                    }
                  }}
                  placeholder={user.language === 'ar' ? 'البحث عن أشخاص...' : 'Search for people...'} 
                  className="search-input"
                />
              </div>
            </div>
          </header>
          
          <main className="flex-1 relative overflow-hidden p-4">
            <div className="flex flex-col h-full max-w-7xl mx-auto gap-4">
              <div className="flex-1 relative rounded-[40px] overflow-hidden bg-[#111119]">
                <div className={`grid gap-4 h-full p-4 ${spotlightId ? 'grid-cols-4 grid-rows-4' : (peers.size === 0 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-2')}`}>
                  {/* Spotlight View */}
                  {spotlightId && (
                    <div className="col-span-3 row-span-4 relative rounded-[32px] overflow-hidden bg-[#1c1b29] border-2 border-[#5e5ce6]/30 shadow-2xl group">
                      {spotlightId === userId ? (
                        <>
                          <video 
                            ref={(el) => {
                              if (el && localStream) {
                                el.srcObject = localStream;
                                if (camOn) el.play().catch((e) => console.error("Spotlight local play error:", e));
                              }
                            }}
                            autoPlay 
                            muted 
                            playsInline 
                            className={`w-full h-full object-cover ${!camOn ? 'hidden' : ''}`} 
                          />
                          {!camOn && (
                            <div className="absolute inset-0 flex items-center justify-center bg-[#1c1b29]">
                              <div className="w-48 h-48 rounded-full border-4 border-[#5e5ce6]/30 overflow-hidden shadow-2xl flex items-center justify-center bg-[#111119]">
                                {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : <UserIcon className="w-24 h-24 text-[#4a4a6a]" />}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <video
                            ref={(el) => {
                              const p = peers.get(spotlightId);
                              if (el && p?.stream) {
                                el.srcObject = p.stream;
                                el.play().catch((e) => console.error("Spotlight peer play error:", e));
                              }
                            }}
                            autoPlay
                            playsInline
                            className={`w-full h-full object-cover ${!peers.get(spotlightId)?.camOn ? 'hidden' : ''}`}
                          />
                          {!peers.get(spotlightId)?.camOn && (
                            <div className="absolute inset-0 flex items-center justify-center bg-[#1c1b29]">
                              <div className="w-48 h-48 rounded-full border-4 border-[#5e5ce6]/30 overflow-hidden shadow-2xl flex items-center justify-center bg-[#111119]">
                                {peers.get(spotlightId)?.avatar ? <img src={peers.get(spotlightId)?.avatar} className="w-full h-full object-cover" /> : <UserIcon className="w-24 h-24 text-[#4a4a6a]" />}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      <div className={`absolute top-6 ${user.language === 'ar' ? 'left-6' : 'right-6'} flex items-center justify-center p-2.5 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10`}>
                        <button onClick={(e) => { e.stopPropagation(); setSpotlightId(null); }} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                          <Minimize2 className="w-5 h-5 text-white" />
                        </button>
                      </div>
                        <div className={`absolute bottom-6 ${user.language === 'ar' ? 'right-6' : 'left-6'} flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10`}>
                          <PeerMicIndicator 
                            stream={spotlightId === userId ? localStream : peers.get(spotlightId)?.stream} 
                            micOn={spotlightId === userId ? micOn : peers.get(spotlightId)?.micOn} 
                            isLocal={spotlightId === userId}
                            isSpeakingLocal={isSpeaking}
                            volumeLocal={volume}
                          />
                          <span className="text-sm font-bold text-white">
                            {spotlightId === userId ? `${user.displayName} (${t.you})` : peers.get(spotlightId)?.displayName}
                          </span>
                        </div>
                    </div>
                  )}

                  {/* Regular Grid Items */}
                  <div className={`${spotlightId ? 'col-span-1 row-span-4 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar' : 'contents'}`}>
                    {/* Local User */}
                    {spotlightId !== userId && (
                      <div 
                        onClick={() => setSpotlightId(userId)}
                        className={`relative rounded-[32px] overflow-hidden bg-[#1c1b29] group shadow-xl cursor-pointer hover:border-[#5e5ce6]/30 transition-all ${spotlightId ? 'aspect-video shrink-0' : ''} ${isSpeaking ? 'border-[#5e5ce6] ring-4 ring-[#5e5ce6]/20' : 'border-white/5'}`}
                      >
                        <video
                          ref={(el) => {
                            if (el && localStream) {
                              el.srcObject = localStream;
                              if (camOn) el.play().catch((e) => console.error("Local play error:", e));
                            }
                          }}
                          autoPlay
                          muted
                          playsInline
                          className={`w-full h-full object-cover ${!camOn ? 'hidden' : ''}`}
                        />
                        {!camOn && (
                          <div className="absolute inset-0 flex items-center justify-center bg-[#1c1b29]">
                            <div className={`rounded-full border-2 border-[#5e5ce6]/40 overflow-hidden flex items-center justify-center bg-[#111119] shrink-0 ${spotlightId ? 'w-24 h-24' : 'w-40 h-40'}`}>
                              {user.avatar ? (
                                <img src={user.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <span className={`font-black text-[#5e5ce6]/60 leading-none ${spotlightId ? 'text-3xl' : 'text-6xl'}`}>{user.displayName.charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                          </div>
                        )}
                        <div 
                          className={`absolute top-4 ${user.language === 'ar' ? 'left-4' : 'right-4'} flex items-center justify-center p-2 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10`} 
                          onClick={(e) => { e.stopPropagation(); setSpotlightId(userId); }}
                        >
                          {spotlightId === userId ? <Minimize2 className="w-3 h-3 text-white" /> : <Maximize2 className="w-3 h-3 text-white" />}
                        </div>
                        <div className={`absolute bottom-4 ${user.language === 'ar' ? 'right-4' : 'left-4'} flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 cursor-pointer active:scale-95 transition-transform`} onClick={(e) => { e.stopPropagation(); setIsProfileOpen(true); }}>
                          <PeerMicIndicator isLocal isSpeakingLocal={isSpeaking} micOn={micOn} volumeLocal={volume} />
                          <span className="text-[10px] font-bold text-white uppercase tracking-wider">{user.displayName} ({t.you})</span>
                        </div>
                      </div>
                    )}

                    {/* Peers */}
                    {Array.from(peers.values()).map((peer: Peer) => (
                      spotlightId !== peer.userId && (
                        <div 
                          key={`grid-peer-${peer.userId}`} 
                          onClick={() => setSpotlightId(peer.userId)}
                          className={`relative rounded-[32px] overflow-hidden bg-[#1c1b29] group shadow-xl cursor-pointer hover:border-[#5e5ce6]/30 transition-all ${spotlightId ? 'aspect-video shrink-0' : 'border-2'} ${peer.micOn && peers.get(peer.userId)?.stream ? 'border-[#5e5ce6] ring-4 ring-[#5e5ce6]/20' : 'border-transparent'}`}
                        >
                          <video
                            ref={(el) => {
                              if (el && peer.stream) {
                                el.srcObject = peer.stream;
                                el.play().catch(() => {});
                              }
                            }}
                            autoPlay
                            playsInline
                            className={`w-full h-full object-cover ${!peer.camOn ? 'hidden' : ''}`}
                          />
                          {!peer.camOn && (
                            <div className="absolute inset-0 flex items-center justify-center bg-[#1c1b29]">
                              <div className={`rounded-full border-2 border-[#5e5ce6]/40 overflow-hidden flex items-center justify-center bg-[#111119] shrink-0 ${spotlightId ? 'w-24 h-24' : 'w-40 h-40'}`}>
                                {peer.avatar ? (
                                  <img src={peer.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <span className={`font-black text-[#5e5ce6]/60 leading-none ${spotlightId ? 'text-3xl' : 'text-6xl'}`}>{peer.displayName.charAt(0).toUpperCase()}</span>
                                )}
                              </div>
                            </div>
                          )}
                          <div 
                            className={`absolute top-4 ${user.language === 'ar' ? 'left-4' : 'right-4'} flex items-center justify-center p-2 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10`} 
                            onClick={(e) => { e.stopPropagation(); setSpotlightId(peer.userId); }}
                          >
                            {spotlightId === peer.userId ? <Minimize2 className="w-3 h-3 text-white" /> : <Maximize2 className="w-3 h-3 text-white" />}
                          </div>
                          <div className={`absolute bottom-4 ${user.language === 'ar' ? 'right-4' : 'left-4'} flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 cursor-pointer active:scale-95 transition-transform`} onClick={(e) => { e.stopPropagation(); setActivePeerId(peer.userId); }}>
                            <PeerMicIndicator stream={peer.stream} micOn={peer.micOn} />
                            <span className="text-[10px] font-bold text-white uppercase tracking-wider">{peer.displayName}</span>
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Controls Pill */}
              <div className="flex justify-center mb-6">
                <div className="control-pill shadow-2xl">
                  <button 
                    onClick={handleToggleMic}
                    className={`control-btn ${micOn ? 'control-btn-active' : 'control-btn-inactive'}`}
                    title={micOn ? t.mute : t.unmute}
                  >
                    {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  </button>
                  <button 
                    onClick={handleToggleCam}
                    className={`control-btn ${camOn ? 'control-btn-active' : 'control-btn-inactive'}`}
                    title={camOn ? t.stopVideo : t.startVideo}
                  >
                    {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                  </button>
                  <button 
                    onClick={onLeave}
                    className="control-btn control-btn-danger group px-6 py-2 min-w-[160px] flex items-center justify-center gap-3"
                    title={t.leave}
                  >
                    <div className="bg-white/20 p-1.5 rounded-lg group-hover:rotate-12 transition-transform shrink-0 flex items-center justify-center">
                      <PhoneOff className="w-4.5 h-4.5" />
                    </div>
                    <span className="text-[13px] font-black tracking-tight whitespace-nowrap">{user.language === 'ar' ? 'مغادرة' : 'Leave'}</span>
                  </button>
                  <button 
                    onClick={() => {
                      if (!isOwner) {
                        alert(user.language === 'ar' ? 'متاح فقط لمالك الغرفة' : 'Only available for room owner');
                        return;
                      }
                      setRecording(!recording);
                    }}
                    className={`control-btn ${recording ? 'bg-rose-500 text-white animate-pulse' : 'control-btn-inactive opacity-50'}`}
                    title={t.record}
                  >
                    <Circle className={`w-5 h-5 ${recording ? 'fill-white' : 'fill-rose-500 text-rose-500'}`} />
                  </button>
                  <button 
                    onClick={isScreenSharing ? handleStopScreenShare : handleStartScreenShare}
                    className={`control-btn ${isScreenSharing ? 'control-btn-active' : 'control-btn-inactive'}`}
                    title={isScreenSharing ? t.stopShare : t.share}
                  >
                    <Monitor className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>

        {/* Right Sidebar */}
      <aside className={`right-sidebar ${isChatOpen || isParticipantsOpen ? 'flex fixed inset-y-0 right-0 z-50' : 'hidden'} xl:flex xl:static`}>
        <RoomInfoCard roomId={roomId} language={user.language} />

        {/* Chat / Participants Section */}
        <div className="chat-section">
          <div className="chat-tabs shrink-0">
            <div 
              className={`chat-tab ${isChatOpen ? 'active' : 'inactive'}`} 
              onClick={() => { setIsChatOpen(true); setIsParticipantsOpen(false); }}
            >
              {t.chat}
            </div>
            <div 
              className={`chat-tab ${isParticipantsOpen ? 'active' : 'inactive'}`}
              onClick={() => { setIsParticipantsOpen(true); setIsChatOpen(false); }}
            >
              {t.participants}
              <span className="ml-1.5 px-1.5 py-0.5 rounded-md bg-white/10 text-[10px] font-black">{peers.size + 1}</span>
            </div>
          </div>

          {isChatOpen ? (
            <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" ref={scrollRef}>
                {messages.map((msg) => (
                  <div 
                    key={msg.id}
                    className={`flex flex-col ${msg.senderId === userId ? 'items-end' : 'items-start'}`}
                  >
                    {msg.senderId !== userId && (
                      <div className="flex items-center gap-2 mb-1 pl-1">
                         <img src={msg.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + msg.senderId} className="w-4 h-4 rounded-full" />
                         <span className="text-[9px] font-black text-[#5e5ce6] uppercase tracking-tighter">{msg.displayName}</span>
                      </div>
                    )}
                    <div className={`chat-message-bubble max-w-[85%] ${msg.senderId === userId ? 'chat-message-mine' : 'chat-message-other animate-in slide-in-from-left-2'}`}>
                      {msg.text && <div className="message-content break-words whitespace-pre-wrap text-[13px] leading-tight font-medium">{msg.text}</div>}
                      
                      {msg.file && (
                        <div className="mt-2 p-2 bg-black/20 rounded-xl border border-white/5 hover:bg-black/30 transition-colors group">
                          {msg.file.type.startsWith('image/') ? (
                            <div className="space-y-1">
                              <div className="relative rounded-lg overflow-hidden aspect-video bg-[#0b0b13] border border-white/5">
                                <img src={msg.file.url} alt={msg.file.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                <a 
                                  href={msg.file.url} 
                                  download={msg.file.name}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <ExternalLink className="w-5 h-5 text-white" />
                                </a>
                              </div>
                              <div className="text-[9px] text-white/50 truncate font-bold px-1">{msg.file.name}</div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-[#5e5ce6]/10 flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4 text-[#5e5ce6]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-bold text-white truncate">{msg.file.name}</div>
                                <div className="text-[8px] text-white/40">{(msg.file.size / 1024).toFixed(1)} KB</div>
                              </div>
                              <a 
                                href={msg.file.url} 
                                download={msg.file.name}
                                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-[#4a4a6a] hover:text-[#5e5ce6]"
                              >
                                <Upload className="w-3 h-3 rotate-180" />
                              </a>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="text-[8px] mt-1 opacity-40 text-right font-black">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSendChat} className="chat-input-area p-3 bg-[#1c1b29]/50 backdrop-blur-xl border-t border-white/5 mx-2 mb-2 rounded-[24px]">
                <input 
                  type="file" 
                  id="chat-file-input" 
                  className="hidden" 
                  onChange={handleFileUpload}
                  accept="image/*,.pdf,.doc,.docx,.txt"
                />
                <button 
                  type="button" 
                  onClick={() => document.getElementById('chat-file-input')?.click()}
                  className="p-2 text-[#4a4a6a] hover:text-[#5e5ce6] transition-colors"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type message..." 
                  className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder:text-[#4a4a6a] px-2"
                />
                <button 
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="p-2.5 bg-[#5e5ce6] text-white rounded-xl shadow-lg shadow-[#5e5ce6]/20 hover:scale-110 active:scale-95 transition-all disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Lobby Requests Section */}
              {isOwner && lobbyRequests.length > 0 && (
                <div className="mb-6 space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#5e5ce6] animate-pulse" />
                      <span className="text-xs font-bold text-[#5e5ce6] uppercase tracking-widest">{t.lobby} ({lobbyRequests.length})</span>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={approveAll}
                        className="text-[10px] font-bold text-emerald-500 hover:underline"
                      >
                        {t.approveAll}
                      </button>
                      <button 
                        onClick={rejectAll}
                        className="text-[10px] font-bold text-rose-500 hover:underline"
                      >
                        {t.rejectAll}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {lobbyRequests.map((req) => (
                      <div key={`lobby-${req.userId}`} className="flex items-center justify-between p-3 rounded-2xl bg-[#5e5ce6]/5 border border-[#5e5ce6]/20 shadow-lg shadow-[#5e5ce6]/5 group/lobby">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#5e5ce6]/10 flex items-center justify-center overflow-hidden border border-[#5e5ce6]/30">
                            {req.avatar ? (
                              <img src={req.avatar} className="w-full h-full object-cover" />
                            ) : (
                              <UserIcon className="w-4 h-4 text-[#5e5ce6]" />
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-bold theme-text-main">{req.displayName}</div>
                            <div className="text-[10px] theme-text-sub">@{req.username}</div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => approveUser(req.userId)}
                            className="p-2 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all"
                            title={t.approve}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => rejectUser(req.userId)}
                            className="p-2 bg-rose-500 text-white rounded-xl shadow-lg shadow-rose-500/20 hover:scale-105 active:scale-95 transition-all"
                            title={t.reject}
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mb-4 px-2">
                <span className="text-xs font-bold text-[#4a4a6a] uppercase tracking-wider">{t.online} — {peers.size + 1}</span>
                {isOwner && (
                  <button onClick={() => forceMute(undefined, true)} className="text-[10px] font-bold text-rose-500 hover:underline">
                    {t.muteEveryone}
                  </button>
                )}
              </div>
              
              {/* Local User */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-[#1c1b29] border border-white/5 cursor-pointer" onClick={() => setIsProfileOpen(true)}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full bg-[#5e5ce6]/20 flex items-center justify-center border-2 overflow-hidden transition-colors ${micOn ? 'border-emerald-500' : 'border-[#5e5ce6]/30'}`}>
                    {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover rounded-full" /> : <UserIcon className="w-4 h-4 text-[#5e5ce6]" />}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                       {user.displayName} 
                       <span className="text-[10px] text-[#5e5ce6] font-normal">({t.you})</span>
                    </div>
                    <div className="text-[10px] text-[#4a4a6a]">{isOwner ? 'Owner' : 'Member'}</div>
                  </div>
                </div>
              </div>

              {/* Peers */}
              {Array.from(peers.values())
                .filter(p => !searchQuery || p.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((peer) => (
                <div key={`sidebar-peer-${peer.userId}`} className="flex items-center justify-between p-3 rounded-2xl bg-[#0b0b13] border border-white/5 hover:bg-[#1c1b29] transition-colors group cursor-pointer" onClick={() => setActivePeerId(peer.userId)}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border border-white/5">
                      {peer.avatar ? <img src={peer.avatar} className="w-full h-full object-cover" /> : <UserIcon className="w-4 h-4 text-slate-400" />}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        {peer.displayName}
                        <PeerMicIndicator stream={peer.stream} micOn={peer.micOn} />
                      </div>
                      <div className="text-[10px] text-[#4a4a6a] uppercase tracking-widest font-bold">{t.member}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!peer.micOn && <MicOff className="w-3.5 h-3.5 text-rose-500/50" />}
                    {isOwner && (
                      <button onClick={(e) => { e.stopPropagation(); kickUser(peer.userId); }} className="p-1.5 opacity-0 group-hover:opacity-100 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="settings-overlay">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="settings-card"
            >
              <div className="flex flex-1 min-h-0">
                {/* Sidebar */}
                <div className="settings-sidebar">
                  <div className="text-xl font-black theme-text-main mb-8 px-4">Settings</div>
                  <div 
                    className={`settings-tab ${activeSettingsTab === 'general' ? 'active' : 'inactive'}`}
                    onClick={() => setActiveSettingsTab('general')}
                  >
                    General
                  </div>
                  <div 
                    className={`settings-tab ${activeSettingsTab === 'media' ? 'active' : 'inactive'}`}
                    onClick={() => setActiveSettingsTab('media')}
                  >
                    Media
                  </div>
                  {isOwner && (
                    <div 
                      className={`settings-tab ${activeSettingsTab === 'room' ? 'active' : 'inactive'}`}
                      onClick={() => setActiveSettingsTab('room')}
                    >
                      Room
                    </div>
                  )}
                  <div 
                    className={`settings-tab ${activeSettingsTab === 'security' ? 'active' : 'inactive'}`}
                    onClick={() => setActiveSettingsTab('security')}
                  >
                    Security
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col min-w-0">
                  <div className="p-8 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-lg font-bold theme-text-main uppercase tracking-widest text-[#5e5ce6]">
                      {activeSettingsTab === 'general' ? 'General Settings' : 
                       activeSettingsTab === 'media' ? 'Media Settings' :
                       activeSettingsTab === 'room' ? 'Room Settings' : 'Security Settings'}
                    </h3>
                    <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                      <X className="w-5 h-5 theme-text-sub" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    {activeSettingsTab === 'general' && (
                      <>
                        <div className="p-6 rounded-[32px] bg-[#1c1b29] border border-white/5 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-[#5e5ce6]/10 flex items-center justify-center">
                              <UserIcon className="w-6 h-6 text-[#5e5ce6]" />
                            </div>
                            <div>
                               <div className="text-sm font-bold theme-text-main">{user.displayName}</div>
                               <p className="text-[10px] theme-text-sub mt-1">@{user.username}</p>
                            </div>
                          </div>
                        </div>

                        <div className="p-6 rounded-[32px] bg-[#1c1b29] border border-white/5 flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <div className="w-12 h-12 rounded-2xl bg-[#5e5ce6]/10 flex items-center justify-center">
                              <Bell className="w-6 h-6 text-[#5e5ce6]" />
                            </div>
                            <button 
                              onClick={() => setSoundsEnabled(!soundsEnabled)}
                              className={`p-3 rounded-xl transition-all ${soundsEnabled ? 'bg-[#5e5ce6] text-white' : 'bg-white/5 text-slate-400'}`}
                            >
                              {soundsEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                            </button>
                          </div>
                          <div>
                            <div className="text-sm font-bold theme-text-main">{t.sounds}</div>
                            <p className="text-[10px] theme-text-sub mt-1">{t.soundsSub}</p>
                          </div>
                        </div>
                      </>
                    )}

                    {activeSettingsTab === 'media' && (
                      <>
                        <div className="space-y-6">
                          <label className="text-[10px] font-black text-[#5e5ce6] uppercase tracking-[0.2em] mb-4 block">{t.quality}</label>
                          <div className="flex flex-wrap gap-2">
                            {(['1080', '720', '480', '360', '240'] as const).map((level) => (
                              <button
                                key={level}
                                onClick={() => changeQuality(level)}
                                className={`px-6 py-3 rounded-2xl text-xs font-bold transition-all ${
                                  quality === level 
                                    ? 'bg-[#5e5ce6] text-white shadow-lg shadow-[#5e5ce6]/20' 
                                    : 'bg-[#1c1b29] theme-text-sub hover:bg-white/5 border border-white/5'
                                }`}
                              >
                                {level}p
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-6 rounded-[32px] bg-[#1c1b29] border border-white/5">
                          <div>
                            <div className="text-sm font-bold theme-text-main">{t.broadcastQuality}</div>
                            <p className="text-[10px] theme-text-sub">{t.broadcastQualitySub}</p>
                          </div>
                          <button 
                            onClick={() => setBroadcastQuality(!broadcastQuality)}
                            className={`p-3 rounded-xl transition-all ${broadcastQuality ? 'bg-[#5e5ce6] text-white' : 'bg-white/5 text-slate-400'}`}
                          >
                            <Globe className="w-5 h-5" />
                          </button>
                        </div>
                      </>
                    )}

                    {activeSettingsTab === 'room' && (
                      <>
                        {isOwner ? (
                          <>
                            <div className="space-y-3">
                              <label className="text-[10px] font-black text-[#5e5ce6] uppercase tracking-[0.2em]">{t.roomTag}</label>
                              <div className="flex gap-3">
                                <input 
                                  type="text" 
                                  value={initialRoomTag} 
                                  onChange={(e) => setAppRoomTag(e.target.value)}
                                  className="flex-1 bg-[#1c1b29] border border-white/5 rounded-2xl px-5 py-3 theme-text-main outline-none focus:border-[#5e5ce6] transition-all"
                                  placeholder="Enter room tag..."
                                />
                                <button 
                                  onClick={() => updateRoomTag(initialRoomTag)}
                                  className="bg-[#5e5ce6] text-white px-6 py-3 rounded-2xl font-bold text-xs shadow-lg shadow-[#5e5ce6]/20"
                                >
                                  {t.saveChanges}
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="p-6 rounded-[32px] bg-[#1c1b29] border border-white/5 flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                  </div>
                                  <button 
                                    onClick={() => {
                                      const next = !autoAccept;
                                      setAutoAccept(next);
                                      const nextReject = next ? false : autoReject;
                                      if (next) setAutoReject(false);
                                      updateRoomSettings(next, nextReject);
                                    }}
                                    className={`p-3 rounded-xl transition-all ${autoAccept ? 'bg-emerald-500 text-white' : 'bg-white/5 text-slate-400'}`}
                                  >
                                    {autoAccept ? 'ON' : 'OFF'}
                                  </button>
                                </div>
                                <div>
                                  <div className="text-sm font-bold theme-text-main">{t.autoAccept}</div>
                                  <p className="text-[10px] theme-text-sub mt-1">{t.autoAcceptSub}</p>
                                </div>
                              </div>

                              <div className="p-6 rounded-[32px] bg-[#1c1b29] border border-white/5 flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                  <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center">
                                    <UserMinus className="w-6 h-6 text-rose-500" />
                                  </div>
                                  <button 
                                    onClick={() => {
                                      const next = !autoReject;
                                      setAutoReject(next);
                                      const nextAccept = next ? false : autoAccept;
                                      if (next) setAutoAccept(false);
                                      updateRoomSettings(nextAccept, next);
                                    }}
                                    className={`p-3 rounded-xl transition-all ${autoReject ? 'bg-rose-500 text-white' : 'bg-white/5 text-slate-400'}`}
                                  >
                                    {autoReject ? 'ON' : 'OFF'}
                                  </button>
                                </div>
                                <div>
                                  <div className="text-sm font-bold theme-text-main">{t.autoReject}</div>
                                  <p className="text-[10px] theme-text-sub mt-1">{t.autoRejectSub}</p>
                                </div>
                              </div>
                            </div>

                            <div className="p-6 rounded-[32px] bg-rose-500/5 border border-rose-500/20 space-y-4">
                                <div className="flex items-center gap-3">
                                  <ShieldAlert className="w-5 h-5 text-rose-500" />
                                  <div className="text-sm font-bold text-rose-500">Danger Zone</div>
                                </div>
                                <button 
                                  onClick={toggleMuteAll}
                                  className={`w-full py-3 rounded-xl transition-all flex items-center justify-center gap-3 text-xs font-bold ${isMutedAll ? 'bg-rose-500 text-white' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}
                                >
                                  {isMutedAll ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                  {isMutedAll ? 'Unmute Everyone' : t.muteEveryone}
                                </button>
                                <button 
                                  onClick={() => { if(confirm('Are you sure?')) deleteRoom(); }}
                                  className="w-full py-3 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all text-xs font-bold"
                                >
                                  {user.language === 'ar' ? 'حذف الغرفة نهائياً' : 'Delete Room Permanently'}
                                </button>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-50">
                            <Lock className="w-12 h-12 text-[#4a4a6a]" />
                            <p className="text-sm font-medium theme-text-main">Room management is only available for the owner.</p>
                          </div>
                        )}
                      </>
                    )}

                    {activeSettingsTab === 'security' && (
                      <div className="space-y-6">
                        <div className="p-6 rounded-[32px] bg-[#1c1b29] border border-white/5">
                          <div className="flex items-center gap-4 mb-4">
                            <ShieldCheck className="w-6 h-6 text-emerald-500" />
                            <div className="text-sm font-bold theme-text-main">Room Security</div>
                          </div>
                          <p className="text-xs theme-text-sub leading-relaxed">
                            This room is using end-to-end signaling encryption. All media streams are transmitted via encrypted DTLS/SRTP protocols.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-8 bg-[#1c1b29]/50 border-t border-white/5">
                    <button 
                      onClick={() => setIsSettingsOpen(false)}
                      className="w-full bg-[#5e5ce6] hover:bg-[#6e6df6] text-white font-bold py-4 rounded-[24px] transition-all shadow-xl shadow-[#5e5ce6]/20"
                    >
                      {t.done}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activePeerId && (
          <div className="settings-overlay flex items-center justify-center p-4 z-[100]" onClick={() => setActivePeerId(null)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#111119] border border-white/10 rounded-[40px] shadow-2xl w-full max-w-sm overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {(() => {
                const p = peers.get(activePeerId);
                if (!p) {
                   return null;
                }
                return (
                  <div className="p-8 flex flex-col items-center">
                    <div className="w-32 h-32 rounded-[32px] overflow-hidden bg-slate-800 border-4 border-[#5e5ce6] mb-6 shadow-xl relative flex items-center justify-center">
                      {p.avatar ? (
                        <img src={p.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <UserIcon className="w-16 h-16 text-slate-500" />
                      )}
                      <div className={`absolute bottom-2 right-2 p-2 rounded-xl backdrop-blur-md border border-white/10 ${p.micOn ? 'bg-emerald-500/80' : 'bg-rose-500/80'}`}>
                        {p.micOn ? <Mic className="w-4 h-4 text-white" /> : <MicOff className="w-4 h-4 text-white" />}
                      </div>
                    </div>
                    <h3 className="text-xl font-black text-white mb-1 uppercase tracking-tight">{p.displayName}</h3>
                    <p className="text-[#4a4a6a] text-xs font-bold mb-8 uppercase tracking-widest">@{p.username || 'user'}</p>
                    
                    <div className="w-full space-y-3">
                      {isOwner && (
                        <>
                          <button 
                            onClick={() => {
                              if (p.isMuted) permitSpeak(p.userId);
                              else forceMute(p.userId);
                            }}
                            className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-xs transition-all ${
                              p.isMuted 
                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white' 
                                : 'bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white'
                            }`}
                          >
                            {p.isMuted ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                            {p.isMuted ? (user.language === 'ar' ? 'السماح للمايك' : 'Permit Microphone') : (user.language === 'ar' ? 'إيقاف المايك' : 'Stop Microphone')}
                          </button>
                          <button 
                            onClick={() => { kickUser(p.userId); setActivePeerId(null); }}
                            className="w-full py-4 rounded-2xl bg-white/5 text-rose-500 border border-white/5 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center gap-3 font-bold text-xs"
                          >
                            <Trash2 className="w-4 h-4" />
                            {user.language === 'ar' ? 'طرد من الغرفة' : 'Kick from Room'}
                          </button>
                        </>
                      )}
                      <button 
                        onClick={() => setActivePeerId(null)}
                        className="w-full py-4 rounded-2xl bg-[#5e5ce6] text-white font-bold text-xs shadow-lg shadow-[#5e5ce6]/20 transition-all active:scale-95"
                      >
                        {user.language === 'ar' ? 'إغلاق' : 'Close'}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isShareOpen && (
            <div className="settings-overlay" onClick={() => setIsShareOpen(false)}>
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="share-modal"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold theme-text-main flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-[#5e5ce6]" />
                    {user.language === 'ar' ? 'مشاركة الغرفة' : 'Share Room'}
                  </h3>
                  <button onClick={() => setIsShareOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                    <X className="w-5 h-5 theme-text-sub" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="p-4 rounded-2xl bg-[#0b0b13] border border-white/5">
                    <label className="text-[10px] font-black text-[#5e5ce6] uppercase tracking-[0.2em] mb-2 block">
                      {user.language === 'ar' ? 'رابط الغرفة' : 'Room Link'}
                    </label>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-white/5 px-4 py-2.5 rounded-xl text-xs theme-text-main truncate border border-white/5">
                        {window.location.href}
                      </div>
                      <button 
                        onClick={copyLink}
                        className="p-2.5 bg-[#5e5ce6] text-white rounded-xl shadow-lg shadow-[#5e5ce6]/20 transition-all active:scale-95 flex items-center gap-2 text-xs font-bold"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied ? (user.language === 'ar' ? 'تم النسخ' : 'Copied') : (user.language === 'ar' ? 'نسخ' : 'Copy')}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <a 
                      href={`https://wa.me/?text=${encodeURIComponent((user.language === 'ar' ? 'انضم لغرفتي الصوتية: ' : 'Join my voice room: ') + window.location.href)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-3 p-4 rounded-3xl bg-[#1c1b29] border border-white/5 hover:border-[#5e5ce6]/40 transition-all hover:-translate-y-1"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-[#25D366]/10 flex items-center justify-center">
                        <MessageSquare className="w-6 h-6 text-[#25D366]" />
                      </div>
                      <span className="text-xs font-bold theme-text-main">WhatsApp</span>
                    </a>

                    <a 
                      href={`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(user.language === 'ar' ? 'انضم لغرفتي الصوتية' : 'Join my voice room')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-3 p-4 rounded-3xl bg-[#1c1b29] border border-white/5 hover:border-[#5e5ce6]/40 transition-all hover:-translate-y-1"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-[#0088cc]/10 flex items-center justify-center">
                        <SendHorizontal className="w-6 h-6 text-[#0088cc]" />
                      </div>
                      <span className="text-xs font-bold theme-text-main">Telegram</span>
                    </a>

                    <a 
                      href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(user.language === 'ar' ? 'انضم لغرفتي الصوتية' : 'Join my voice room')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-3 p-4 rounded-3xl bg-[#1c1b29] border border-white/5 hover:border-[#5e5ce6]/40 transition-all hover:-translate-y-1"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                        <Share2 className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-xs font-bold theme-text-main">X / Twitter</span>
                    </a>

                    <button 
                      onClick={() => {
                        if (navigator.share) {
                          navigator.share({
                            title: user.language === 'ar' ? 'غرفة صوتية' : 'Voice Room',
                            text: user.language === 'ar' ? 'انضم لغرفتي الصوتية' : 'Join my voice room',
                            url: window.location.href,
                          }).catch(() => {});
                        }
                      }}
                      className="flex flex-col items-center gap-3 p-4 rounded-3xl bg-[#1c1b29] border border-white/5 hover:border-[#5e5ce6]/40 transition-all hover:-translate-y-1"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-[#5e5ce6]/10 flex items-center justify-center">
                        <ExternalLink className="w-6 h-6 text-[#5e5ce6]" />
                      </div>
                      <span className="text-xs font-bold theme-text-main">{user.language === 'ar' ? 'المزيد' : 'More'}</span>
                    </button>
                  </div>
                </div>

                <div className="mt-8 p-6 bg-[#5e5ce6]/10 rounded-[32px] border border-[#5e5ce6]/20">
                   <div className="flex items-center gap-3">
                     <ShieldCheck className="w-5 h-5 text-[#5e5ce6]" />
                     <div className="text-[11px] font-bold theme-text-main">
                       {user.language === 'ar' ? 'المشاركة آمنة ومباشرة' : 'Sharing is secure and direct'}
                     </div>
                   </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

interface PeerVideoProps {
  peer: Peer;
  onClick: () => void;
  onMaximize: () => void;
  t: any;
  language: 'en' | 'ar';
  isOwner: boolean;
  permitSpeak: (id: string) => void;
  forceMute: (id: string) => void;
}

function GlobalSearchView({ user, onCall, onBack, onJoinRoom }: { user: User, onCall: (targetId: string) => void, onBack: () => void, onJoinRoom: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [roomResults, setRoomResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const t = TRANSLATIONS[user.language];

  const handleSearch = async () => {
    if (!query.trim()) return;
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
      if (userData.length > 0) setSelectedUser(userData[0]);
      else setSelectedUser(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm p-0 md:p-4">
      <motion.div 
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl theme-bg-panel backdrop-blur-md theme-border border rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[90vh] md:h-[85vh]"
      >
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-3 mb-1 md:hidden" />
        <div className="p-4 md:p-6 border-b theme-border flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:opacity-80 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 theme-text-main" />
            </button>
            <h1 className="text-xl font-bold theme-text-main">{t.globalSearch}</h1>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className={`absolute ${user.language === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 theme-text-sub opacity-50`} />
              <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={t.searchUser}
                className={`w-full theme-bg-main border theme-border rounded-xl ${user.language === 'ar' ? 'pr-10 pl-10' : 'pl-10 pr-10'} py-2.5 theme-text-main outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all`}
              />
              {query && (
                <button 
                  onClick={() => { setQuery(''); setResults([]); setRoomResults([]); setSelectedUser(null); }}
                  className={`absolute top-1/2 -translate-y-1/2 ${user.language === 'ar' ? 'left-3' : 'right-3'} p-1 hover:bg-white/10 rounded-full transition-colors`}
                >
                  <X className="w-3 h-3 theme-text-sub" />
                </button>
              )}
              {loading && <div className={`absolute top-1/2 -translate-y-1/2 ${user.language === 'ar' ? 'left-8' : 'right-8'} animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600`}></div>}
            </div>
            <button 
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">{t.search}</span>
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Results List */}
          <div className="w-full md:w-1/2 border-b md:border-b-0 md:border-r theme-border overflow-y-auto p-4 space-y-4">
            {!loading && results.length === 0 && roomResults.length === 0 && query.trim() && (
              <div className="flex flex-col items-center justify-center h-full opacity-50 space-y-2">
                <Search className="w-8 h-8" />
                <p className="text-sm font-medium">{t.noUsers}</p>
              </div>
            )}
            
            {results.length > 0 && (
              <div className="space-y-2">
                <div className="px-3 py-1 text-[10px] font-bold theme-text-sub uppercase tracking-widest">{t.allUsers}</div>
                {results.map((u: any) => (
                  <button 
                    key={u.userId}
                    onClick={() => setSelectedUser(u)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${selectedUser?.userId === u.userId ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'hover:bg-white/5 theme-text-main'}`}
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
                      <div className={`text-xs ${selectedUser?.userId === u.userId ? 'text-white/70' : 'theme-text-sub'}`}>@{u.username}</div>
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
                        <Globe className="w-5 h-5 text-indigo-500" />
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

            {!loading && results.length === 0 && roomResults.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full py-20 opacity-40 space-y-4">
                <Search className="w-12 h-12" />
                <p className="text-sm font-medium">{query.trim() ? t.noUsers : "Type to search users or rooms..."}</p>
              </div>
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
                    onClick={() => onCall(selectedUser.userId)}
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

const PeerVideo: React.FC<PeerVideoProps> = ({ peer, onClick, onMaximize, t, language, isOwner, permitSpeak, forceMute }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isSpeaking = useAudioActivity(peer.stream || null, !peer.isMuted);

  useEffect(() => {
    if (!videoRef.current || !peer.stream) return;
    videoRef.current.srcObject = peer.stream;
    videoRef.current.play().catch(() => {
      console.warn("Peer video play blocked");
    });
  }, [peer.stream]);

  return (
    <div 
      className={`video-container group transition-all duration-500 border-2 ${
        isSpeaking ? 'border-[#5e5ce6] shadow-2xl shadow-[#5e5ce6]/20 scale-[1.02]' : 'border-transparent'
      }`}
    >
      <div className="w-full h-full relative cursor-pointer" onClick={onClick}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-cover ${!peer.camOn ? 'hidden' : ''}`}
        />
        {!peer.camOn && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#111119]">
            <div className="w-40 h-40 rounded-full bg-[#1c1b29] flex items-center justify-center border-2 border-white/5 overflow-hidden shrink-0">
              {peer.avatar ? (
                <img src={peer.avatar} className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl font-black bg-[#5e5ce6]/10 text-[#5e5ce6]">
                  {peer.displayName[0].toUpperCase()}
                </div>
              )}
            </div>
          </div>
        )}
        <div className={`absolute top-4 ${language === 'ar' ? 'left-4' : 'right-4'} flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30`}>
          <button 
            onClick={(e) => { e.stopPropagation(); onMaximize(); }}
            className="p-2.5 bg-black/40 backdrop-blur-md text-white rounded-xl border border-white/10 hover:bg-white/10"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          
          {isOwner && (
            <button 
              onClick={(e) => { e.stopPropagation(); peer.isMuted ? permitSpeak(peer.userId) : forceMute(peer.userId); }}
              className={`p-2.5 backdrop-blur-md text-white rounded-xl border border-white/10 ${peer.isMuted ? 'bg-emerald-600/60 hover:bg-emerald-600' : 'bg-rose-600/60 hover:bg-rose-600'}`}
            >
              {peer.isMuted ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>
          )}
        </div>
        
        <div className={`absolute bottom-4 ${language === 'ar' ? 'right-4' : 'left-4'} flex items-center gap-2.5 px-3 py-1.5 rounded-[14px] bg-black/60 backdrop-blur-md border border-white/10 shadow-lg`}>
          <div className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
          <span className="text-[10px] font-bold text-white tracking-wide">{peer.displayName}</span>
          {peer.isMuted && <MicOff className="w-3 h-3 text-rose-500 ml-1" />}
        </div>
      </div>
    </div>
  );
};

const SpotlightPeerVideo: React.FC<{ peer: Peer, onMinimize: () => void, t: any, language: 'en' | 'ar', isOwner: boolean, permitSpeak: (id: string) => void, forceMute: (id: string) => void }> = ({ peer, onMinimize, t, language, isOwner, permitSpeak, forceMute }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isSpeaking = useAudioActivity(peer.stream || null, !peer.isMuted);

  useEffect(() => {
    if (!videoRef.current || !peer.stream) return;
    videoRef.current.srcObject = peer.stream;
    videoRef.current.play().catch(() => {
      console.warn("Spotlight peer video play blocked");
    });
  }, [peer.stream]);

  return (
    <div className={`w-full h-full relative border-4 group transition-colors duration-300 ${isSpeaking ? 'border-emerald-500' : peer.isMuted ? 'border-rose-500' : 'border-transparent'}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`w-full h-full object-contain ${!peer.camOn ? 'hidden' : ''}`}
      />
      {!peer.camOn && (
        <div className="absolute inset-0 flex items-center justify-center theme-bg-main">
          <div className="w-64 h-64 rounded-full theme-bg-panel flex items-center justify-center text-8xl font-black theme-text-sub overflow-hidden border-4 theme-border shrink-0">
            {peer.avatar ? (
              <img src={peer.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#5e5ce6]/10 text-[#5e5ce6]">
                {peer.displayName[0].toUpperCase()}
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className={`absolute top-6 ${language === 'ar' ? 'left-6 text-left' : 'right-6 text-right'} flex items-center gap-3 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300`}>
        <button 
          onClick={(e) => { e.stopPropagation(); onMinimize(); }}
          className="p-3 bg-black/40 backdrop-blur-xl text-white rounded-2xl hover:bg-white/10 transition-all border border-white/10 shadow-2xl group/min"
        >
          <Minimize2 className="w-6 h-6 group-hover/min:scale-110 transition-transform" />
        </button>

        {isOwner && (
          <button 
            onClick={(e) => { e.stopPropagation(); peer.isMuted ? permitSpeak(peer.userId) : forceMute(peer.userId); }}
            className={`p-3 backdrop-blur-xl text-white rounded-2xl transition-all border border-white/10 shadow-2xl ${peer.isMuted ? 'bg-emerald-600/60 hover:bg-emerald-600' : 'bg-rose-600/60 hover:bg-rose-600'}`}
            title={peer.isMuted ? t.permitSpeak : t.muteAll}
          >
            {peer.isMuted ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </button>
        )}
      </div>

      <div className={`absolute bottom-6 ${language === 'ar' ? 'right-6 text-right' : 'left-6 text-left'} flex items-center gap-4 px-6 py-3 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl`}>
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
    if (!videoRef.current || !peer.stream) return;
    videoRef.current.srcObject = peer.stream;
    videoRef.current.play().catch(() => {
      console.warn("Mini peer video play blocked");
    });
  }, [peer.stream]);

  return (
    <div className="w-full h-full relative">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`w-full h-full object-cover pointer-events-none ${!peer.camOn ? 'hidden' : ''}`}
      />
      {!peer.camOn && (
        <div className="absolute inset-0 flex items-center justify-center theme-bg-main">
          <div className="w-12 h-12 rounded-full theme-bg-panel flex items-center justify-center text-lg font-bold theme-text-sub overflow-hidden border theme-border">
            {peer.avatar ? (
              <img src={peer.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#5e5ce6]/10 text-[#5e5ce6]">
                {peer.displayName[0].toUpperCase()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
