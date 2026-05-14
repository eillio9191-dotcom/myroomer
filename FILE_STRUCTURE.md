# 📁 مسارات وملفات تطبيق MyRoomer

## 📋 جدول المحتويات

- [🏠 المجلد الرئيسي](#-المجلد-الرئيسي)
- [📂 الملفات المصدرية](#-الملفات-المصدرية)
- [🖥️ ملفات السيرفر](#-ملفات-السيرفر)
- [📄 ملفات التكوين](#-ملفات-التكوين)
- [📚 ملفات التوثيق](#-ملفات-التثيق)
- [🗂️ الملفات الثابتة](#-الملفات-الثابتة)
- [💾 ملفات البيانات](#-ملفات-البيانات)
- [🔧 ملفات البناء](#-ملفات-البناء)

---

## 🏠 المجلد الرئيسي

```
c:\Users\eilli\Desktop\myroomer\
```

---

## 📂 الملفات المصدرية

### 🎨 Frontend Source

```
src/
├── 📄 App.tsx                    # المكون الرئيسي للتطبيق (124,640 bytes)
├── 📄 RoomView.tsx               # واجهة الغرف (6,084 bytes)
├── 📄 index.css                  # الأنماط العامة (540 bytes)
├── 📄 main.tsx                  # نقطة الدخول الرئيسية (231 bytes)
└── 📁 hooks/                     # الـ Hooks المخصصة
    ├── 📄 useAudioActivity.ts    # WebRTC Audio Activity Hook (2,069 bytes)
    │   ├── 🎯 isSpeaking: حالة التحدث
    │   ├── 🎙️ analyserRef: مرجع محلل الصوت
    │   └── ⚡ animationFrameRef: مرجع إطار الرسوم المتحركة
    └── 📄 useWebRTC.ts          # WebRTC Connection Hook (30,281 bytes)
        ├── 🔗 Peer interface: تعريف بيانات النظير
        ├── 📹 stream: دفق الفيديو والصوت
        ├── 🔌 connection: اتصال WebRTC
        ├── 🔇 isMuted: حالة كتم الصوت
        └── 🎛️ إدارة الاتصالات الصوتية والمرئية
```

### 🖥️ Backend Source

```
server/
├── 📁 handlers/                   # معالجات الطلبات
│   ├── 📄 call.handler.ts        # معالج المكالمات المباشرة (1,061 bytes)
│   │   ├── � handleDirectCall(): معالجة المكالمات المباشرة بين المستخدمين
│   │   ├── 👥 استدعاءات: UserManager, SocketManager, safeSend
│   │   └── 🔗 يعتمد على: WebSocket للاتصال الفوري
│   ├── �📄 chat.handler.ts        # معالج الرسائل والدردشة (587 bytes)
│   │   ├── � handleChat(): معالجة الرسائل النصية
│   │   ├── 📝 المتغيرات: text, senderId, username, displayName, avatar, timestamp
│   │   └── 🔗 يعتمد على: RoomManager, safeSend
│   ├── �📄 join.handler.ts        # معالج الانضمام للغرف (4,865 bytes)
│   │   ├── 🚪 handleJoin(): معالجة طلبات الانضمام
│   │   ├── 📦 استدعاءات: WebSocket, RoomManager, UserManager, PersistenceService
│   │   └── 🔗 يعتمد على: التحقق من الصلاحيات والسعة
│   ├── 📄 lobby.handler.ts       # معالج اللوبي والطلبات (1,648 bytes)
│   │   ├── 🎪 handleLobbyApprove(): موافقة على طلبات اللوبي
│   │   ├── � handleLobbyReject(): رفض طلبات اللوبي
│   │   ├── 📦 استدعاءات: RoomManager, SocketManager, RoomActorManager
│   │   └── 🔗 يعتمد على: إدارة قائمة الانتظار
│   ├── �📄 message.router.ts      # موجه الرسائل الرئيسي (2,619 bytes)
│   │   ├── 📦 استيراد جميع معالجات: join, chat, signal, lobby, owner
│   │   ├── � handleKickUser(): طرد المستخدمين
│   │   ├── 🗑️ handleDeleteRoom(): حذف الغرف
│   │   ├── 📝 handleUpdateRoomTag(): تحديث تصنيف الغرف
│   │   └── ⚙️ handleRoomSettings(): تحديث إعدادات الغرف
│   ├── �📄 owner.handler.ts       # معالج صلاحيات مالك الغرفة (3,897 bytes)
│   │   ├── � isOwner(): التحقق من ملكية الغرفة
│   │   ├── 🚪 handleKickUser(): طرد المستخدمين
│   │   ├── 🗑️ handleDeleteRoom(): حذف الغرف
│   │   ├── 📝 handleUpdateRoomTag(): تحديث تصنيف الغرف
│   │   ├── ⚙️ handleRoomSettings(): تحديث إعدادات الغرف
│   │   └── 📦 استدعاءات: RoomManager, SocketManager, PersistenceService, SnapshotManager
│   ├── �📄 profile.handler.ts     # معالج الملف الشخصي (1,930 bytes)
│   │   ├── 👤 handleProfileUpdate(): تحديث بيانات المستخدم
│   │   ├── 📦 استدعاءات: RoomManager, SocketManager, safeSend
│   │   └── � يعتمد على: WebSocket للتحديثات الفورية
│   └── �📄 signal.handler.ts      # معالج إشارات WebRTC (588 bytes)
│       ├── 📡 handleSignal(): معالجة إشارات WebRTC
│       ├── 📦 استدعاءات: RoomManager, SocketManager, safeSend
│       └── 🔗 يعتمد على: WebRTC peer connections
├── 📁 managers/                   # المديرون
│   ├── 📄 roomManager.ts         # مدير الغرف (3,639 bytes)
│   ├── 📄 socketManager.ts       # مدير السوكيت (1,721 bytes)
│   └── 📄 userManager.ts        # مدير المستخدمين (2,498 bytes)
├── 📁 services/                   # الخدمات الأساسية
│   ├── 📄 eventBus.service.ts    # خدمة الحافلات (984 bytes)
│   ├── 📄 heartbeat.service.ts   # خدمة النبض (3,517 bytes)
│   ├── 📄 persistence.service.ts # خدمة الاستمرارية (907 bytes)
│   ├── 📄 rateLimiter.service.ts # خدمة تحديد المعدل (3,242 bytes)
│   ├── 📄 roomActor.service.ts   # خدمة ممثل الغرف (2,307 bytes)
│   ├── 📄 roomActorManager.service.ts # مدير ممثلي الغرف (1,906 bytes)
│   ├── 📄 roomEventHandler.service.ts # معالج أحداث الغرف (3,894 bytes)
│   ├── 📄 saveQueue.service.ts  # خدمة قائمة الحفظ (206 bytes)
│   └── 📄 snapshotManager.service.ts # مدير اللقطات (2,287 bytes)
├── 📁 types/                      # أنواع TypeScript
│   ├── 📄 message.types.ts      # أنواع الرسائل (752 bytes)
│   ├── 📄 room.types.ts         # أنواع الغرف (173 bytes)
│   └── 📄 socket.types.ts       # أنواع السوكيت (242 bytes)
├── 📁 utils/                      # الأدوات المساعدة
│   └── 📄 logger.ts             # أداة التسجيل
├── 📄 index.ts                    # نقطة دخول السيرفر (2,361 bytes)
├── 📄 http.ts                     # إعدادات HTTP (6,203 bytes)
└── 📄 websocket.ts                # منطق WebSocket (2,834 bytes)
```

---

## 📄 ملفات التكوين

### 📦 إدارة الحزم

```
📄 package.json                     # معلومات المشروع والاعتماديات (1,045 bytes)
📄 package-lock.json               # قفل الاعتماديات (188,875 bytes)
```

### ⚙️ إعدادات TypeScript

```
📄 tsconfig.json                   # إعدادات TypeScript العامة (220 bytes)
📄 tsconfig.server.json            # إعدادات TypeScript للسيرفر (254 bytes)
```

### 🛠️ إعدادات البناء

```
📄 vite.config.ts                  # إعدادات Vite (705 bytes)
```

### 🔐 متغيرات البيئة

```
📄 .env.example                    # قالب متغيرات البيئة (2,148 bytes)
📄 .env.local                      # متغيرات البيئة المحلية (1,017 bytes)
```

### 🚫 إعدادات Git

```
📄 .gitignore                     # الملفات المتجاهلة في Git (73 bytes)
```

---

## 📚 ملفات التوثيق

```
📄 README.md                      # التوثيق الرئيسي (6,616 bytes)
📄 ARCHITECTURE.md                # توثيق الهيكلية (23,537 bytes)
📄 FEATURES.md                    # توثيق المميزات (25,862 bytes)
```

---

## 🗂️ الملفات الثابتة

```
public/
├── 📄 manifest.json                 # بيانات PWA (575 bytes)
└── 📄 sw.js                        # Service Worker (463 bytes)
```

---

## 💾 ملفات البيانات

```
📄 data.json                      # بيانات التطبيق (491 bytes)
📄 metadata.json                  # بيانات وصفية للمشروع (215 bytes)
```

---

## 🔧 ملفات البناء

```
index.html                     # قالب HTML (1,081 bytes)
dist/                          # مجلد البناء (فارغ حالياً)
```

---

## ملفات إضافية

```
roomService.ts                 # خدمة الغرف القديمة (3,315 bytes)
│   ├── RoomData interface: تعريف بيانات الغرف
│   ├── RoomService class: خدمة إدارة الغرف
│   ├── loadRoomData(): تحميل بيانات الغرف من data.json
│   ├── saveRoomData(): حفظ بيانات الغرف إلى data.json
│   ├── createRoom(): إنشاء غرفة جديدة
│   ├── deleteRoom(): حذف غرفة
│   ├── roomExists(): التحقق من وجود الغرفة
│   ├── isOwner(): التحقق من ملكية الغرفة
│   ├── canKick(): التحقق من صلاحية الطرد
│   ├── canModifySettings(): التحقق من صلاحية تعديل الإعدادات
│   ├── canDeleteRoom(): التحقق من صلاحية حذف الغرفة
│   ├── getRoomTag(): الحصول على تصنيف الغرفة
│   ├── updateRoomTag(): تحديث تصنيف الغرفة
│   ├── getRoomSettings(): الحصول على إعدادات الغرفة
│   ├── updateRoomSettings(): تحديث إعدادات الغرفة
│   ├── getOwnedRooms(): الحصول على غرف المستخدم
│   ├── getAllRoomsForAdmin(): الحصول على جميع الغرف للإدارة
│   ├── getRoomOwner(): الحصول على مالك الغرفة
│   ├── setOwner(): تعيين مالك الغرفة
│   └── getRoomSearchResults(): الحصول على نتائج بحث الغرف
server.old.ts                 # نسخة قديمة من السيرفر (26,456 bytes)
```

---

## إحصائيات الملفات

### 📈 حجم الملفات

| الملف | الحجم بالبايت | الحجم بالKB | الوصف |
|-------|---------------|-------------|--------|
| App.tsx | 124,640 | 121.7 | المكون الرئيسي |
| server.old.ts | 26,456 | 25.8 | السيرفر القديم |
| package-lock.json | 188,875 | 184.4 | قفل الاعتماديات |
| ARCHITECTURE.md | 23,537 | 23.0 | توثيق الهيكلية |
| FEATURES.md | 25,862 | 25.3 | توثيق المميزات |
| README.md | 6,616 | 6.5 | التوثيق الرئيسي |
| join.handler.ts | 4,865 | 4.8 | معالج الانضمام |
| owner.handler.ts | 3,897 | 3.8 | معالج المالك |
| roomManager.ts | 3,639 | 3.6 | مدير الغرف |
| heartbeat.service.ts | 3,517 | 3.4 | خدمة النبض |
| rateLimiter.service.ts | 3,242 | 3.2 | خدمة تحديد المعدل |
| roomEventHandler.service.ts | 3,894 | 3.8 | معالج أحداث الغرف |
| snapshotManager.service.ts | 2,287 | 2.2 | مدير اللقطات |
| roomActor.service.ts | 2,307 | 2.3 | خدمة ممثل الغرف |
| roomActorManager.service.ts | 1,906 | 1.9 | مدير ممثلي الغرف |
| message.router.ts | 2,619 | 2.6 | راوتر الرسائل |
| profile.handler.ts | 1,930 | 1.9 | معالج الملف الشخصي |
| lobby.handler.ts | 1,648 | 1.6 | معالج اللوبي |
| call.handler.ts | 1,061 | 1.0 | معالج المكالمات |
| http.ts | 6,203 | 6.1 | إعدادات HTTP |
| websocket.ts | 2,834 | 2.8 | منطق WebSocket |
| index.ts | 2,361 | 2.3 | نقطة دخول السيرفر |
| userManager.ts | 2,498 | 2.4 | مدير المستخدمين |
| roomService.ts | 3,315 | 3.2 | خدمة الغرف |
| .env.example | 2,148 | 2.1 | قالب متغيرات البيئة |
| .env.local | 1,017 | 1.0 | متغيرات البيئة المحلية |
| vite.config.ts | 705 | 0.7 | إعدادات Vite |
| metadata.json | 215 | 0.2 | بيانات وصفية |
| data.json | 491 | 0.5 | بيانات التطبيق |
| index.html | 1,081 | 1.1 | قالب HTML |
| manifest.json | 575 | 0.6 | بيانات PWA |
| sw.js | 463 | 0.5 | Service Worker |
| chat.handler.ts | 587 | 0.6 | معالج الدردشة |
| signal.handler.ts | 588 | 0.6 | معالج الإشارات |
| eventBus.service.ts | 984 | 1.0 | خدمة الحافلات |
| persistence.service.ts | 907 | 0.9 | خدمة الاستمرارية |
| saveQueue.service.ts | 206 | 0.2 | خدمة قائمة الحفظ |
| RoomView.tsx | 6,084 | 5.9 | واجهة الغرف |
| message.types.ts | 752 | 0.7 | أنواع الرسائل |
| room.types.ts | 173 | 0.2 | أنواع الغرف |
| socket.types.ts | 242 | 0.2 | أنواع السوكيت |
| main.tsx | 231 | 0.2 | نقطة الدخول |
| index.css | 540 | 0.5 | الأنماط العامة |
| tsconfig.json | 220 | 0.2 | إعدادات TypeScript |
| tsconfig.server.json | 254 | 0.2 | إعدادات TypeScript للسيرفر |
| .gitignore | 73 | 0.1 | الملفات المتجاهلة |

### 📂️ توزيع الملفات حسب النوع

| النوع | عدد الملفات | إجمالي الحجم |
|-------|---------------|---------------|
| ملفات TypeScript (.ts) | 20 | ~120 KB |
| ملفات TypeScript React (.tsx) | 2 | ~131 KB |
| ملفات CSS (.css) | 1 | ~0.5 KB |
| ملفات JSON (.json) | 6 | ~195 KB |
| ملفات JavaScript (.js) | 1 | ~0.5 KB |
| ملفات HTML (.html) | 1 | ~1 KB |
| ملفات الإعدادات | 6 | ~4 KB |
| ملفات التوثيق (.md) | 3 | ~56 KB |

### 🎯 أهم الملفات

1. **App.tsx** (124.6 KB) - المكون الرئيسي للتطبيق
2. **package-lock.json** (188.9 KB) - قفل الاعتماديات
3. **server.old.ts** (26.5 KB) - نسخة احتياطية من السيرفر
4. **ARCHITECTURE.md** (23.5 KB) - توثيق الهيكلية
5. **FEATURES.md** (25.9 KB) - توثيق المميزات

---

## 🗺️ المسارات الكاملة

### 🎯 المسارات النسبية من الجذر

```
myroomer/
├── src/App.tsx
├── src/RoomView.tsx
├── src/index.css
├── src/main.tsx
├── src/hooks/usePeer.ts
├── src/hooks/useWebSocket.ts
├── server/handlers/call.handler.ts
├── server/handlers/chat.handler.ts
├── server/handlers/join.handler.ts
├── server/handlers/lobby.handler.ts
├── server/handlers/message.router.ts
├── server/handlers/owner.handler.ts
├── server/handlers/profile.handler.ts
├── server/handlers/signal.handler.ts
├── server/managers/roomManager.ts
├── server/managers/socketManager.ts
├── server/managers/userManager.ts
├── server/services/eventBus.service.ts
├── server/services/heartbeat.service.ts
├── server/services/persistence.service.ts
├── server/services/rateLimiter.service.ts
├── server/services/roomActor.service.ts
├── server/services/roomActorManager.service.ts
├── server/services/roomEventHandler.service.ts
├── server/services/saveQueue.service.ts
├── server/services/snapshotManager.service.ts
├── server/types/message.types.ts
├── server/types/room.types.ts
├── server/types/socket.types.ts
├── server/utils/logger.ts
├── server/index.ts
├── server/http.ts
├── server/websocket.ts
├── public/manifest.json
├── public/sw.js
├── index.html
├── roomService.ts
├── server.old.ts
├── data.json
├── metadata.json
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsconfig.server.json
├── vite.config.ts
├── .env.example
├── .env.local
├── .gitignore
├── README.md
├── ARCHITECTURE.md
└── FEATURES.md
```

### 🖥️ المسارات المطلقة

```
c:\Users\eilli\Desktop\myroomer\src\App.tsx
c:\Users\eilli\Desktop\myroomer\src\RoomView.tsx
c:\Users\eilli\Desktop\myroomer\src\index.css
c:\Users\eilli\Desktop\myroomer\src\main.tsx
c:\Users\eilli\Desktop\myroomer\src\hooks\usePeer.ts
c:\Users\eilli\Desktop\myroomer\src\hooks\useWebSocket.ts
c:\Users\eilli\Desktop\myroomer\server\handlers\call.handler.ts
c:\Users\eilli\Desktop\myroomer\server\handlers\chat.handler.ts
c:\Users\eilli\Desktop\myroomer\server\handlers\join.handler.ts
c:\Users\eilli\Desktop\myroomer\server\handlers\lobby.handler.ts
c:\Users\eilli\Desktop\myroomer\server\handlers\message.router.ts
c:\Users\eilli\Desktop\myroomer\server\handlers\owner.handler.ts
c:\Users\eilli\Desktop\myroomer\server\handlers\profile.handler.ts
c:\Users\eilli\Desktop\myroomer\server\handlers\signal.handler.ts
c:\Users\eilli\Desktop\myroomer\server\managers\roomManager.ts
c:\Users\eilli\Desktop\myroomer\server\managers\socketManager.ts
c:\Users\eilli\Desktop\myroomer\server\managers\userManager.ts
c:\Users\eilli\Desktop\myroomer\server\services\eventBus.service.ts
c:\Users\eilli\Desktop\myroomer\server\services\heartbeat.service.ts
c:\Users\eilli\Desktop\myroomer\server\services\persistence.service.ts
c:\Users\eilli\Desktop\myroomer\server\services\rateLimiter.service.ts
c:\Users\eilli\Desktop\myroomer\server\services\roomActor.service.ts
c:\Users\eilli\Desktop\myroomer\server\services\roomActorManager.service.ts
c:\Users\eilli\Desktop\myroomer\server\services\roomEventHandler.service.ts
c:\Users\eilli\Desktop\myroomer\server\services\saveQueue.service.ts
c:\Users\eilli\Desktop\myroomer\server\services\snapshotManager.service.ts
c:\Users\eilli\Desktop\myroomer\server\types\message.types.ts
c:\Users\eilli\Desktop\myroomer\server\types\room.types.ts
c:\Users\eilli\Desktop\myroomer\server\types\socket.types.ts
c:\Users\eilli\Desktop\myroomer\server\utils\logger.ts
c:\Users\eilli\Desktop\myroomer\server\index.ts
c:\Users\eilli\Desktop\myroomer\server\http.ts
c:\Users\eilli\Desktop\myroomer\server\websocket.ts
c:\Users\eilli\Desktop\myroomer\public\manifest.json
c:\Users\eilli\Desktop\myroomer\public\sw.js
c:\Users\eilli\Desktop\myroomer\index.html
c:\Users\eilli\Desktop\myroomer\roomService.ts
c:\Users\eilli\Desktop\myroomer\server.old.ts
c:\Users\eilli\Desktop\myroomer\data.json
c:\Users\eilli\Desktop\myroomer\metadata.json
c:\Users\eilli\Desktop\myroomer\package.json
c:\Users\eilli\Desktop\myroomer\package-lock.json
c:\Users\eilli\Desktop\myroomer\tsconfig.json
c:\Users\eilli\Desktop\myroomer\tsconfig.server.json
c:\Users\eilli\Desktop\myroomer\vite.config.ts
c:\Users\eilli\Desktop\myroomer\.env.example
c:\Users\eilli\Desktop\myroomer\.env.local
c:\Users\eilli\Desktop\myroomer\.gitignore
c:\Users\eilli\Desktop\myroomer\README.md
c:\Users\eilli\Desktop\myroomer\ARCHITECTURE.md
c:\Users\eilli\Desktop\myroomer\FEATURES.md
```

---

## 🎯 الخلاصة

التطبيق MyRoomer يحتوي على:

- ✅ **56 ملفاً** إجمالياً
- ✅ **8 مجلدات** رئيسية
- ✅ **~540 KB** إجمالي حجم الملفات المصدرية
- ✅ **Frontend**: 3 ملفات TypeScript + 2 Hooks
- ✅ **Backend**: 28 ملفاً في 7 مجلدات فرعية
- ✅ **التكوين**: 6 ملفات إعدادات
- ✅ **التوثيق**: 3 ملفات Markdown
- ✅ **البيانات**: 2 ملفات JSON

جميع المسارات والملفات موثقة بدقة مع أحجامها وتصنيفها! 📁✨
