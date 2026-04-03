// سكربت تحديث بيانات الأدمن (إيميل + كلمة مرور)
// الاستخدام:
//   node update-admin.js
//
// المتغيرات المطلوبة:
//   FIREBASE_API_KEY        - مفتاح Firebase API
//   OLD_EMAIL               - الإيميل الحالي (مثل admin@balqarn.app)
//   OLD_PASSWORD            - كلمة المرور الحالية
//   NEW_EMAIL               - الإيميل الجديد (اختياري - إذا ما حطيته يبقى القديم)
//   NEW_PASSWORD            - كلمة المرور الجديدة (اختياري - إذا ما حطيته تبقى القديمة)
//
// مثال:
//   FIREBASE_API_KEY=AIzaSy... OLD_EMAIL=admin@balqarn.app OLD_PASSWORD=OldPass123 NEW_EMAIL=mohammed@gmail.com NEW_PASSWORD=NewSecure@2026 node update-admin.js

const https = require('https');

const API_KEY = process.env.FIREBASE_API_KEY;
const OLD_EMAIL = process.env.OLD_EMAIL;
const OLD_PASSWORD = process.env.OLD_PASSWORD;
const NEW_EMAIL = process.env.NEW_EMAIL || '';
const NEW_PASSWORD = process.env.NEW_PASSWORD || '';

if (!API_KEY || !OLD_EMAIL || !OLD_PASSWORD) {
  console.error('❌ المتغيرات المطلوبة:');
  console.error('   FIREBASE_API_KEY, OLD_EMAIL, OLD_PASSWORD');
  console.error('');
  console.error('مثال:');
  console.error('   FIREBASE_API_KEY=xxx OLD_EMAIL=admin@balqarn.app OLD_PASSWORD=xxx NEW_EMAIL=new@email.com NEW_PASSWORD=xxx node update-admin.js');
  process.exit(1);
}

if (!NEW_EMAIL && !NEW_PASSWORD) {
  console.error('❌ يجب تحديد NEW_EMAIL أو NEW_PASSWORD (أو كلاهما)');
  process.exit(1);
}

function request(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: 'identitytoolkit.googleapis.com',
      path: `${path}?key=${API_KEY}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => {
        try { resolve(JSON.parse(chunks)); }
        catch { resolve(chunks); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('━━━ تحديث بيانات المستخدم ━━━\n');

  // الخطوة 1: تسجيل الدخول بالبيانات الحالية
  console.log('1. جاري تسجيل الدخول بـ ' + OLD_EMAIL + '...');
  const login = await request('/v1/accounts:signInWithPassword', {
    email: OLD_EMAIL,
    password: OLD_PASSWORD,
    returnSecureToken: true
  });

  if (login.error) {
    console.error('❌ فشل تسجيل الدخول:', login.error.message);
    process.exit(1);
  }
  console.log('   ✅ تم تسجيل الدخول - UID:', login.localId);

  // الخطوة 2: تحديث البيانات
  const updateBody = { idToken: login.idToken, returnSecureToken: true };
  if (NEW_EMAIL) updateBody.email = NEW_EMAIL;
  if (NEW_PASSWORD) updateBody.password = NEW_PASSWORD;

  console.log('2. جاري التحديث...');
  if (NEW_EMAIL) console.log('   الإيميل الجديد:', NEW_EMAIL);
  if (NEW_PASSWORD) console.log('   كلمة المرور: ✅ سيتم تغييرها');

  const update = await request('/v1/accounts:update', updateBody);

  if (update.error) {
    console.error('❌ فشل التحديث:', update.error.message);
    process.exit(1);
  }

  console.log('\n╔═══════════════════════════════════╗');
  console.log('║  ✅ تم التحديث بنجاح!            ║');
  console.log('╠═══════════════════════════════════╣');
  console.log('║  الإيميل: ' + (NEW_EMAIL || OLD_EMAIL));
  console.log('║  كلمة المرور: تم تغييرها         ║');
  console.log('╚═══════════════════════════════════╝');

  // الخطوة 3: إذا تغير الإيميل، نحتاج نحدث وثيقة المستخدم في Firestore
  if (NEW_EMAIL) {
    console.log('\n⚠️  مهم: الإيميل تغير في Authentication.');
    console.log('   تحتاج تحدّث حقل email في Firestore يدوياً:');
    console.log('   Firestore > users > ' + login.localId + ' > email = ' + NEW_EMAIL);
  }
}

main().catch(e => console.error('خطأ:', e));
