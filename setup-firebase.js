const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.FIREBASE_API_KEY;
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'balqarn-dashboard';

if (!API_KEY) {
  console.error('❌ يجب تعيين FIREBASE_API_KEY كمتغير بيئة');
  console.error('   مثال: FIREBASE_API_KEY=xxx BALQARN_PASS_RB=xxx ... node setup-firebase.js');
  process.exit(1);
}

// ─── HTTP Helper ───
function request(hostname, path, method, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({ hostname, path, method, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, res => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(chunks) }); }
        catch { resolve({ status: res.statusCode, data: chunks }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ─── Firebase Auth: إنشاء مستخدم ───
async function createUser(email, password) {
  const res = await request('identitytoolkit.googleapis.com',
    `/v1/accounts:signUp?key=${API_KEY}`, 'POST',
    { email, password, returnSecureToken: true });
  if (res.data.error) throw new Error(res.data.error.message);
  return { uid: res.data.localId, idToken: res.data.idToken };
}

// ─── Firebase Auth: تسجيل الدخول ───
async function signIn(email, password) {
  const res = await request('identitytoolkit.googleapis.com',
    `/v1/accounts:signInWithPassword?key=${API_KEY}`, 'POST',
    { email, password, returnSecureToken: true });
  if (res.data.error) throw new Error(res.data.error.message);
  return { uid: res.data.localId, idToken: res.data.idToken };
}

// ─── Firestore: كتابة وثيقة ───
async function writeDoc(collectionName, docId, fields, idToken) {
  const firestoreFields = {};
  for (const [key, val] of Object.entries(fields)) {
    if (typeof val === 'number') {
      firestoreFields[key] = Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
    } else {
      firestoreFields[key] = { stringValue: String(val ?? '') };
    }
  }
  const res = await request('firestore.googleapis.com',
    `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionName}/${docId}?key=${API_KEY}`,
    'PATCH',
    { fields: firestoreFields },
  );
  // Add auth header
  return res;
}

// Firestore with auth token
function writeDocAuth(collectionName, docId, fields, idToken) {
  return new Promise((resolve, reject) => {
    const firestoreFields = {};
    for (const [key, val] of Object.entries(fields)) {
      if (typeof val === 'number') {
        firestoreFields[key] = Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
      } else {
        firestoreFields[key] = { stringValue: String(val ?? '') };
      }
    }
    const body = JSON.stringify({ fields: firestoreFields });
    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionName}/${docId}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `Bearer ${idToken}`
      }
    }, res => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(chunks) }); }
        catch { resolve({ status: res.statusCode, data: chunks }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── المستخدمون ───
// كلمات المرور تُمرر عبر متغيرات البيئة (environment variables)
// مثال: BALQARN_PASS_RB=xxx BALQARN_PASS_MS=xxx BALQARN_PASS_MM=xxx BALQARN_PASS_ADMIN=xxx node setup-firebase.js
const USERS = [
  { email: 'rb@balqarn.app', pass: process.env.BALQARN_PASS_RB, name: 'رئيس البلدية', welcome: 'مرحباً رئيس بلدية بلقرن', role: 'viewer' },
  { email: 'ms@balqarn.app', pass: process.env.BALQARN_PASS_MS, name: 'مساعد رئيس البلدية', welcome: 'مرحباً مساعد رئيس بلدية بلقرن', role: 'viewer' },
  { email: 'mm@balqarn.app', pass: process.env.BALQARN_PASS_MM, name: 'مدير المشاريع', welcome: 'مرحباً مدير إدارة المشاريع ببلقرن', role: 'viewer' },
  { email: 'admin@balqarn.app', pass: process.env.BALQARN_PASS_ADMIN, name: 'المهندس محمد', welcome: 'مرحباً م. محمد مرعي القرني', role: 'admin' }
];

const missingPasswords = USERS.filter(u => !u.pass).map(u => u.email);
if (missingPasswords.length > 0) {
  console.error('❌ كلمات المرور مطلوبة للمستخدمين التالية:', missingPasswords.join(', '));
  console.error('   مثال: BALQARN_PASS_RB=xxx BALQARN_PASS_MS=xxx BALQARN_PASS_MM=xxx BALQARN_PASS_ADMIN=xxx node setup-firebase.js');
  process.exit(1);
}

// ─── المشاريع ───
// بيانات المشاريع تُقرأ من ملف خارجي (projects-data.json) لحماية البيانات الشخصية
const projectsFile = path.join(__dirname, 'projects-data.json');
if (!fs.existsSync(projectsFile)) {
  console.error('❌ ملف بيانات المشاريع غير موجود: projects-data.json');
  console.error('   أنشئ الملف بصيغة JSON تحتوي على مصفوفة المشاريع');
  process.exit(1);
}
const PROJECTS = JSON.parse(fs.readFileSync(projectsFile, 'utf-8'));

// تم نقل بيانات المشاريع إلى ملف projects-data.json المنفصل

// ─── التنفيذ ───
async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  تهيئة بيانات Firebase - بلدية بلقرن  ║');
  console.log('╚════════════════════════════════════════╝\n');

  // الخطوة 1: إنشاء المستخدمين
  console.log('━━━ الخطوة 1: إنشاء المستخدمين ━━━');
  const userUids = {};
  for (const u of USERS) {
    try {
      const result = await createUser(u.email, u.pass);
      userUids[u.email] = result;
      console.log(`  ✅ ${u.email} (${u.role}) - UID: ${result.uid}`);
    } catch (e) {
      if (e.message === 'EMAIL_EXISTS') {
        console.log(`  ⚠️  ${u.email} موجود مسبقاً - جاري تسجيل الدخول...`);
        try {
          const result = await signIn(u.email, u.pass);
          userUids[u.email] = result;
          console.log(`  ✅ ${u.email} تم تسجيل الدخول - UID: ${result.uid}`);
        } catch (e2) {
          console.log(`  ❌ ${u.email}: ${e2.message}`);
        }
      } else {
        console.log(`  ❌ ${u.email}: ${e.message}`);
      }
    }
  }

  // الخطوة 2: إنشاء وثائق المستخدمين في Firestore
  console.log('\n━━━ الخطوة 2: حفظ بيانات المستخدمين في Firestore ━━━');
  // First we need to temporarily allow writes - use admin token
  // We need an admin token for Firestore writes
  let adminToken = null;
  if (userUids['admin@balqarn.app']) {
    adminToken = userUids['admin@balqarn.app'].idToken;
  }

  // Since security rules require admin role but we haven't set it yet,
  // we'll write user docs first (rules might block this).
  // If blocked, user needs to temporarily set Firestore rules to allow writes.
  for (const u of USERS) {
    const uidData = userUids[u.email];
    if (!uidData) { console.log(`  ⏭️  تخطي ${u.email} - لم يتم إنشاؤه`); continue; }
    try {
      const res = await writeDocAuth('users', uidData.uid,
        { name: u.name, welcome: u.welcome, role: u.role, email: u.email },
        uidData.idToken);
      if (res.status === 200) {
        console.log(`  ✅ ${u.email} -> users/${uidData.uid}`);
      } else {
        console.log(`  ❌ ${u.email}: ${res.status} - ${JSON.stringify(res.data?.error?.message || res.data)}`);
        if (res.status === 403) {
          console.log('  ⚠️  الـ Security Rules تمنع الكتابة. نحتاج نعدلها مؤقتاً...');
          console.log('  📋 روح Firebase Console > Firestore > Rules وخلها:');
          console.log('     rules_version = "2";');
          console.log('     service cloud.firestore { match /databases/{db}/documents { match /{doc=**} { allow read, write: if request.auth != null; } } }');
          console.log('  ثم أعد تشغيل السكربت.');
          return;
        }
      }
    } catch (e) {
      console.log(`  ❌ ${u.email}: ${e.message}`);
    }
  }

  // الخطوة 3: رفع المشاريع
  console.log('\n━━━ الخطوة 3: رفع بيانات المشاريع (12 مشروع) ━━━');
  if (!adminToken) {
    console.log('  ❌ لا يوجد token للأدمن');
    return;
  }
  for (const p of PROJECTS) {
    try {
      const res = await writeDocAuth('projects', String(p.id), p, adminToken);
      if (res.status === 200) {
        console.log(`  ✅ [${p.id}] ${p.name}`);
      } else {
        console.log(`  ❌ [${p.id}] ${p.name}: ${res.status}`);
      }
    } catch (e) {
      console.log(`  ❌ [${p.id}] ${p.name}: ${e.message}`);
    }
  }

  console.log('\n╔═══════════════════════════════════╗');
  console.log('║  ✅ انتهت التهيئة بنجاح!         ║');
  console.log('╠═══════════════════════════════════╣');
  console.log('║  تم إنشاء الحسابات بنجاح         ║');
  console.log('║  غيّر كلمات المرور من Firebase Console ║');
  console.log('╚═══════════════════════════════════╝');
}

main().catch(e => console.error('خطأ:', e));
