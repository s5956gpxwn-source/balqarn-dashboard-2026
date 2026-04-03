// سكربت رفع المشاريع إلى Firestore - يُشغل من Console المتصفح في صفحة Firebase Console
// الخطوة 1: تحميل Firebase SDK
const script1 = document.createElement('script'); script1.type = 'module'; script1.textContent = `
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const app = initializeApp({
  apiKey: "AIzaSyBfrpIEJ9AenB3eW7FGBflBbyc3O0KEfZ8",
  authDomain: "balqarn-dashboard.firebaseapp.com",
  projectId: "balqarn-dashboard",
  storageBucket: "balqarn-dashboard.firebasestorage.app",
  messagingSenderId: "969506648856",
  appId: "1:969506648856:web:8c4037dd60de0d8f07246d"
}, 'setup-app');

const auth = getAuth(app);
const db = getFirestore(app);

// ⚠️ بيانات المشاريع تم نقلها - الصق مصفوفة المشاريع هنا من ملف projects-data.json
    // مثال: const projects = JSON.parse('محتوى ملف projects-data.json');
    const projects = []; // أدخل بيانات المشاريع هنا

async function run() {
  try {
    console.log('جاري تسجيل الدخول...');
    // ⚠️ أدخل كلمة المرور يدوياً هنا قبل التشغيل
    const ADMIN_PASSWORD = prompt('أدخل كلمة مرور admin@balqarn.app:');
    if (!ADMIN_PASSWORD) { console.error('❌ كلمة المرور مطلوبة'); return; }
    await signInWithEmailAndPassword(auth, 'admin@balqarn.app', ADMIN_PASSWORD);
    console.log('✅ تم تسجيل الدخول');

    console.log('جاري رفع المشاريع...');
    for (const p of projects) {
      await setDoc(doc(db, 'projects', String(p.id)), p);
      console.log('✅ [' + p.id + '] ' + p.name);
    }
    console.log('\\n🎉 تم رفع جميع المشاريع بنجاح! (' + projects.length + ' مشروع)');
  } catch(e) {
    console.error('❌ خطأ:', e.message);
  }
}
run();
`;
document.head.appendChild(script1);
