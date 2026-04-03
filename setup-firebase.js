const https = require('https');

const API_KEY = 'AIzaSyBfrpIEJ9AenB3eW7FGBflBbyc3O0KEfZ8';
const PROJECT_ID = 'balqarn-dashboard';

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
const USERS = [
  { email: 'rb@balqarn.app', pass: 'Balqarn@2026rb', name: 'رئيس البلدية', welcome: 'مرحباً رئيس بلدية بلقرن', role: 'viewer' },
  { email: 'ms@balqarn.app', pass: 'Balqarn@2026ms', name: 'مساعد رئيس البلدية', welcome: 'مرحباً مساعد رئيس بلدية بلقرن', role: 'viewer' },
  { email: 'mm@balqarn.app', pass: 'Balqarn@2026mm', name: 'مدير المشاريع', welcome: 'مرحباً مدير إدارة المشاريع ببلقرن', role: 'viewer' },
  { email: 'admin@balqarn.app', pass: 'Balqarn@2026admin', name: 'المهندس محمد', welcome: 'مرحباً م. محمد مرعي القرني', role: 'admin' }
];

// ─── المشاريع ───
const PROJECTS = [{"id":1,"name":"سفلتة مخططات المنح مرحلة ثانية","status":"stopped","status_raw":"متوقف","phase":"التنفيذ والاختبار","progress":94,"value":"9.87 م","value_num":9872474,"contractor":"خالد مشرف آل طاوي","supervisor":"سعود كونسلت","consultant":"م. السيد سالم الدسوقي","pm":"م. محمد جاري القرني","pm_email":"Mgsalq@ars.gov.sa","pm_phone":"0546889994","category":"سفلتة","budget_door":"الباب الرابع","contract_no":"019/001/000/408510000/3111311","project_no":"220839650704","duration_days":360,"extensions":"70 + 77 = 147","stops":0,"date_sign":"1446-01-01","date_site":"2024-08-18","date_end":"2025-08-13","date_end_adj":"","date_receive_primary":"","date_receive_final":"","date_updated":"2026-04-01","last_action":"المشروع متوقف لحين اعتماد نقل الوفر","notes":"","letters":"نقل الوفر برقم 95153 وتاريخ 1447/6/10 هـ — طلب إيقاف برقم 95304 وتاريخ 1447/7/2 هـ — الموافقة على نقل الوفر برقم 1111388 وتاريخ 1447/9/9 هـ","vision_linked":"لا","initiative":"مبادرة سفلتة مخططت المنح","tax_pct":15,"increase_pct":0,"contractor_engineer":"م. محمود إبراهيم","contractor_email":"amr.project@altawi.org","contractor_phone":"0504163181","contractor_rank":"","scope":"تشييد - إنشاء","description":"سفلتة لبعض المخططات"},{"id":2,"name":"صيانة حدائق المراكز","status":"pending","status_raw":"قيد الطرح والترسية","phase":"الطرح والترسية","progress":0,"value":"832,813","value_num":832813,"contractor":"","supervisor":"","consultant":"","pm":"م. محمد جاري القرني","pm_email":"Mgsalq@ars.gov.sa","pm_phone":"0546889994","category":"حدائق","budget_door":"الباب الثالث","contract_no":"","project_no":"","duration_days":360,"extensions":"0","stops":0,"date_sign":"","date_site":"","date_end":"","date_end_adj":"","date_receive_primary":"","date_receive_final":"","date_updated":"2026-04-01","last_action":"","notes":"","letters":"","vision_linked":"لا","initiative":"","tax_pct":0,"increase_pct":0,"contractor_engineer":"","contractor_email":"","contractor_phone":"","contractor_rank":"","scope":"","description":"صيانة"},{"id":3,"name":"سفلتة قرى محافظة بلقرن","status":"pending","status_raw":"قيد الطرح والترسية","phase":"الطرح والترسية","progress":0,"value":"786,784","value_num":786784,"contractor":"","supervisor":"","consultant":"","pm":"م. محمد جاري القرني","pm_email":"Mgsalq@ars.gov.sa","pm_phone":"0546889994","category":"صيانة طرق","budget_door":"الباب الثالث","contract_no":"","project_no":"","duration_days":360,"extensions":"0","stops":0,"date_sign":"","date_site":"","date_end":"","date_end_adj":"","date_receive_primary":"","date_receive_final":"","date_updated":"2026-04-01","last_action":"","notes":"","letters":"","vision_linked":"","initiative":"","tax_pct":0,"increase_pct":0,"contractor_engineer":"","contractor_email":"","contractor_phone":"","contractor_rank":"","scope":"","description":"صيانة"},{"id":4,"name":"سفلتة مخططات محافظة بلقرن","status":"pending","status_raw":"قيد الطرح والترسية","phase":"الطرح والترسية","progress":0,"value":"742,958","value_num":742958,"contractor":"","supervisor":"","consultant":"","pm":"م. محمد جاري القرني","pm_email":"Mgsalq@ars.gov.sa","pm_phone":"0546889994","category":"صيانة طرق","budget_door":"الباب الثالث","contract_no":"","project_no":"","duration_days":360,"extensions":"0","stops":0,"date_sign":"","date_site":"","date_end":"","date_end_adj":"","date_receive_primary":"","date_receive_final":"","date_updated":"2026-04-01","last_action":"","notes":"","letters":"","vision_linked":"","initiative":"","tax_pct":0,"increase_pct":0,"contractor_engineer":"","contractor_email":"","contractor_phone":"","contractor_rank":"","scope":"","description":"صيانة"},{"id":5,"name":"صيانة أعمال الشارع العام","status":"pending","status_raw":"قيد الطرح والترسية","phase":"الطرح والترسية","progress":0,"value":"233,680","value_num":233680,"contractor":"","supervisor":"","consultant":"","pm":"م. محمد جاري القرني","pm_email":"Mgsalq@ars.gov.sa","pm_phone":"0546889994","category":"صيانة طرق","budget_door":"الباب الثالث","contract_no":"","project_no":"","duration_days":360,"extensions":"0","stops":0,"date_sign":"","date_site":"","date_end":"","date_end_adj":"","date_receive_primary":"","date_receive_final":"","date_updated":"2026-04-01","last_action":"","notes":"","letters":"","vision_linked":"","initiative":"","tax_pct":0,"increase_pct":0,"contractor_engineer":"","contractor_email":"","contractor_phone":"","contractor_rank":"","scope":"","description":"صيانة"},{"id":6,"name":"صيانة أعمال المخططات السكنية","status":"pending","status_raw":"قيد الطرح والترسية","phase":"الطرح والترسية","progress":0,"value":"227,700","value_num":227700,"contractor":"","supervisor":"","consultant":"","pm":"م. محمد جاري القرني","pm_email":"Mgsalq@ars.gov.sa","pm_phone":"0546889994","category":"صيانة سيول","budget_door":"الباب الثالث","contract_no":"","project_no":"","duration_days":360,"extensions":"0","stops":0,"date_sign":"","date_site":"","date_end":"","date_end_adj":"","date_receive_primary":"","date_receive_final":"","date_updated":"2026-04-01","last_action":"","notes":"","letters":"","vision_linked":"","initiative":"","tax_pct":0,"increase_pct":0,"contractor_engineer":"","contractor_email":"","contractor_phone":"","contractor_rank":"","scope":"","description":"صيانة"},{"id":7,"name":"صيانة تصريف مياه الأمطار بلدية بلقرن","status":"pending","status_raw":"قيد الطرح والترسية","phase":"الطرح والترسية","progress":0,"value":"312,225","value_num":312225,"contractor":"","supervisor":"","consultant":"","pm":"م. محمد جاري القرني","pm_email":"Mgsalq@ars.gov.sa","pm_phone":"0546889994","category":"صيانة سيول","budget_door":"الباب الثالث","contract_no":"","project_no":"","duration_days":360,"extensions":"0","stops":0,"date_sign":"","date_site":"","date_end":"","date_end_adj":"","date_receive_primary":"","date_receive_final":"","date_updated":"2026-04-01","last_action":"","notes":"","letters":"","vision_linked":"","initiative":"","tax_pct":0,"increase_pct":0,"contractor_engineer":"","contractor_email":"","contractor_phone":"","contractor_rank":"","scope":"","description":"صيانة"},{"id":8,"name":"أنسنة طريق الملك خالد م١","status":"pending","status_raw":"قيد الطرح والترسية","phase":"الطرح والترسية","progress":0,"value":"4.27 م","value_num":4266308,"contractor":"","supervisor":"","consultant":"","pm":"م. محمد جاري القرني","pm_email":"Mgsalq@ars.gov.sa","pm_phone":"0546889994","category":"صيانة طرق","budget_door":"الباب الثالث","contract_no":"","project_no":"","duration_days":360,"extensions":"0","stops":0,"date_sign":"","date_site":"","date_end":"","date_end_adj":"","date_receive_primary":"","date_receive_final":"","date_updated":"2026-04-01","last_action":"","notes":"","letters":"","vision_linked":"","initiative":"","tax_pct":0,"increase_pct":0,"contractor_engineer":"","contractor_email":"","contractor_phone":"","contractor_rank":"","scope":"","description":"صيانة"},{"id":9,"name":"صيانة طريق آل مجمل","status":"pending","status_raw":"قيد الطرح والترسية","phase":"الطرح والترسية","progress":0,"value":"1.20 م","value_num":1200000,"contractor":"","supervisor":"","consultant":"","pm":"م. محمد جاري القرني","pm_email":"Mgsalq@ars.gov.sa","pm_phone":"0546889994","category":"صيانة طرق","budget_door":"الباب الثالث","contract_no":"","project_no":"","duration_days":360,"extensions":"0","stops":0,"date_sign":"","date_site":"","date_end":"","date_end_adj":"","date_receive_primary":"","date_receive_final":"","date_updated":"2026-04-01","last_action":"","notes":"","letters":"","vision_linked":"","initiative":"","tax_pct":0,"increase_pct":0,"contractor_engineer":"","contractor_email":"","contractor_phone":"","contractor_rank":"","scope":"","description":"صيانة"},{"id":10,"name":"صيانة العبارات والمزلقانات وشبكة تصريف المياه بمحافظة بلقرن","status":"pending","status_raw":"قيد الطرح والترسية","phase":"الطرح والترسية","progress":0,"value":"2.50 م","value_num":2500000,"contractor":"","supervisor":"","consultant":"","pm":"م. محمد جاري القرني","pm_email":"Mgsalq@ars.gov.sa","pm_phone":"0546889994","category":"صيانة سيول","budget_door":"الباب الثالث","contract_no":"","project_no":"","duration_days":360,"extensions":"0","stops":0,"date_sign":"","date_site":"","date_end":"","date_end_adj":"","date_receive_primary":"","date_receive_final":"","date_updated":"2026-04-01","last_action":"","notes":"","letters":"","vision_linked":"","initiative":"","tax_pct":0,"increase_pct":0,"contractor_engineer":"","contractor_email":"","contractor_phone":"","contractor_rank":"","scope":"","description":"صيانة"},{"id":11,"name":"صيانة وسفلتة القرى التابعة لمركز المحافظة","status":"pending","status_raw":"قيد الطرح والترسية","phase":"الطرح والترسية","progress":0,"value":"2.26 م","value_num":2262595,"contractor":"","supervisor":"","consultant":"","pm":"م. محمد جاري القرني","pm_email":"Mgsalq@ars.gov.sa","pm_phone":"0546889994","category":"صيانة طرق","budget_door":"الباب الثالث","contract_no":"","project_no":"","duration_days":360,"extensions":"0","stops":0,"date_sign":"","date_site":"","date_end":"","date_end_adj":"","date_receive_primary":"","date_receive_final":"","date_updated":"2026-04-01","last_action":"","notes":"","letters":"","vision_linked":"","initiative":"","tax_pct":0,"increase_pct":0,"contractor_engineer":"","contractor_email":"","contractor_phone":"","contractor_rank":"","scope":"","description":"صيانة"},{"id":12,"name":"صيانة العبارات وحماية الأودية بمحافظة بلقرن","status":"pending","status_raw":"قيد الطرح والترسية","phase":"الطرح والترسية","progress":0,"value":"1.48 م","value_num":1481105,"contractor":"","supervisor":"","consultant":"","pm":"م. محمد جاري القرني","pm_email":"Mgsalq@ars.gov.sa","pm_phone":"0546889994","category":"صيانة سيول","budget_door":"الباب الثالث","contract_no":"","project_no":"","duration_days":360,"extensions":"0","stops":0,"date_sign":"","date_site":"","date_end":"","date_end_adj":"","date_receive_primary":"","date_receive_final":"","date_updated":"2026-04-01","last_action":"","notes":"","letters":"","vision_linked":"","initiative":"","tax_pct":0,"increase_pct":0,"contractor_engineer":"","contractor_email":"","contractor_phone":"","contractor_rank":"","scope":"","description":"صيانة"}];

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
  console.log('║  حسابات تسجيل الدخول:            ║');
  console.log('║  rb@balqarn.app    Balqarn@2026rb  ║');
  console.log('║  ms@balqarn.app    Balqarn@2026ms  ║');
  console.log('║  mm@balqarn.app    Balqarn@2026mm  ║');
  console.log('║  admin@balqarn.app Balqarn@2026admin║');
  console.log('╚═══════════════════════════════════╝');
}

main().catch(e => console.error('خطأ:', e));
