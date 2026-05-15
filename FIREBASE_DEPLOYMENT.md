# MyRoomer - Firebase Deployment Guide

## نظرة عامة
تم تحويل التطبيق للعمل مع Firebase Functions و Firebase Hosting.

## الخطوات للنشر:

### 1. تثبيت Firebase CLI
```bash
npm install -g firebase-tools
```

### 2. تسجيل الدخول إلى Firebase
```bash
firebase login
```

### 3. اختيار المشروع
```bash
firebase use gen-lang-client-0360431546
```

### 4. بناء التطبيق
```bash
npm run build
```

### 5. نشر Firebase Functions
```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

### 6. نشر الواجهة الأمامية
```bash
firebase deploy --only hosting
```

### 7. نشر كل شيء
```bash
firebase deploy
```

## التغييرات المطلوبة:

### WebRTC Hook
- تم تحويل `useWebRTC.ts` لاستخدام Firebase Realtime Database بدلاً من WebSocket
- الرسائل المباشرة تعمل عبر Firebase Realtime Database

### الخادم الخلفي
- تم تحويل `server/index.ts` إلى Firebase Functions
- استخدام Firebase Admin SDK للتخزين

### التكوين
- `firebase.json`: تكوين النشر
- `functions/package.json`: dependencies للـ Functions

## المشاكل المعروفة:
- WebRTC لا يزال يعمل محلياً (P2P)
- الرسائل المباشرة تعمل عبر Firebase
- WebSocket تم استبداله بـ Firebase Realtime Database

## الاختبار:
```bash
# تشغيل محلياً
firebase emulators:start
```