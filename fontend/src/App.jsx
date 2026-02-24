import { useState, useMemo, useRef, useCallback, useEffect, createContext, useContext } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar, CartesianGrid,
  LineChart, Line
} from "recharts";

/* ═══ DESIGN TOKENS ═══ */
const C = {
  bg: "#F8FAFC", card: "#FFFFFF", border: "#E2E8F0",
  text: "#0F172A", sub: "#64748B", mute: "#94A3B8",
  accent: "#3B82F6", accentDk: "#1D4ED8",
  green: "#10B981", red: "#EF4444", amber: "#F59E0B",
  purple: "#8B5CF6", teal: "#14B8A6", pink: "#EC4899",
  cyan: "#06B6D4", indigo: "#6366F1",
};
const shadow = "0 1px 3px rgba(0,0,0,.04),0 4px 12px rgba(0,0,0,.03)";
const stC = v => v === "crit" ? C.red : v === "warn" ? C.amber : C.green;

/* ═══ LANGUAGE SYSTEM ═══ */
const LANGUAGES = [
  { id: "en", flag: "🇺🇸", label: "English", ttsCode: "en-US" },
  { id: "vi", flag: "🇻🇳", label: "Tiếng Việt", ttsCode: "vi-VN" },
  { id: "zh", flag: "🇨🇳", label: "中文", ttsCode: "zh-CN" },
  { id: "ko", flag: "🇰🇷", label: "한국어", ttsCode: "ko-KR" },
  { id: "ja", flag: "🇯🇵", label: "日本語", ttsCode: "ja-JP" },
  { id: "es", flag: "🇪🇸", label: "Español", ttsCode: "es-ES" },
  { id: "fr", flag: "🇫🇷", label: "Français", ttsCode: "fr-FR" },
  { id: "de", flag: "🇩🇪", label: "Deutsch", ttsCode: "de-DE" },
  { id: "th", flag: "🇹🇭", label: "ไทย", ttsCode: "th-TH" },
  { id: "ar", flag: "🇸🇦", label: "العربية", ttsCode: "ar-SA" },
];

const T = {
  // Body regions
  head: { en: "Head", vi: "Đầu", zh: "头部", ko: "머리", ja: "頭", es: "Cabeza", fr: "Tête", de: "Kopf", th: "ศีรษะ", ar: "رأس" },
  neck: { en: "Neck", vi: "Cổ", zh: "颈部", ko: "목", ja: "首", es: "Cuello", fr: "Cou", de: "Hals", th: "คอ", ar: "رقبة" },
  shoulder: { en: "Shoulder", vi: "Vai", zh: "肩膀", ko: "어깨", ja: "肩", es: "Hombro", fr: "Épaule", de: "Schulter", th: "ไหล่", ar: "كتف" },
  chest: { en: "Chest", vi: "Ngực", zh: "胸部", ko: "가슴", ja: "胸", es: "Pecho", fr: "Poitrine", de: "Brust", th: "หน้าอก", ar: "صدر" },
  abdomen: { en: "Abdomen", vi: "Bụng", zh: "腹部", ko: "복부", ja: "腹部", es: "Abdomen", fr: "Abdomen", de: "Bauch", th: "ท้อง", ar: "بطن" },
  arm: { en: "Arm", vi: "Tay", zh: "手臂", ko: "팔", ja: "腕", es: "Brazo", fr: "Bras", de: "Arm", th: "แขน", ar: "ذراع" },
  hip: { en: "Hip", vi: "Hông", zh: "臀部", ko: "엉덩이", ja: "腰", es: "Cadera", fr: "Hanche", de: "Hüfte", th: "สะโพก", ar: "ورك" },
  leg: { en: "Leg", vi: "Chân", zh: "腿", ko: "다리", ja: "脚", es: "Pierna", fr: "Jambe", de: "Bein", th: "ขา", ar: "ساق" },
  back: { en: "Back", vi: "Lưng", zh: "背部", ko: "등", ja: "背中", es: "Espalda", fr: "Dos", de: "Rücken", th: "หลัง", ar: "ظهر" },
  
  // Detail zones
  forehead: { en: "Forehead", vi: "Trán", zh: "额头", ko: "이마", ja: "額", es: "Frente", fr: "Front", de: "Stirn", th: "หน้าผาก", ar: "جبهة" },
  eye: { en: "Eye", vi: "Mắt", zh: "眼睛", ko: "눈", ja: "目", es: "Ojo", fr: "Œil", de: "Auge", th: "ตา", ar: "عين" },
  nose: { en: "Nose", vi: "Mũi", zh: "鼻子", ko: "코", ja: "鼻", es: "Nariz", fr: "Nez", de: "Nase", th: "จมูก", ar: "أنف" },
  ear: { en: "Ear", vi: "Tai", zh: "耳朵", ko: "귀", ja: "耳", es: "Oreja", fr: "Oreille", de: "Ohr", th: "หู", ar: "أذن" },
  mouth: { en: "Mouth", vi: "Miệng", zh: "嘴", ko: "입", ja: "口", es: "Boca", fr: "Bouche", de: "Mund", th: "ปาก", ar: "فم" },
  chin: { en: "Chin", vi: "Cằm", zh: "下巴", ko: "턱", ja: "顎", es: "Barbilla", fr: "Menton", de: "Kinn", th: "คาง", ar: "ذقن" },
  cheek: { en: "Cheek", vi: "Má", zh: "脸颊", ko: "볼", ja: "頬", es: "Mejilla", fr: "Joue", de: "Wange", th: "แก้ม", ar: "خد" },
  throat: { en: "Throat", vi: "Họng", zh: "喉咙", ko: "목구멍", ja: "喉", es: "Garganta", fr: "Gorge", de: "Kehle", th: "ลำคอ", ar: "حلق" },
  elbow: { en: "Elbow", vi: "Khuỷu tay", zh: "肘部", ko: "팔꿈치", ja: "肘", es: "Codo", fr: "Coude", de: "Ellbogen", th: "ข้อศอก", ar: "كوع" },
  wrist: { en: "Wrist", vi: "Cổ tay", zh: "手腕", ko: "손목", ja: "手首", es: "Muñeca", fr: "Poignet", de: "Handgelenk", th: "ข้อมือ", ar: "معصم" },
  hand: { en: "Hand", vi: "Bàn tay", zh: "手", ko: "손", ja: "手", es: "Mano", fr: "Main", de: "Hand", th: "มือ", ar: "يد" },
  thigh: { en: "Thigh", vi: "Đùi", zh: "大腿", ko: "허벅지", ja: "太もも", es: "Muslo", fr: "Cuisse", de: "Oberschenkel", th: "ต้นขา", ar: "فخذ" },
  knee: { en: "Knee", vi: "Đầu gối", zh: "膝盖", ko: "무릎", ja: "膝", es: "Rodilla", fr: "Genou", de: "Knie", th: "หัวเข่า", ar: "ركبة" },
  ankle: { en: "Ankle", vi: "Mắt cá", zh: "脚踝", ko: "발목", ja: "足首", es: "Tobillo", fr: "Cheville", de: "Knöchel", th: "ข้อเท้า", ar: "كاحل" },
  foot: { en: "Foot", vi: "Bàn chân", zh: "脚", ko: "발", ja: "足", es: "Pie", fr: "Pied", de: "Fuß", th: "เท้า", ar: "قدم" },
  
  // UI text
  front: { en: "Front", vi: "Trước", zh: "正面", ko: "앞면", ja: "前面", es: "Frente", fr: "Avant", de: "Vorne", th: "ด้านหน้า", ar: "أمام" },
  backView: { en: "Back", vi: "Sau", zh: "背面", ko: "뒷면", ja: "背面", es: "Atrás", fr: "Arrière", de: "Hinten", th: "ด้านหลัง", ar: "خلف" },
  male: { en: "Male", vi: "Nam", zh: "男", ko: "남성", ja: "男性", es: "Hombre", fr: "Homme", de: "Mann", th: "ชาย", ar: "ذكر" },
  female: { en: "Female", vi: "Nữ", zh: "女", ko: "여성", ja: "女性", es: "Mujer", fr: "Femme", de: "Frau", th: "หญิง", ar: "أنثى" },
  child: { en: "Child", vi: "Trẻ em", zh: "儿童", ko: "어린이", ja: "子供", es: "Niño", fr: "Enfant", de: "Kind", th: "เด็ก", ar: "طفل" },
  selected: { en: "Selected", vi: "Đã chọn", zh: "已选择", ko: "선택됨", ja: "選択済み", es: "Seleccionado", fr: "Sélectionné", de: "Ausgewählt", th: "เลือกแล้ว", ar: "محدد" },
  clear: { en: "Clear", vi: "Xóa", zh: "清除", ko: "지우기", ja: "クリア", es: "Limpiar", fr: "Effacer", de: "Löschen", th: "ล้าง", ar: "مسح" },
  all: { en: "All", vi: "Tất cả", zh: "全部", ko: "전체", ja: "すべて", es: "Todo", fr: "Tout", de: "Alle", th: "ทั้งหมด", ar: "الكل" },
  fullBody: { en: "Full Body", vi: "Toàn thân", zh: "全身", ko: "전신", ja: "全身", es: "Cuerpo", fr: "Corps", de: "Ganzkörper", th: "ทั้งตัว", ar: "الجسم" },
  tapToZoom: { en: "Tap to zoom in", vi: "Chạm để phóng to", zh: "点击放大", ko: "확대하려면 탭", ja: "タップで拡大", es: "Toca para zoom", fr: "Toucher pour zoomer", de: "Tippen zum Zoomen", th: "แตะเพื่อซูม", ar: "انقر للتكبير" },
  tapToSelect: { en: "Tap to select", vi: "Chạm để chọn", zh: "点击选择", ko: "선택하려면 탭", ja: "タップで選択", es: "Toca para seleccionar", fr: "Toucher pour sélectionner", de: "Tippen zum Auswählen", th: "แตะเพื่อเลือก", ar: "انقر للتحديد" },
  tapBodyAreas: { en: "Tap body areas", vi: "Chạm vào vùng cơ thể", zh: "点击身体部位", ko: "신체 부위를 탭하세요", ja: "体の部位をタップ", es: "Toca las áreas", fr: "Touchez les zones", de: "Bereiche antippen", th: "แตะบริเวณร่างกาย", ar: "انقر على مناطق الجسم" },
  clickToZoom: { en: "click to zoom", vi: "nhấn để phóng to", zh: "点击放大", ko: "클릭하여 확대", ja: "クリックで拡大", es: "clic para zoom", fr: "cliquer pour zoomer", de: "klicken zum Zoomen", th: "คลิกเพื่อซูม", ar: "انقر للتكبير" },
  speakReport: { en: "Speak Report", vi: "Đọc báo cáo", zh: "语音报告", ko: "보고서 읽기", ja: "レポートを読む", es: "Leer informe", fr: "Lire rapport", de: "Bericht vorlesen", th: "อ่านรายงาน", ar: "قراءة التقرير" },
  speaking: { en: "Speaking...", vi: "Đang đọc...", zh: "正在播放...", ko: "읽는 중...", ja: "読み上げ中...", es: "Hablando...", fr: "Lecture...", de: "Sprechen...", th: "กำลังพูด...", ar: "جاري القراءة..." },
  continueToSymptoms: { en: "Continue to Symptoms", vi: "Tiếp tục chọn triệu chứng", zh: "继续选择症状", ko: "증상 선택으로", ja: "症状選択へ", es: "Continuar a síntomas", fr: "Continuer aux symptômes", de: "Weiter zu Symptomen", th: "ไปเลือกอาการ", ar: "متابعة الأعراض" },
  location: { en: "Location", vi: "Vị trí", zh: "位置", ko: "위치", ja: "位置", es: "Ubicación", fr: "Emplacement", de: "Ort", th: "ตำแหน่ง", ar: "الموقع" },
  symptoms: { en: "Symptoms", vi: "Triệu chứng", zh: "症状", ko: "증상", ja: "症状", es: "Síntomas", fr: "Symptômes", de: "Symptome", th: "อาการ", ar: "الأعراض" },
  details: { en: "Details", vi: "Chi tiết", zh: "详情", ko: "세부사항", ja: "詳細", es: "Detalles", fr: "Détails", de: "Details", th: "รายละเอียด", ar: "التفاصيل" },
  results: { en: "Results", vi: "Kết quả", zh: "结果", ko: "결과", ja: "結果", es: "Resultados", fr: "Résultats", de: "Ergebnisse", th: "ผลลัพธ์", ar: "النتائج" },
  left: { en: "Left", vi: "Trái", zh: "左", ko: "왼쪽", ja: "左", es: "Izquierda", fr: "Gauche", de: "Links", th: "ซ้าย", ar: "يسار" },
  right: { en: "Right", vi: "Phải", zh: "右", ko: "오른쪽", ja: "右", es: "Derecha", fr: "Droite", de: "Rechts", th: "ขวา", ar: "يمين" },
  upper: { en: "Upper", vi: "Trên", zh: "上", ko: "위", ja: "上", es: "Superior", fr: "Supérieur", de: "Oben", th: "บน", ar: "علوي" },
  lower: { en: "Lower", vi: "Dưới", zh: "下", ko: "아래", ja: "下", es: "Inferior", fr: "Inférieur", de: "Unten", th: "ล่าง", ar: "سفلي" },
  face: { en: "Face", vi: "Mặt", zh: "脸", ko: "얼굴", ja: "顔", es: "Cara", fr: "Visage", de: "Gesicht", th: "ใบหน้า", ar: "وجه" },
  // Body zones - specific areas
  leftShoulder: { en: "Left Shoulder", vi: "Vai trái", zh: "左肩", ko: "왼쪽 어깨", ja: "左肩", es: "Hombro izquierdo", fr: "Épaule gauche", de: "Linke Schulter", th: "ไหล่ซ้าย", ar: "الكتف الأيسر" },
  rightShoulder: { en: "Right Shoulder", vi: "Vai phải", zh: "右肩", ko: "오른쪽 어깨", ja: "右肩", es: "Hombro derecho", fr: "Épaule droite", de: "Rechte Schulter", th: "ไหล่ขวา", ar: "الكتف الأيمن" },
  leftArm: { en: "Left Arm", vi: "Tay trái", zh: "左臂", ko: "왼팔", ja: "左腕", es: "Brazo izquierdo", fr: "Bras gauche", de: "Linker Arm", th: "แขนซ้าย", ar: "الذراع الأيسر" },
  rightArm: { en: "Right Arm", vi: "Tay phải", zh: "右臂", ko: "오른팔", ja: "右腕", es: "Brazo derecho", fr: "Bras droit", de: "Rechter Arm", th: "แขนขวา", ar: "الذراع الأيمن" },
  leftLeg: { en: "Left Leg", vi: "Chân trái", zh: "左腿", ko: "왼다리", ja: "左脚", es: "Pierna izquierda", fr: "Jambe gauche", de: "Linkes Bein", th: "ขาซ้าย", ar: "الساق اليسرى" },
  rightLeg: { en: "Right Leg", vi: "Chân phải", zh: "右腿", ko: "오른다리", ja: "右脚", es: "Pierna derecha", fr: "Jambe droite", de: "Rechtes Bein", th: "ขาขวา", ar: "الساق اليمنى" },
  backOfHead: { en: "Back of Head", vi: "Sau đầu", zh: "后脑", ko: "뒷머리", ja: "後頭部", es: "Nuca", fr: "Arrière-tête", de: "Hinterkopf", th: "ท้ายทอย", ar: "مؤخرة الرأس" },
  nape: { en: "Nape", vi: "Gáy", zh: "颈后", ko: "목덜미", ja: "うなじ", es: "Nuca", fr: "Nuque", de: "Nacken", th: "ท้ายทอย", ar: "مؤخرة العنق" },
  upperBack: { en: "Upper Back", vi: "Lưng trên", zh: "上背", ko: "등 위쪽", ja: "背中上部", es: "Espalda alta", fr: "Haut du dos", de: "Oberer Rücken", th: "หลังส่วนบน", ar: "أعلى الظهر" },
  lowerBack: { en: "Lower Back", vi: "Lưng dưới", zh: "下背", ko: "등 아래쪽", ja: "腰", es: "Espalda baja", fr: "Bas du dos", de: "Unterer Rücken", th: "หลังส่วนล่าง", ar: "أسفل الظهر" },
  buttock: { en: "Buttock", vi: "Mông", zh: "臀部", ko: "엉덩이", ja: "お尻", es: "Glúteo", fr: "Fesse", de: "Gesäß", th: "ก้น", ar: "الأرداف" },
  // Detail zones
  topOfHead: { en: "Top of Head", vi: "Đỉnh đầu", zh: "头顶", ko: "정수리", ja: "頭頂", es: "Coronilla", fr: "Sommet", de: "Kopfoberseite", th: "กระหม่อม", ar: "أعلى الرأس" },
  leftEye: { en: "Left Eye", vi: "Mắt trái", zh: "左眼", ko: "왼쪽 눈", ja: "左目", es: "Ojo izquierdo", fr: "Œil gauche", de: "Linkes Auge", th: "ตาซ้าย", ar: "العين اليسرى" },
  rightEye: { en: "Right Eye", vi: "Mắt phải", zh: "右眼", ko: "오른쪽 눈", ja: "右目", es: "Ojo derecho", fr: "Œil droit", de: "Rechtes Auge", th: "ตาขวา", ar: "العين اليمنى" },
  leftEar: { en: "Left Ear", vi: "Tai trái", zh: "左耳", ko: "왼쪽 귀", ja: "左耳", es: "Oreja izquierda", fr: "Oreille gauche", de: "Linkes Ohr", th: "หูซ้าย", ar: "الأذن اليسرى" },
  rightEar: { en: "Right Ear", vi: "Tai phải", zh: "右耳", ko: "오른쪽 귀", ja: "右耳", es: "Oreja derecha", fr: "Oreille droite", de: "Rechtes Ohr", th: "หูขวา", ar: "الأذن اليمنى" },
  leftCheek: { en: "Left Cheek", vi: "Má trái", zh: "左脸颊", ko: "왼쪽 볼", ja: "左頬", es: "Mejilla izquierda", fr: "Joue gauche", de: "Linke Wange", th: "แก้มซ้าย", ar: "الخد الأيسر" },
  rightCheek: { en: "Right Cheek", vi: "Má phải", zh: "右脸颊", ko: "오른쪽 볼", ja: "右頬", es: "Mejilla derecha", fr: "Joue droite", de: "Rechte Wange", th: "แก้มขวา", ar: "الخد الأيمن" },
  frontNeck: { en: "Front Neck", vi: "Cổ trước", zh: "颈前", ko: "목 앞", ja: "首の前", es: "Cuello frontal", fr: "Avant du cou", de: "Vorderer Hals", th: "คอด้านหน้า", ar: "مقدمة العنق" },
  leftNeck: { en: "Left Neck", vi: "Cổ trái", zh: "左颈", ko: "왼쪽 목", ja: "左首", es: "Cuello izquierdo", fr: "Cou gauche", de: "Linker Hals", th: "คอซ้าย", ar: "العنق الأيسر" },
  rightNeck: { en: "Right Neck", vi: "Cổ phải", zh: "右颈", ko: "오른쪽 목", ja: "右首", es: "Cuello derecho", fr: "Cou droit", de: "Rechter Hals", th: "คอขวา", ar: "العنق الأيمن" },
  collarbone: { en: "Collarbone", vi: "Xương đòn", zh: "锁骨", ko: "쇄골", ja: "鎖骨", es: "Clavícula", fr: "Clavicule", de: "Schlüsselbein", th: "กระดูกไหปลาร้า", ar: "الترقوة" },
  leftChest: { en: "Left Chest", vi: "Ngực trái", zh: "左胸", ko: "왼쪽 가슴", ja: "左胸", es: "Pecho izquierdo", fr: "Poitrine gauche", de: "Linke Brust", th: "อกซ้าย", ar: "الصدر الأيسر" },
  rightChest: { en: "Right Chest", vi: "Ngực phải", zh: "右胸", ko: "오른쪽 가슴", ja: "右胸", es: "Pecho derecho", fr: "Poitrine droite", de: "Rechte Brust", th: "อกขวา", ar: "الصدر الأيمن" },
  sternum: { en: "Sternum", vi: "Xương ức", zh: "胸骨", ko: "흉골", ja: "胸骨", es: "Esternón", fr: "Sternum", de: "Brustbein", th: "กระดูกหน้าอก", ar: "عظم القص" },
  leftRibs: { en: "Left Ribs", vi: "Sườn trái", zh: "左肋", ko: "왼쪽 갈비뼈", ja: "左肋骨", es: "Costillas izq.", fr: "Côtes gauches", de: "Linke Rippen", th: "ซี่โครงซ้าย", ar: "الضلوع اليسرى" },
  rightRibs: { en: "Right Ribs", vi: "Sườn phải", zh: "右肋", ko: "오른쪽 갈비뼈", ja: "右肋骨", es: "Costillas der.", fr: "Côtes droites", de: "Rechte Rippen", th: "ซี่โครงขวา", ar: "الضلوع اليمنى" },
  upperAbdomen: { en: "Upper Abdomen", vi: "Bụng trên", zh: "上腹", ko: "상복부", ja: "上腹部", es: "Abdomen superior", fr: "Abdomen supérieur", de: "Oberbauch", th: "ท้องส่วนบน", ar: "أعلى البطن" },
  leftAbdomen: { en: "Left Abdomen", vi: "Bụng trái", zh: "左腹", ko: "왼쪽 복부", ja: "左腹部", es: "Abdomen izquierdo", fr: "Abdomen gauche", de: "Linker Bauch", th: "ท้องซ้าย", ar: "البطن الأيسر" },
  rightAbdomen: { en: "Right Abdomen", vi: "Bụng phải", zh: "右腹", ko: "오른쪽 복부", ja: "右腹部", es: "Abdomen derecho", fr: "Abdomen droit", de: "Rechter Bauch", th: "ท้องขวา", ar: "البطن الأيمن" },
  navel: { en: "Navel", vi: "Rốn", zh: "肚脐", ko: "배꼽", ja: "へそ", es: "Ombligo", fr: "Nombril", de: "Bauchnabel", th: "สะดือ", ar: "السرة" },
  lowerAbdomen: { en: "Lower Abdomen", vi: "Bụng dưới", zh: "下腹", ko: "하복부", ja: "下腹部", es: "Abdomen inferior", fr: "Bas-ventre", de: "Unterbauch", th: "ท้องส่วนล่าง", ar: "أسفل البطن" },
  upperArm: { en: "Upper Arm", vi: "Bắp tay", zh: "上臂", ko: "상완", ja: "上腕", es: "Brazo superior", fr: "Haut du bras", de: "Oberarm", th: "ต้นแขน", ar: "أعلى الذراع" },
  forearm: { en: "Forearm", vi: "Cẳng tay", zh: "前臂", ko: "전완", ja: "前腕", es: "Antebrazo", fr: "Avant-bras", de: "Unterarm", th: "ปลายแขน", ar: "الساعد" },
  leftHip: { en: "Left Hip", vi: "Hông trái", zh: "左髋", ko: "왼쪽 엉덩이", ja: "左腰", es: "Cadera izquierda", fr: "Hanche gauche", de: "Linke Hüfte", th: "สะโพกซ้าย", ar: "الورك الأيسر" },
  rightHip: { en: "Right Hip", vi: "Hông phải", zh: "右髋", ko: "오른쪽 엉덩이", ja: "右腰", es: "Cadera derecha", fr: "Hanche droite", de: "Rechte Hüfte", th: "สะโพกขวา", ar: "الورك الأيمن" },
  pelvis: { en: "Pelvis", vi: "Xương chậu", zh: "骨盆", ko: "골반", ja: "骨盤", es: "Pelvis", fr: "Bassin", de: "Becken", th: "กระดูกเชิงกราน", ar: "الحوض" },
  leftButtock: { en: "Left Buttock", vi: "Mông trái", zh: "左臀", ko: "왼쪽 엉덩이", ja: "左臀部", es: "Glúteo izquierdo", fr: "Fesse gauche", de: "Linkes Gesäß", th: "ก้นซ้าย", ar: "الأرداف اليسرى" },
  rightButtock: { en: "Right Buttock", vi: "Mông phải", zh: "右臀", ko: "오른쪽 엉덩이", ja: "右臀部", es: "Glúteo derecho", fr: "Fesse droite", de: "Rechtes Gesäß", th: "ก้นขวา", ar: "الأرداف اليمنى" },
  tailbone: { en: "Tailbone", vi: "Xương cụt", zh: "尾骨", ko: "꼬리뼈", ja: "尾骨", es: "Coxis", fr: "Coccyx", de: "Steißbein", th: "กระดูกก้นกบ", ar: "العصعص" },
  shin: { en: "Shin", vi: "Ống chân", zh: "小腿前侧", ko: "정강이", ja: "すね", es: "Espinilla", fr: "Tibia", de: "Schienbein", th: "หน้าแข้ง", ar: "قصبة الساق" },
  calf: { en: "Calf", vi: "Bắp chân", zh: "小腿后侧", ko: "종아리", ja: "ふくらはぎ", es: "Pantorrilla", fr: "Mollet", de: "Wade", th: "น่อง", ar: "بطة الساق" },
  sacrum: { en: "Sacrum", vi: "Xương cùng", zh: "骶骨", ko: "천골", ja: "仙骨", es: "Sacro", fr: "Sacrum", de: "Kreuzbein", th: "กระดูกกระเบนเหน็บ", ar: "العجز" },
  leftUpperBack: { en: "Left Upper Back", vi: "Lưng trên trái", zh: "左上背", ko: "왼쪽 등 위", ja: "左上背部", es: "Espalda alta izq.", fr: "Haut dos gauche", de: "Linker oberer Rücken", th: "หลังบนซ้าย", ar: "أعلى الظهر الأيسر" },
  rightUpperBack: { en: "Right Upper Back", vi: "Lưng trên phải", zh: "右上背", ko: "오른쪽 등 위", ja: "右上背部", es: "Espalda alta der.", fr: "Haut dos droit", de: "Rechter oberer Rücken", th: "หลังบนขวา", ar: "أعلى الظهر الأيمن" },
  upperSpine: { en: "Upper Spine", vi: "Cột sống trên", zh: "上脊柱", ko: "상부 척추", ja: "上部脊椎", es: "Columna superior", fr: "Colonne supérieure", de: "Obere Wirbelsäule", th: "กระดูกสันหลังส่วนบน", ar: "العمود الفقري العلوي" },
  leftShoulderBlade: { en: "Left Shoulder Blade", vi: "Bả vai trái", zh: "左肩胛骨", ko: "왼쪽 견갑골", ja: "左肩甲骨", es: "Omóplato izq.", fr: "Omoplate gauche", de: "Linkes Schulterblatt", th: "สะบักซ้าย", ar: "لوح الكتف الأيسر" },
  rightShoulderBlade: { en: "Right Shoulder Blade", vi: "Bả vai phải", zh: "右肩胛骨", ko: "오른쪽 견갑골", ja: "右肩甲骨", es: "Omóplato der.", fr: "Omoplate droite", de: "Rechtes Schulterblatt", th: "สะบักขวา", ar: "لوح الكتف الأيمن" },
  leftLowerBack: { en: "Left Lower Back", vi: "Lưng dưới trái", zh: "左下背", ko: "왼쪽 등 아래", ja: "左下背部", es: "Espalda baja izq.", fr: "Bas dos gauche", de: "Linker unterer Rücken", th: "หลังล่างซ้าย", ar: "أسفل الظهر الأيسر" },
  rightLowerBack: { en: "Right Lower Back", vi: "Lưng dưới phải", zh: "右下背", ko: "오른쪽 등 아래", ja: "右下背部", es: "Espalda baja der.", fr: "Bas dos droit", de: "Rechter unterer Rücken", th: "หลังล่างขวา", ar: "أسفل الظهر الأيمن" },
  lowerSpine: { en: "Lower Spine", vi: "Cột sống dưới", zh: "下脊柱", ko: "하부 척추", ja: "下部脊椎", es: "Columna inferior", fr: "Colonne inférieure", de: "Untere Wirbelsäule", th: "กระดูกสันหลังส่วนล่าง", ar: "العمود الفقري السفلي" },
  
  // Symptom categories
  pain: { en: "Pain", vi: "Đau", zh: "疼痛", ko: "통증", ja: "痛み", es: "Dolor", fr: "Douleur", de: "Schmerz", th: "ปวด", ar: "ألم" },
  skin: { en: "Skin", vi: "Da", zh: "皮肤", ko: "피부", ja: "皮膚", es: "Piel", fr: "Peau", de: "Haut", th: "ผิวหนัง", ar: "جلد" },
  breathing: { en: "Breathing", vi: "Hô hấp", zh: "呼吸", ko: "호흡", ja: "呼吸", es: "Respiración", fr: "Respiration", de: "Atmung", th: "การหายใจ", ar: "التنفس" },
  behavioral: { en: "Behavioral", vi: "Hành vi", zh: "行为", ko: "행동", ja: "行動", es: "Conductual", fr: "Comportement", de: "Verhalten", th: "พฤติกรรม", ar: "سلوكي" },
  digestive: { en: "Digestive", vi: "Tiêu hóa", zh: "消化", ko: "소화", ja: "消化", es: "Digestivo", fr: "Digestif", de: "Verdauung", th: "ระบบย่อยอาหาร", ar: "هضمي" },
  
  // Pain symptoms
  sharp: { en: "Sharp", vi: "Nhói", zh: "刺痛", ko: "날카로운", ja: "鋭い", es: "Agudo", fr: "Aigu", de: "Stechend", th: "แหลม", ar: "حاد" },
  dullAche: { en: "Dull ache", vi: "Đau âm ỉ", zh: "钝痛", ko: "둔한 통증", ja: "鈍痛", es: "Dolor sordo", fr: "Douleur sourde", de: "Dumpfer Schmerz", th: "ปวดตื้อ", ar: "ألم خفيف" },
  burning: { en: "Burning", vi: "Rát bỏng", zh: "灼痛", ko: "타는 듯한", ja: "焼けるような", es: "Ardor", fr: "Brûlure", de: "Brennend", th: "แสบร้อน", ar: "حرقة" },
  pressure: { en: "Pressure", vi: "Tức nặng", zh: "压迫感", ko: "압박감", ja: "圧迫", es: "Presión", fr: "Pression", de: "Druck", th: "กดทับ", ar: "ضغط" },
  throbbing: { en: "Throbbing", vi: "Nhức nhối", zh: "跳痛", ko: "욱신거림", ja: "ズキズキ", es: "Palpitante", fr: "Pulsatile", de: "Pochend", th: "ปวดตุบๆ", ar: "نابض" },
  cramping: { en: "Cramping", vi: "Co thắt", zh: "痉挛", ko: "쥐어짜는", ja: "けいれん", es: "Calambres", fr: "Crampes", de: "Krampfend", th: "เป็นตะคริว", ar: "تقلصات" },
  stinging: { en: "Stinging", vi: "Châm chích", zh: "刺痛", ko: "찌르는", ja: "チクチク", es: "Punzante", fr: "Piquant", de: "Stechend", th: "แสบ", ar: "لاذع" },
  radiating: { en: "Radiating", vi: "Lan tỏa", zh: "放射痛", ko: "방사통", ja: "放散痛", es: "Irradiante", fr: "Irradiant", de: "Ausstrahlend", th: "ปวดร้าว", ar: "منتشر" },
  
  // Skin symptoms
  redness: { en: "Redness", vi: "Đỏ da", zh: "红肿", ko: "발적", ja: "発赤", es: "Enrojecimiento", fr: "Rougeur", de: "Rötung", th: "แดง", ar: "احمرار" },
  swelling: { en: "Swelling", vi: "Sưng", zh: "肿胀", ko: "부기", ja: "腫れ", es: "Hinchazón", fr: "Gonflement", de: "Schwellung", th: "บวม", ar: "تورم" },
  rash: { en: "Rash", vi: "Phát ban", zh: "皮疹", ko: "발진", ja: "発疹", es: "Sarpullido", fr: "Éruption", de: "Ausschlag", th: "ผื่น", ar: "طفح" },
  openWound: { en: "Open wound", vi: "Vết thương hở", zh: "开放性伤口", ko: "열린 상처", ja: "開放創", es: "Herida abierta", fr: "Plaie ouverte", de: "Offene Wunde", th: "แผลเปิด", ar: "جرح مفتوح" },
  bruise: { en: "Bruise", vi: "Bầm tím", zh: "淤青", ko: "멍", ja: "あざ", es: "Moretón", fr: "Ecchymose", de: "Prellung", th: "ช้ำ", ar: "كدمة" },
  dryCracking: { en: "Dry/cracking", vi: "Khô/nứt", zh: "干燥/开裂", ko: "건조/갈라짐", ja: "乾燥/亀裂", es: "Seco/agrietado", fr: "Sec/fissuré", de: "Trocken/rissig", th: "แห้ง/แตก", ar: "جاف/متشقق" },
  discoloration: { en: "Discoloration", vi: "Đổi màu", zh: "变色", ko: "변색", ja: "変色", es: "Decoloración", fr: "Décoloration", de: "Verfärbung", th: "เปลี่ยนสี", ar: "تغير اللون" },
  warmth: { en: "Warmth", vi: "Nóng ấm", zh: "温热", ko: "온기", ja: "温かさ", es: "Calor", fr: "Chaleur", de: "Wärme", th: "อุ่น", ar: "دفء" },
  
  // Breathing symptoms
  coughing: { en: "Coughing", vi: "Ho", zh: "咳嗽", ko: "기침", ja: "咳", es: "Tos", fr: "Toux", de: "Husten", th: "ไอ", ar: "سعال" },
  wheezing: { en: "Wheezing", vi: "Thở khò khè", zh: "喘息", ko: "쌕쌕거림", ja: "喘鳴", es: "Sibilancias", fr: "Respiration sifflante", de: "Keuchen", th: "หายใจมีเสียงหวีด", ar: "أزيز" },
  shortOfBreath: { en: "Short of breath", vi: "Khó thở", zh: "气短", ko: "숨가쁨", ja: "息切れ", es: "Falta de aire", fr: "Essoufflement", de: "Kurzatmig", th: "หายใจลำบาก", ar: "ضيق التنفس" },
  congestion: { en: "Congestion", vi: "Nghẹt mũi", zh: "鼻塞", ko: "코막힘", ja: "鬱血", es: "Congestión", fr: "Congestion", de: "Verstopfung", th: "คัดจมูก", ar: "احتقان" },
  rapidBreathing: { en: "Rapid breathing", vi: "Thở nhanh", zh: "呼吸急促", ko: "빠른 호흡", ja: "速い呼吸", es: "Respiración rápida", fr: "Respiration rapide", de: "Schnelle Atmung", th: "หายใจเร็ว", ar: "التنفس السريع" },
  chestTightness: { en: "Chest tightness", vi: "Tức ngực", zh: "胸闷", ko: "가슴 답답함", ja: "胸の締め付け", es: "Opresión en el pecho", fr: "Oppression thoracique", de: "Engegefühl", th: "แน่นหน้าอก", ar: "ضيق الصدر" },
  
  // Behavioral symptoms
  agitation: { en: "Agitation", vi: "Kích động", zh: "躁动", ko: "초조", ja: "興奮", es: "Agitación", fr: "Agitation", de: "Unruhe", th: "กระวนกระวาย", ar: "هياج" },
  withdrawal: { en: "Withdrawal", vi: "Thu mình", zh: "退缩", ko: "위축", ja: "引きこもり", es: "Aislamiento", fr: "Retrait", de: "Rückzug", th: "เก็บตัว", ar: "انسحاب" },
  vocalization: { en: "Vocalization", vi: "Phát âm", zh: "发声", ko: "발성", ja: "発声", es: "Vocalización", fr: "Vocalisation", de: "Lautäußerung", th: "ส่งเสียง", ar: "نطق" },
  guarding: { en: "Guarding", vi: "Bảo vệ", zh: "防卫", ko: "방어", ja: "防御", es: "Protección", fr: "Protection", de: "Schonhaltung", th: "ป้องกัน", ar: "حماية" },
  appetiteLoss: { en: "Appetite loss", vi: "Chán ăn", zh: "食欲不振", ko: "식욕 감퇴", ja: "食欲不振", es: "Pérdida de apetito", fr: "Perte d'appétit", de: "Appetitlosigkeit", th: "เบื่ออาหาร", ar: "فقدان الشهية" },
  sleepChange: { en: "Sleep change", vi: "Rối loạn giấc ngủ", zh: "睡眠改变", ko: "수면 변화", ja: "睡眠の変化", es: "Cambio de sueño", fr: "Changement de sommeil", de: "Schlafänderung", th: "การนอนเปลี่ยน", ar: "تغير النوم" },
  restless: { en: "Restless", vi: "Bồn chồn", zh: "不安", ko: "안절부절", ja: "落ち着かない", es: "Inquieto", fr: "Agité", de: "Unruhig", th: "กระสับกระส่าย", ar: "قلق" },
  crying: { en: "Crying", vi: "Khóc", zh: "哭泣", ko: "울음", ja: "泣く", es: "Llanto", fr: "Pleurs", de: "Weinen", th: "ร้องไห้", ar: "بكاء" },
  
  // Digestive symptoms
  nausea: { en: "Nausea", vi: "Buồn nôn", zh: "恶心", ko: "메스꺼움", ja: "吐き気", es: "Náuseas", fr: "Nausée", de: "Übelkeit", th: "คลื่นไส้", ar: "غثيان" },
  diarrhea: { en: "Diarrhea", vi: "Tiêu chảy", zh: "腹泻", ko: "설사", ja: "下痢", es: "Diarrea", fr: "Diarrhée", de: "Durchfall", th: "ท้องเสีย", ar: "إسهال" },
  constipation: { en: "Constipation", vi: "Táo bón", zh: "便秘", ko: "변비", ja: "便秘", es: "Estreñimiento", fr: "Constipation", de: "Verstopfung", th: "ท้องผูก", ar: "إمساك" },
  bloating: { en: "Bloating", vi: "Đầy bụng", zh: "腹胀", ko: "복부 팽만", ja: "膨満感", es: "Hinchazón", fr: "Ballonnement", de: "Blähungen", th: "ท้องอืด", ar: "انتفاخ" },
  vomiting: { en: "Vomiting", vi: "Nôn", zh: "呕吐", ko: "구토", ja: "嘔吐", es: "Vómitos", fr: "Vomissements", de: "Erbrechen", th: "อาเจียน", ar: "قيء" },
  abdominalPain: { en: "Abdominal pain", vi: "Đau bụng", zh: "腹痛", ko: "복통", ja: "腹痛", es: "Dolor abdominal", fr: "Douleur abdominale", de: "Bauchschmerzen", th: "ปวดท้อง", ar: "ألم البطن" },
  
  // Emotional states
  comfortable: { en: "Comfortable", vi: "Thoải mái", zh: "舒适", ko: "편안함", ja: "快適", es: "Cómodo", fr: "Confortable", de: "Komfortabel", th: "สบาย", ar: "مريح" },
  neutral: { en: "Neutral", vi: "Bình thường", zh: "正常", ko: "보통", ja: "普通", es: "Neutral", fr: "Neutre", de: "Neutral", th: "ปกติ", ar: "محايد" },
  uneasy: { en: "Uneasy", vi: "Khó chịu", zh: "不安", ko: "불안", ja: "不安", es: "Inquieto", fr: "Mal à l'aise", de: "Unwohl", th: "ไม่สบายใจ", ar: "قلق" },
  distressed: { en: "Distressed", vi: "Đau khổ", zh: "痛苦", ko: "고통스러운", ja: "苦痛", es: "Angustiado", fr: "En détresse", de: "Verzweifelt", th: "ทุกข์ใจ", ar: "متألم" },
  anxious: { en: "Anxious", vi: "Lo lắng", zh: "焦虑", ko: "불안한", ja: "不安", es: "Ansioso", fr: "Anxieux", de: "Ängstlich", th: "วิตกกังวล", ar: "قلق" },
  confused: { en: "Confused", vi: "Lú lẫn", zh: "困惑", ko: "혼란스러운", ja: "混乱", es: "Confundido", fr: "Confus", de: "Verwirrt", th: "สับสน", ar: "مرتبك" },
  
  // UI Labels
  painIndicators: { en: "Pain indicators", vi: "Chỉ báo đau", zh: "疼痛指标", ko: "통증 지표", ja: "痛みの指標", es: "Indicadores de dolor", fr: "Indicateurs de douleur", de: "Schmerzindikatoren", th: "ตัวบ่งชี้ความเจ็บปวด", ar: "مؤشرات الألم" },
  skinIndicators: { en: "Skin indicators", vi: "Chỉ báo da", zh: "皮肤指标", ko: "피부 지표", ja: "皮膚の指標", es: "Indicadores de piel", fr: "Indicateurs cutanés", de: "Hautindikatoren", th: "ตัวบ่งชี้ผิวหนัง", ar: "مؤشرات الجلد" },
  breathingIndicators: { en: "Breathing indicators", vi: "Chỉ báo hô hấp", zh: "呼吸指标", ko: "호흡 지표", ja: "呼吸の指標", es: "Indicadores respiratorios", fr: "Indicateurs respiratoires", de: "Atemindikatoren", th: "ตัวบ่งชี้การหายใจ", ar: "مؤشرات التنفس" },
  behavioralIndicators: { en: "Behavioral indicators", vi: "Chỉ báo hành vi", zh: "行为指标", ko: "행동 지표", ja: "行動の指標", es: "Indicadores conductuales", fr: "Indicateurs comportementaux", de: "Verhaltensindikatoren", th: "ตัวบ่งชี้พฤติกรรม", ar: "مؤشرات السلوك" },
  digestiveIndicators: { en: "Digestive indicators", vi: "Chỉ báo tiêu hóa", zh: "消化指标", ko: "소화 지표", ja: "消化の指標", es: "Indicadores digestivos", fr: "Indicateurs digestifs", de: "Verdauungsindikatoren", th: "ตัวบ่งชี้ระบบย่อยอาหาร", ar: "مؤشرات الهضم" },
  emotionalState: { en: "Emotional state", vi: "Trạng thái cảm xúc", zh: "情绪状态", ko: "감정 상태", ja: "感情状態", es: "Estado emocional", fr: "État émotionnel", de: "Emotionaler Zustand", th: "สภาวะอารมณ์", ar: "الحالة العاطفية" },
  painLevel: { en: "Pain level", vi: "Mức độ đau", zh: "疼痛程度", ko: "통증 수준", ja: "痛みのレベル", es: "Nivel de dolor", fr: "Niveau de douleur", de: "Schmerzstufe", th: "ระดับความเจ็บปวด", ar: "مستوى الألم" },
  duration: { en: "Duration", vi: "Thời gian", zh: "持续时间", ko: "기간", ja: "期間", es: "Duración", fr: "Durée", de: "Dauer", th: "ระยะเวลา", ar: "المدة" },
  notes: { en: "Notes", vi: "Ghi chú", zh: "备注", ko: "메모", ja: "メモ", es: "Notas", fr: "Notes", de: "Notizen", th: "บันทึก", ar: "ملاحظات" },
  observations: { en: "Observations...", vi: "Quan sát...", zh: "观察...", ko: "관찰...", ja: "観察...", es: "Observaciones...", fr: "Observations...", de: "Beobachtungen...", th: "ข้อสังเกต...", ar: "ملاحظات..." },
  
  // Duration options
  justNow: { en: "just now", vi: "vừa mới", zh: "刚才", ko: "방금", ja: "たった今", es: "ahora mismo", fr: "à l'instant", de: "gerade eben", th: "เมื่อกี้", ar: "الآن" },
  today: { en: "today", vi: "hôm nay", zh: "今天", ko: "오늘", ja: "今日", es: "hoy", fr: "aujourd'hui", de: "heute", th: "วันนี้", ar: "اليوم" },
  twoDays: { en: "2-3 days", vi: "2-3 ngày", zh: "2-3天", ko: "2-3일", ja: "2-3日", es: "2-3 días", fr: "2-3 jours", de: "2-3 Tage", th: "2-3 วัน", ar: "2-3 أيام" },
  oneWeek: { en: "1 week+", vi: "1 tuần+", zh: "1周+", ko: "1주+", ja: "1週間+", es: "1 semana+", fr: "1 semaine+", de: "1 Woche+", th: "1 สัปดาห์+", ar: "أسبوع+" },
  ongoing: { en: "ongoing", vi: "liên tục", zh: "持续", ko: "지속", ja: "継続中", es: "continuo", fr: "en cours", de: "anhaltend", th: "ต่อเนื่อง", ar: "مستمر" },
  
  // Buttons
  backBtn: { en: "Back", vi: "Quay lại", zh: "返回", ko: "뒤로", ja: "戻る", es: "Atrás", fr: "Retour", de: "Zurück", th: "กลับ", ar: "رجوع" },
  continueBtn: { en: "Continue", vi: "Tiếp tục", zh: "继续", ko: "계속", ja: "続ける", es: "Continuar", fr: "Continuer", de: "Weiter", th: "ดำเนินการต่อ", ar: "متابعة" },
  generateAssessment: { en: "Generate Assessment", vi: "Tạo đánh giá", zh: "生成评估", ko: "평가 생성", ja: "評価を生成", es: "Generar evaluación", fr: "Générer l'évaluation", de: "Bewertung erstellen", th: "สร้างการประเมิน", ar: "إنشاء التقييم" },
  analyzing: { en: "Analyzing", vi: "Đang phân tích", zh: "分析中", ko: "분석 중", ja: "分析中", es: "Analizando", fr: "Analyse en cours", de: "Analysiere", th: "กำลังวิเคราะห์", ar: "جاري التحليل" },
  selectedCount: { en: "SELECTED", vi: "ĐÃ CHỌN", zh: "已选择", ko: "선택됨", ja: "選択済み", es: "SELECCIONADO", fr: "SÉLECTIONNÉ", de: "AUSGEWÄHLT", th: "เลือกแล้ว", ar: "محدد" },
  indicators: { en: "indicators", vi: "chỉ báo", zh: "指标", ko: "지표", ja: "指標", es: "indicadores", fr: "indicateurs", de: "Indikatoren", th: "ตัวบ่งชี้", ar: "مؤشرات" },
};

// Helper function to get translation
const t = (key, lang = "en") => T[key]?.[lang] || T[key]?.en || key;

// Zone ID to translation key mapping
const ZONE_TRANS = {
  // Main body - front
  head: "head", neck: "neck", shoulder_l: "leftShoulder", shoulder_r: "rightShoulder",
  chest: "chest", abdomen: "abdomen", arm_l: "leftArm", arm_r: "rightArm",
  hip: "hip", leg_l: "leftLeg", leg_r: "rightLeg",
  // Main body - back
  b_head: "backOfHead", b_neck: "nape", upper_back: "upperBack", lower_back: "lowerBack",
  b_arm_l: "leftArm", b_arm_r: "rightArm", buttock: "buttock", b_leg_l: "leftLeg", b_leg_r: "rightLeg",
  // Zoom - Head
  z_head_top: "topOfHead", z_forehead: "forehead", z_eye_l: "leftEye", z_eye_r: "rightEye",
  z_nose: "nose", z_ear_l: "leftEar", z_ear_r: "rightEar", z_cheek_l: "leftCheek",
  z_cheek_r: "rightCheek", z_mouth: "mouth", z_chin: "chin",
  // Zoom - Neck
  z_neck_front: "frontNeck", z_throat: "throat", z_neck_l: "leftNeck", z_neck_r: "rightNeck",
  // Zoom - Shoulder
  z_shoulder_l: "leftShoulder", z_shoulder_r: "rightShoulder", z_collarbone: "collarbone",
  // Zoom - Chest
  z_chest_l: "leftChest", z_chest_r: "rightChest", z_sternum: "sternum", z_rib_l: "leftRibs", z_rib_r: "rightRibs",
  // Zoom - Abdomen
  z_abd_upper: "upperAbdomen", z_abd_l: "leftAbdomen", z_abd_r: "rightAbdomen", z_navel: "navel", z_abd_lower: "lowerAbdomen",
  // Zoom - Upper Back
  z_upper_back_l: "leftUpperBack", z_upper_back_r: "rightUpperBack", z_spine_upper: "upperSpine",
  z_shoulder_blade_l: "leftShoulderBlade", z_shoulder_blade_r: "rightShoulderBlade",
  // Zoom - Lower Back
  z_lower_back_l: "leftLowerBack", z_lower_back_r: "rightLowerBack", z_spine_lower: "lowerSpine", z_sacrum: "sacrum",
  // Zoom - Arms
  z_shoulder_l2: "shoulder", z_shoulder_r2: "shoulder", z_upper_arm_l: "upperArm", z_upper_arm_r: "upperArm",
  z_elbow_l: "elbow", z_elbow_r: "elbow", z_forearm_l: "forearm", z_forearm_r: "forearm",
  z_wrist_l: "wrist", z_wrist_r: "wrist", z_hand_l: "hand", z_hand_r: "hand",
  // Zoom - Hip
  z_hip_l: "leftHip", z_hip_r: "rightHip", z_pelvis: "pelvis",
  // Zoom - Buttock
  z_buttock_l: "leftButtock", z_buttock_r: "rightButtock", z_tailbone: "tailbone",
  // Zoom - Legs
  z_thigh_l: "thigh", z_thigh_r: "thigh", z_knee_l: "knee", z_knee_r: "knee",
  z_shin_l: "shin", z_shin_r: "shin", z_calf_l: "calf", z_calf_r: "calf",
  z_ankle_l: "ankle", z_ankle_r: "ankle", z_foot_l: "foot", z_foot_r: "foot",
};

// Get translated zone label
const getZoneLabel = (zoneId, lang = "en") => {
  const transKey = ZONE_TRANS[zoneId];
  if (transKey) return t(transKey, lang);
  return zoneId;
};

/* ═══ API CONNECTION ═══ */
const API = "http://localhost:8000";
const apiFetch = async (path, opts = {}) => {
  try {
    const r = await fetch(`${API}${path}`, { ...opts });
    if (!r.ok) throw new Error(`API ${r.status}: ${r.statusText}`);
    return await r.json();
  } catch (e) {
    console.warn("API call failed:", path, e.message);
    return null;
  }
};
const apiUpload = async (path, file, extra = {}) => {
  const fd = new FormData();
  fd.append("file", file);
  Object.entries(extra).forEach(([k, v]) => { if (v != null) fd.append(k, String(v)); });
  return apiFetch(path, { method: "POST", body: fd });
};

/* ═══ RESPONSIVE HOOK ═══ */
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return isMobile;
};

/* ═══ GLOBAL DATA CONTEXT ═══ */
const DataContext = createContext(null);
const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
};

/* ═══ INITIAL DATA ═══ */
const INIT_P = [
  { id: "p1", name: "Emma Chen", age: 8, gender: "M", condition: "Autism Spectrum Disorder", comm: "Non-verbal", status: "warn", note: "Uses AAC device.", created: "2026-01-15" },
  { id: "p2", name: "Mary Johnson", age: 78, gender: "F", condition: "Alzheimer's (Stage 5)", comm: "Non-verbal", status: "crit", note: "Pressure ulcer risk.", created: "2026-01-10" },
  { id: "p3", name: "John Smith", age: 45, gender: "M", condition: "Broca's Aphasia", comm: "Aphasia", status: "ok", note: "Post-stroke.", created: "2026-01-20" },
];

const SYM_CATS = [
  { id: "pain", transKey: "pain", color: C.red, items: [
    { key: "sharp", en: "Sharp" }, { key: "dullAche", en: "Dull ache" }, { key: "burning", en: "Burning" }, { key: "pressure", en: "Pressure" },
    { key: "throbbing", en: "Throbbing" }, { key: "cramping", en: "Cramping" }, { key: "stinging", en: "Stinging" }, { key: "radiating", en: "Radiating" }
  ]},
  { id: "skin", transKey: "skin", color: C.amber, items: [
    { key: "redness", en: "Redness" }, { key: "swelling", en: "Swelling" }, { key: "rash", en: "Rash" }, { key: "openWound", en: "Open wound" },
    { key: "bruise", en: "Bruise" }, { key: "dryCracking", en: "Dry/cracking" }, { key: "discoloration", en: "Discoloration" }, { key: "warmth", en: "Warmth" }
  ]},
  { id: "resp", transKey: "breathing", color: C.accent, items: [
    { key: "coughing", en: "Coughing" }, { key: "wheezing", en: "Wheezing" }, { key: "shortOfBreath", en: "Short of breath" },
    { key: "congestion", en: "Congestion" }, { key: "rapidBreathing", en: "Rapid breathing" }, { key: "chestTightness", en: "Chest tightness" }
  ]},
  { id: "behav", transKey: "behavioral", color: C.purple, items: [
    { key: "agitation", en: "Agitation" }, { key: "withdrawal", en: "Withdrawal" }, { key: "vocalization", en: "Vocalization" }, { key: "guarding", en: "Guarding" },
    { key: "appetiteLoss", en: "Appetite loss" }, { key: "sleepChange", en: "Sleep change" }, { key: "restless", en: "Restless" }, { key: "crying", en: "Crying" }
  ]},
  { id: "gi", transKey: "digestive", color: C.green, items: [
    { key: "nausea", en: "Nausea" }, { key: "diarrhea", en: "Diarrhea" }, { key: "constipation", en: "Constipation" },
    { key: "bloating", en: "Bloating" }, { key: "vomiting", en: "Vomiting" }, { key: "abdominalPain", en: "Abdominal pain" }
  ]},
];

const EMOTIONS = [
  { id: "comf", transKey: "comfortable", c: C.green },
  { id: "neut", transKey: "neutral", c: C.sub },
  { id: "uneasy", transKey: "uneasy", c: C.amber },
  { id: "distress", transKey: "distressed", c: C.red },
  { id: "anxious", transKey: "anxious", c: C.purple },
  { id: "confused", transKey: "confused", c: C.accent },
];

const DURATIONS = [
  { key: "justNow", en: "just now" },
  { key: "today", en: "today" },
  { key: "twoDays", en: "2-3 days" },
  { key: "oneWeek", en: "1 week+" },
  { key: "ongoing", en: "ongoing" },
];

const RADAR_D = [{ a: "Radiology", v: 90 },{ a: "Dermatology", v: 74 },{ a: "Ophthalmology", v: 77 },{ a: "Pathology", v: 70 },{ a: "Doc AI", v: 91 },{ a: "EHR", v: 90 }];

/* ═══ BODY POINTS ═══ */
const BP = [
  { id:"f_head_top",x:50,y:4,l:"Top of head",r:"Head",v:"front" },
  { id:"f_forehead",x:50,y:7,l:"Forehead",r:"Head",v:"front" },
  { id:"f_temple_l",x:42,y:7,l:"Left temple",r:"Head",v:"front" },
  { id:"f_temple_r",x:58,y:7,l:"Right temple",r:"Head",v:"front" },
  { id:"f_eye_l",x:44,y:9.5,l:"Left eye",r:"Face",v:"front" },
  { id:"f_eye_r",x:56,y:9.5,l:"Right eye",r:"Face",v:"front" },
  { id:"f_nose",x:50,y:11,l:"Nose",r:"Face",v:"front" },
  { id:"f_cheek_l",x:43,y:12,l:"Left cheek",r:"Face",v:"front" },
  { id:"f_cheek_r",x:57,y:12,l:"Right cheek",r:"Face",v:"front" },
  { id:"f_ear_l",x:38,y:10,l:"Left ear",r:"Head",v:"front" },
  { id:"f_ear_r",x:62,y:10,l:"Right ear",r:"Head",v:"front" },
  { id:"f_mouth",x:50,y:13,l:"Mouth",r:"Face",v:"front" },
  { id:"f_chin",x:50,y:15,l:"Chin",r:"Face",v:"front" },
  { id:"f_neck_f",x:50,y:18,l:"Front neck",r:"Neck",v:"front" },
  { id:"f_throat",x:50,y:19.5,l:"Throat",r:"Neck",v:"front" },
  { id:"f_shoulder_l",x:32,y:22,l:"Left shoulder",r:"Shoulder",v:"front" },
  { id:"f_shoulder_r",x:68,y:22,l:"Right shoulder",r:"Shoulder",v:"front" },
  { id:"f_chest_c",x:50,y:28,l:"Center chest",r:"Chest",v:"front" },
  { id:"f_chest_l",x:42,y:27,l:"Left chest",r:"Chest",v:"front" },
  { id:"f_chest_r",x:58,y:27,l:"Right chest",r:"Chest",v:"front" },
  { id:"f_sternum",x:50,y:30,l:"Sternum",r:"Chest",v:"front" },
  { id:"f_abd_upper",x:50,y:35,l:"Upper abdomen",r:"Abdomen",v:"front" },
  { id:"f_abd_l",x:42,y:38,l:"Left abdomen",r:"Abdomen",v:"front" },
  { id:"f_abd_r",x:58,y:38,l:"Right abdomen",r:"Abdomen",v:"front" },
  { id:"f_navel",x:50,y:42,l:"Navel",r:"Abdomen",v:"front" },
  { id:"f_abd_lower",x:50,y:48,l:"Lower abdomen",r:"Abdomen",v:"front" },
  { id:"f_uarm_l",x:28,y:28,l:"Left upper arm",r:"Left arm",v:"front" },
  { id:"f_elbow_l",x:24,y:38,l:"Left elbow",r:"Left arm",v:"front" },
  { id:"f_wrist_l",x:18,y:50,l:"Left wrist",r:"Left arm",v:"front" },
  { id:"f_palm_l",x:16,y:55,l:"Left palm",r:"Left arm",v:"front" },
  { id:"f_uarm_r",x:72,y:28,l:"Right upper arm",r:"Right arm",v:"front" },
  { id:"f_elbow_r",x:76,y:38,l:"Right elbow",r:"Right arm",v:"front" },
  { id:"f_wrist_r",x:82,y:50,l:"Right wrist",r:"Right arm",v:"front" },
  { id:"f_palm_r",x:84,y:55,l:"Right palm",r:"Right arm",v:"front" },
  { id:"f_hip_l",x:40,y:52,l:"Left hip",r:"Hip",v:"front" },
  { id:"f_hip_r",x:60,y:52,l:"Right hip",r:"Hip",v:"front" },
  { id:"f_thigh_l",x:42,y:60,l:"Left thigh",r:"Left leg",v:"front" },
  { id:"f_knee_l",x:42,y:72,l:"Left knee",r:"Left leg",v:"front" },
  { id:"f_shin_l",x:42,y:80,l:"Left shin",r:"Left leg",v:"front" },
  { id:"f_ankle_l",x:42,y:90,l:"Left ankle",r:"Left leg",v:"front" },
  { id:"f_foot_l",x:42,y:95,l:"Left foot",r:"Left leg",v:"front" },
  { id:"f_thigh_r",x:58,y:60,l:"Right thigh",r:"Right leg",v:"front" },
  { id:"f_knee_r",x:58,y:72,l:"Right knee",r:"Right leg",v:"front" },
  { id:"f_shin_r",x:58,y:80,l:"Right shin",r:"Right leg",v:"front" },
  { id:"f_ankle_r",x:58,y:90,l:"Right ankle",r:"Right leg",v:"front" },
  { id:"f_foot_r",x:58,y:95,l:"Right foot",r:"Right leg",v:"front" },
  { id:"b_head",x:50,y:6,l:"Back of head",r:"Head",v:"back" },
  { id:"b_nape",x:50,y:16,l:"Nape",r:"Neck",v:"back" },
  { id:"b_shoulder_l",x:32,y:22,l:"Left back shoulder",r:"Upper back",v:"back" },
  { id:"b_shoulder_r",x:68,y:22,l:"Right back shoulder",r:"Upper back",v:"back" },
  { id:"b_scapula_l",x:38,y:28,l:"Left scapula",r:"Upper back",v:"back" },
  { id:"b_scapula_r",x:62,y:28,l:"Right scapula",r:"Upper back",v:"back" },
  { id:"b_spine_upper",x:50,y:25,l:"Upper spine",r:"Upper back",v:"back" },
  { id:"b_spine_mid",x:50,y:35,l:"Mid spine",r:"Lower back",v:"back" },
  { id:"b_lower_l",x:42,y:40,l:"Left lower back",r:"Lower back",v:"back" },
  { id:"b_lower_r",x:58,y:40,l:"Right lower back",r:"Lower back",v:"back" },
  { id:"b_lumbar",x:50,y:42,l:"Lumbar",r:"Lower back",v:"back" },
  { id:"b_sacrum",x:50,y:48,l:"Sacrum",r:"Lower back",v:"back" },
  { id:"b_butt_l",x:42,y:54,l:"Left buttock",r:"Buttock",v:"back" },
  { id:"b_butt_r",x:58,y:54,l:"Right buttock",r:"Buttock",v:"back" },
  { id:"b_ham_l",x:42,y:62,l:"Left hamstring",r:"Left leg",v:"back" },
  { id:"b_calf_l",x:42,y:80,l:"Left calf",r:"Left leg",v:"back" },
  { id:"b_heel_l",x:42,y:94,l:"Left heel",r:"Left leg",v:"back" },
  { id:"b_ham_r",x:58,y:62,l:"Right hamstring",r:"Right leg",v:"back" },
  { id:"b_calf_r",x:58,y:80,l:"Right calf",r:"Right leg",v:"back" },
  { id:"b_heel_r",x:58,y:94,l:"Right heel",r:"Right leg",v:"back" },
];

const REGIONS = ["All","Head","Face","Neck","Shoulder","Chest","Abdomen","Upper back","Lower back","Left arm","Right arm","Hip","Buttock","Left leg","Right leg"];
const REG_COLORS = { Head:C.accent,Face:C.cyan,Neck:C.teal,Shoulder:C.green,Chest:C.green,Abdomen:C.amber,"Upper back":C.amber,"Lower back":C.amber,"Left arm":C.purple,"Right arm":C.indigo,Hip:C.pink,Buttock:C.pink,"Left leg":C.indigo,"Right leg":C.cyan };

/* ═══ PRIMITIVES ═══ */
const Card = ({ children, style, ...r }) => <div style={{ background: C.card, borderRadius: 12, boxShadow: shadow, ...style }} {...r}>{children}</div>;
const Btn = ({ children, primary, sm, outline, style, ...r }) => <button style={{ fontFamily:"inherit", fontWeight:600, fontSize:sm?12:14, border:outline?`2px solid ${C.accent}`:primary?"none":`1px solid ${C.border}`, borderRadius:50, cursor:"pointer", display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6, background:primary?C.accent:outline?"transparent":C.card, color:primary?"#fff":outline?C.accent:C.text, padding:sm?"6px 14px":"10px 20px", transition:"all .15s", ...style }} {...r}>{children}</button>;
const Tag = ({ children, c = C.sub }) => <span style={{ fontSize:10, fontWeight:700, padding:"3px 10px", borderRadius:50, background:`${c}14`, color:c, letterSpacing:.3 }}>{children}</span>;
const Lbl = ({ children }) => <div style={{ fontSize:11, fontWeight:700, color:C.sub, textTransform:"uppercase", letterSpacing:.8, marginBottom:8 }}>{children}</div>;
const Spin = () => <span style={{ display:"inline-block", width:14, height:14, border:"2px solid rgba(255,255,255,.3)", borderTopColor:"#fff", borderRadius:"50%", animation:"cvs .5s linear infinite" }} />;
const Dot = ({ c, sz = 8 }) => <span style={{ width:sz, height:sz, borderRadius:"50%", background:c, display:"inline-block", flexShrink:0 }} />;
const Ring = ({ value, size = 48, color = C.accent }) => { const r = (size - 6) / 2, ci = 2 * Math.PI * r, off = ci * (1 - value / 100); return <svg width={size} height={size}><circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F1F5F9" strokeWidth={5}/><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5} strokeDasharray={ci} strokeDashoffset={off} strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} style={{transition:"stroke-dashoffset .6s"}}/><text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central" fontSize={size*.26} fontWeight="800" fill={C.text}>{value}</text></svg>; };

/* ═══ HELPERS ═══ */
const formatTime = (date) => {
  const now = new Date();
  const diff = now - new Date(date);
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  return `${days}d`;
};

const getUrgencyFromPain = (pain) => {
  if (pain >= 7) return "urgent";
  if (pain >= 4) return "attention";
  return "routine";
};

const generateAlertFromAssessment = (assessment, patient) => {
  const urgency = assessment.result?.urgency || getUrgencyFromPain(assessment.pain_level);
  const sev = urgency === "urgent" ? "crit" : urgency === "attention" ? "warn" : "ok";
  let title = "Assessment recorded";
  let desc = `Pain level: ${assessment.pain_level}/10`;
  if (assessment.symptoms.length > 0) {
    const skinSyms = assessment.symptoms.filter(s => SYM_CATS.find(c => c.id === "skin")?.items.includes(s));
    const painSyms = assessment.symptoms.filter(s => SYM_CATS.find(c => c.id === "pain")?.items.includes(s));
    const behavSyms = assessment.symptoms.filter(s => SYM_CATS.find(c => c.id === "behav")?.items.includes(s));
    if (skinSyms.length > 0) { title = "Skin anomaly detected"; desc = skinSyms.join(", "); }
    else if (behavSyms.length > 0) { title = "Behavioral change"; desc = behavSyms.join(", "); }
    else if (painSyms.length > 0) { title = "Pain reported"; desc = painSyms.join(", "); }
  }
  return { id: assessment.id, sev, t: title, d: desc, time: formatTime(assessment.timestamp), p: patient?.name || "Unknown", patient_id: assessment.patient_id, timestamp: assessment.timestamp };
};

/* ═══ BODY ZONES - Realistic human silhouette ═══ */
const BODY_ZONES = {
  front: [
    // Head - oval shape
    { id: "head", label: "Head", path: "M50 8 C42 8 36 14 36 24 C36 34 42 42 50 42 C58 42 64 34 64 24 C64 14 58 8 50 8", color: C.cyan, hasDetail: true },
    // Neck
    { id: "neck", label: "Neck", path: "M46 42 L54 42 L56 50 L44 50 Z", color: C.teal },
    // Shoulders & Upper torso
    { id: "shoulder_l", label: "Left Shoulder", path: "M44 50 L32 52 C28 53 26 56 26 60 L32 60 L44 56 Z", color: C.green },
    { id: "shoulder_r", label: "Right Shoulder", path: "M56 50 L68 52 C72 53 74 56 74 60 L68 60 L56 56 Z", color: C.green },
    // Chest
    { id: "chest", label: "Chest", path: "M44 50 L56 50 L58 56 L60 72 L40 72 L42 56 Z", color: C.accent, hasDetail: true },
    // Abdomen
    { id: "abdomen", label: "Abdomen", path: "M40 72 L60 72 L58 100 L42 100 Z", color: C.amber, hasDetail: true },
    // Left Arm
    { id: "arm_l", label: "Left Arm", path: "M32 60 C28 62 24 68 22 78 C20 88 18 98 16 108 L22 110 C24 100 26 90 28 80 C30 72 32 66 34 62 Z", color: C.indigo, hasDetail: true },
    // Right Arm
    { id: "arm_r", label: "Right Arm", path: "M68 60 C72 62 76 68 78 78 C80 88 82 98 84 108 L78 110 C76 100 74 90 72 80 C70 72 68 66 66 62 Z", color: C.indigo, hasDetail: true },
    // Hip/Pelvis
    { id: "hip", label: "Hip", path: "M42 100 L58 100 L62 112 L38 112 Z", color: C.pink },
    // Left Leg
    { id: "leg_l", label: "Left Leg", path: "M38 112 L50 112 L48 148 L36 148 C36 138 36 128 37 118 Z", color: C.purple, hasDetail: true },
    // Right Leg
    { id: "leg_r", label: "Right Leg", path: "M50 112 L62 112 C63 118 64 128 64 138 L64 148 L52 148 L50 112 Z", color: C.purple, hasDetail: true },
  ],
  back: [
    // Head
    { id: "b_head", label: "Back of Head", path: "M50 8 C42 8 36 14 36 24 C36 34 42 42 50 42 C58 42 64 34 64 24 C64 14 58 8 50 8", color: C.cyan },
    // Neck/Nape
    { id: "b_neck", label: "Nape", path: "M46 42 L54 42 L56 50 L44 50 Z", color: C.teal },
    // Upper Back
    { id: "upper_back", label: "Upper Back", path: "M32 52 L68 52 L66 72 L34 72 Z", color: C.green },
    // Lower Back
    { id: "lower_back", label: "Lower Back", path: "M34 72 L66 72 L62 100 L38 100 Z", color: C.amber },
    // Left Arm (back)
    { id: "b_arm_l", label: "Left Arm (Back)", path: "M32 52 C26 56 22 68 20 82 C18 96 16 106 16 110 L22 112 C24 100 26 88 28 76 C30 64 32 56 34 54 Z", color: C.indigo },
    // Right Arm (back)
    { id: "b_arm_r", label: "Right Arm (Back)", path: "M68 52 C74 56 78 68 80 82 C82 96 84 106 84 110 L78 112 C76 100 74 88 72 76 C70 64 68 56 66 54 Z", color: C.indigo },
    // Buttock
    { id: "buttock", label: "Buttock", path: "M38 100 L62 100 L64 118 L36 118 Z", color: C.pink },
    // Left Leg (back)
    { id: "b_leg_l", label: "Left Leg (Back)", path: "M36 118 L50 118 L48 148 L34 148 Z", color: C.purple },
    // Right Leg (back)
    { id: "b_leg_r", label: "Right Leg (Back)", path: "M50 118 L64 118 L66 148 L52 148 Z", color: C.purple },
  ]
};

/* ═══ BODY TYPES ═══ */
const BODY_TYPES = [
  { id: "male", label: "Male", icon: "👨" },
  { id: "female", label: "Female", icon: "👩" },
  { id: "child", label: "Child", icon: "🧒" },
];

/* ═══ REGION FILTERS with zoom mapping ═══ */
const REGION_FILTERS = [
  { id: "all", transKey: "all", zoom: null },
  { id: "head", transKey: "head", zoom: "head" },
  { id: "face", transKey: "face", zoom: "head" },
  { id: "neck", transKey: "neck", zoom: "neck" },
  { id: "shoulder", transKey: "shoulder", zoom: "shoulder" },
  { id: "chest", transKey: "chest", zoom: "chest" },
  { id: "abdomen", transKey: "abdomen", zoom: "abdomen" },
  { id: "upper_back", transKey: "upperBack", zoom: "upper_back" },
  { id: "lower_back", transKey: "lowerBack", zoom: "lower_back" },
  { id: "arm_l", transKey: "leftArm", zoom: "arm_l" },
  { id: "arm_r", transKey: "rightArm", zoom: "arm_r" },
  { id: "hip", transKey: "hip", zoom: "hip" },
  { id: "buttock", transKey: "buttock", zoom: "buttock" },
  { id: "leg_l", transKey: "leftLeg", zoom: "leg_l" },
  { id: "leg_r", transKey: "rightLeg", zoom: "leg_r" },
];

/* ═══ ZOOMED DETAIL ZONES ═══ */
const ZOOM_ZONES = {
  head: {
    label: "Head",
    viewBox: "0 0 100 100",
    zones: [
      { id: "z_head_top", label: "Top of Head", path: "M20 5 Q50 0 80 5 Q85 20 80 35 L20 35 Q15 20 20 5", color: C.cyan },
      { id: "z_forehead", label: "Forehead", path: "M20 35 L80 35 L78 48 L22 48 Z", color: C.purple },
      { id: "z_eye_l", label: "Left Eye", path: "M18 48 Q32 44 42 50 Q42 58 32 62 Q18 58 18 48", color: C.accent },
      { id: "z_eye_r", label: "Right Eye", path: "M58 50 Q68 44 82 48 Q82 58 68 62 Q58 58 58 50", color: C.accent },
      { id: "z_nose", label: "Nose", path: "M42 52 L58 52 L55 72 L50 76 L45 72 Z", color: C.amber },
      { id: "z_ear_l", label: "Left Ear", path: "M5 42 Q0 52 5 65 L16 60 L16 47 Z", color: C.green },
      { id: "z_ear_r", label: "Right Ear", path: "M95 42 L84 47 L84 60 L95 65 Q100 52 95 42", color: C.green },
      { id: "z_cheek_l", label: "Left Cheek", path: "M16 60 L40 58 L38 75 L18 72 Z", color: C.pink },
      { id: "z_cheek_r", label: "Right Cheek", path: "M60 58 L84 60 L82 72 L62 75 Z", color: C.pink },
      { id: "z_mouth", label: "Mouth", path: "M35 76 L65 76 L62 88 L38 88 Z", color: C.red },
      { id: "z_chin", label: "Chin", path: "M38 88 L62 88 Q55 98 50 100 Q45 98 38 88", color: C.teal },
    ]
  },
  neck: {
    label: "Neck",
    viewBox: "0 0 100 80",
    zones: [
      { id: "z_neck_front", label: "Front Neck", path: "M30 10 L70 10 L72 40 L28 40 Z", color: C.teal },
      { id: "z_throat", label: "Throat", path: "M38 40 L62 40 L60 60 L40 60 Z", color: C.amber },
      { id: "z_neck_l", label: "Left Neck", path: "M10 15 L30 10 L28 50 L12 45 Z", color: C.green },
      { id: "z_neck_r", label: "Right Neck", path: "M70 10 L90 15 L88 45 L72 50 Z", color: C.green },
    ]
  },
  shoulder: {
    label: "Shoulders",
    viewBox: "0 0 100 60",
    zones: [
      { id: "z_shoulder_l", label: "Left Shoulder", path: "M5 10 L45 10 L42 50 L8 45 Q2 30 5 10", color: C.green },
      { id: "z_shoulder_r", label: "Right Shoulder", path: "M55 10 L95 10 Q98 30 92 45 L58 50 L55 10", color: C.green },
      { id: "z_collarbone", label: "Collarbone", path: "M20 20 L80 20 L78 35 L22 35 Z", color: C.purple },
    ]
  },
  chest: {
    label: "Chest",
    viewBox: "0 0 100 100",
    zones: [
      { id: "z_chest_l", label: "Left Chest", path: "M8 8 L48 8 L48 45 L8 42 Z", color: C.accent },
      { id: "z_chest_r", label: "Right Chest", path: "M52 8 L92 8 L92 42 L52 45 Z", color: C.accent },
      { id: "z_sternum", label: "Sternum", path: "M42 8 L58 8 L56 55 L44 55 Z", color: C.amber },
      { id: "z_rib_l", label: "Left Ribs", path: "M8 45 L44 48 L40 90 L8 82 Z", color: C.purple },
      { id: "z_rib_r", label: "Right Ribs", path: "M56 48 L92 45 L92 82 L60 90 Z", color: C.purple },
    ]
  },
  abdomen: {
    label: "Abdomen",
    viewBox: "0 0 100 100",
    zones: [
      { id: "z_abd_upper", label: "Upper Abdomen", path: "M12 5 L88 5 L85 35 L15 35 Z", color: C.amber },
      { id: "z_abd_l", label: "Left Abdomen", path: "M8 35 L45 35 L42 65 L8 60 Z", color: C.teal },
      { id: "z_abd_r", label: "Right Abdomen", path: "M55 35 L92 35 L92 60 L58 65 Z", color: C.teal },
      { id: "z_navel", label: "Navel", path: "M38 45 Q50 40 62 45 Q65 55 62 65 Q50 70 38 65 Q35 55 38 45", color: C.pink },
      { id: "z_abd_lower", label: "Lower Abdomen", path: "M10 65 L90 65 L88 95 L12 95 Z", color: C.indigo },
    ]
  },
  upper_back: {
    label: "Upper Back",
    viewBox: "0 0 100 100",
    zones: [
      { id: "z_upper_back_l", label: "Left Upper Back", path: "M8 8 L48 8 L46 50 L10 48 Z", color: C.green },
      { id: "z_upper_back_r", label: "Right Upper Back", path: "M52 8 L92 8 L90 48 L54 50 Z", color: C.green },
      { id: "z_spine_upper", label: "Upper Spine", path: "M44 8 L56 8 L55 50 L45 50 Z", color: C.purple },
      { id: "z_shoulder_blade_l", label: "Left Shoulder Blade", path: "M15 50 L45 52 L42 90 L12 85 Z", color: C.teal },
      { id: "z_shoulder_blade_r", label: "Right Shoulder Blade", path: "M55 52 L85 50 L88 85 L58 90 Z", color: C.teal },
    ]
  },
  lower_back: {
    label: "Lower Back",
    viewBox: "0 0 100 100",
    zones: [
      { id: "z_lower_back_l", label: "Left Lower Back", path: "M10 8 L48 8 L46 50 L12 48 Z", color: C.amber },
      { id: "z_lower_back_r", label: "Right Lower Back", path: "M52 8 L90 8 L88 48 L54 50 Z", color: C.amber },
      { id: "z_spine_lower", label: "Lower Spine", path: "M44 8 L56 8 L55 92 L45 92 Z", color: C.purple },
      { id: "z_sacrum", label: "Sacrum", path: "M35 70 L65 70 L62 95 L38 95 Z", color: C.pink },
    ]
  },
  arm_l: {
    label: "Left Arm",
    viewBox: "0 0 100 150",
    zones: [
      { id: "z_shoulder_l2", label: "Shoulder", path: "M15 5 L85 5 L82 25 L18 25 Z", color: C.green },
      { id: "z_upper_arm_l", label: "Upper Arm", path: "M18 25 L82 25 L78 60 L22 60 Z", color: C.accent },
      { id: "z_elbow_l", label: "Elbow", path: "M22 60 L78 60 L75 80 L25 80 Z", color: C.amber },
      { id: "z_forearm_l", label: "Forearm", path: "M25 80 L75 80 L72 115 L28 115 Z", color: C.purple },
      { id: "z_wrist_l", label: "Wrist", path: "M28 115 L72 115 L70 130 L30 130 Z", color: C.teal },
      { id: "z_hand_l", label: "Hand", path: "M30 130 L70 130 L68 148 L32 148 Z", color: C.pink },
    ]
  },
  arm_r: {
    label: "Right Arm",
    viewBox: "0 0 100 150",
    zones: [
      { id: "z_shoulder_r2", label: "Shoulder", path: "M15 5 L85 5 L82 25 L18 25 Z", color: C.green },
      { id: "z_upper_arm_r", label: "Upper Arm", path: "M18 25 L82 25 L78 60 L22 60 Z", color: C.accent },
      { id: "z_elbow_r", label: "Elbow", path: "M22 60 L78 60 L75 80 L25 80 Z", color: C.amber },
      { id: "z_forearm_r", label: "Forearm", path: "M25 80 L75 80 L72 115 L28 115 Z", color: C.purple },
      { id: "z_wrist_r", label: "Wrist", path: "M28 115 L72 115 L70 130 L30 130 Z", color: C.teal },
      { id: "z_hand_r", label: "Hand", path: "M30 130 L70 130 L68 148 L32 148 Z", color: C.pink },
    ]
  },
  hip: {
    label: "Hip",
    viewBox: "0 0 100 80",
    zones: [
      { id: "z_hip_l", label: "Left Hip", path: "M5 10 L48 10 L46 70 L8 65 Z", color: C.pink },
      { id: "z_hip_r", label: "Right Hip", path: "M52 10 L95 10 L92 65 L54 70 Z", color: C.pink },
      { id: "z_pelvis", label: "Pelvis", path: "M35 30 L65 30 L62 70 L38 70 Z", color: C.purple },
    ]
  },
  buttock: {
    label: "Buttock",
    viewBox: "0 0 100 80",
    zones: [
      { id: "z_buttock_l", label: "Left Buttock", path: "M8 8 L48 8 L46 72 L10 68 Z", color: C.pink },
      { id: "z_buttock_r", label: "Right Buttock", path: "M52 8 L92 8 L90 68 L54 72 Z", color: C.pink },
      { id: "z_tailbone", label: "Tailbone", path: "M40 5 L60 5 L58 30 L42 30 Z", color: C.purple },
    ]
  },
  leg_l: {
    label: "Left Leg",
    viewBox: "0 0 100 180",
    zones: [
      { id: "z_thigh_l", label: "Thigh", path: "M15 5 L85 5 L82 65 L18 65 Z", color: C.accent },
      { id: "z_knee_l", label: "Knee", path: "M20 65 L80 65 L78 90 L22 90 Z", color: C.amber },
      { id: "z_shin_l", label: "Shin", path: "M22 90 L78 90 L75 140 L25 140 Z", color: C.green },
      { id: "z_calf_l", label: "Calf", path: "M28 100 L72 100 L70 135 L30 135 Z", color: C.teal },
      { id: "z_ankle_l", label: "Ankle", path: "M28 140 L72 140 L70 158 L30 158 Z", color: C.purple },
      { id: "z_foot_l", label: "Foot", path: "M25 158 L75 158 L78 175 L22 175 Z", color: C.pink },
    ]
  },
  leg_r: {
    label: "Right Leg",
    viewBox: "0 0 100 180",
    zones: [
      { id: "z_thigh_r", label: "Thigh", path: "M15 5 L85 5 L82 65 L18 65 Z", color: C.accent },
      { id: "z_knee_r", label: "Knee", path: "M20 65 L80 65 L78 90 L22 90 Z", color: C.amber },
      { id: "z_shin_r", label: "Shin", path: "M22 90 L78 90 L75 140 L25 140 Z", color: C.green },
      { id: "z_calf_r", label: "Calf", path: "M28 100 L72 100 L70 135 L30 135 Z", color: C.teal },
      { id: "z_ankle_r", label: "Ankle", path: "M28 140 L72 140 L70 158 L30 158 Z", color: C.purple },
      { id: "z_foot_r", label: "Foot", path: "M25 158 L75 158 L78 175 L22 175 Z", color: C.pink },
    ]
  },
};

/* ═══ BODY PICKER - Click filter to zoom ═══ */
function BodyPicker({ sel, setSel, bodyType, setBodyType, lang, setLang }) {
  const isMobile = useIsMobile();
  const [view, setView] = useState("front");
  const [hovZone, setHovZone] = useState(null);
  const [zoomRegion, setZoomRegion] = useState(null);
  const [showLangPicker, setShowLangPicker] = useState(false);

  // Get zones based on zoom state
  const { zones, viewBox } = useMemo(() => {
    if (zoomRegion && ZOOM_ZONES[zoomRegion]) {
      return { zones: ZOOM_ZONES[zoomRegion].zones, viewBox: ZOOM_ZONES[zoomRegion].viewBox };
    }
    return { zones: BODY_ZONES[view] || [], viewBox: "0 0 100 156" };
  }, [view, zoomRegion]);

  // Toggle zone selection
  const toggleZone = useCallback((zone) => {
    setSel(s => s.includes(zone.id) ? s.filter(x => x !== zone.id) : [...s, zone.id]);
  }, [setSel]);

  // Check if zone is selected
  const isZoneSelected = useCallback((zone) => sel.includes(zone.id), [sel]);

  // Handle filter click - zoom into region
  const handleFilterClick = (filter) => {
    if (filter.zoom === null) {
      setZoomRegion(null);
    } else {
      setZoomRegion(filter.zoom);
    }
  };

  // Get selected zone IDs for translation
  const selectedZoneIds = useMemo(() => {
    const ids = [];
    [...BODY_ZONES.front, ...BODY_ZONES.back].forEach(zone => {
      if (sel.includes(zone.id)) ids.push(zone.id);
    });
    Object.values(ZOOM_ZONES).forEach(region => {
      region.zones.forEach(zone => {
        if (sel.includes(zone.id)) ids.push(zone.id);
      });
    });
    return [...new Set(ids)];
  }, [sel]);

  // Current language info
  const currentLang = LANGUAGES.find(l => l.id === lang) || LANGUAGES[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Language Selector - Floating */}
      <div style={{ position: "relative" }}>
        <div 
          onClick={() => setShowLangPicker(!showLangPicker)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px",
            borderRadius: 10, border: `1px solid ${C.border}`, cursor: "pointer",
            background: C.card, boxShadow: shadow, fontSize: 14
          }}
        >
          <span style={{ fontSize: 20 }}>{currentLang.flag}</span>
          <span style={{ fontWeight: 600, color: C.text }}>{currentLang.label}</span>
          <span style={{ color: C.mute, fontSize: 12 }}>▼</span>
        </div>
        
        {/* Language Dropdown */}
        {showLangPicker && (
          <div style={{
            position: "absolute", top: "100%", left: 0, marginTop: 6, zIndex: 100,
            background: C.card, borderRadius: 12, boxShadow: "0 10px 40px rgba(0,0,0,.15)",
            border: `1px solid ${C.border}`, padding: 8, minWidth: 180
          }}>
            {LANGUAGES.map(l => (
              <div 
                key={l.id}
                onClick={() => { setLang(l.id); setShowLangPicker(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                  borderRadius: 8, cursor: "pointer", transition: "all .15s",
                  background: lang === l.id ? `${C.accent}15` : "transparent",
                  color: lang === l.id ? C.accent : C.text
                }}
                onMouseEnter={e => e.currentTarget.style.background = lang === l.id ? `${C.accent}15` : "#F8FAFC"}
                onMouseLeave={e => e.currentTarget.style.background = lang === l.id ? `${C.accent}15` : "transparent"}
              >
                <span style={{ fontSize: 22 }}>{l.flag}</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{l.label}</span>
                {lang === l.id && <span style={{ marginLeft: "auto", color: C.accent }}>✓</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Controls Row */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        {/* View Toggle - only when not zoomed */}
        {!zoomRegion && (
          <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}` }}>
            {["front", "back"].map(v => (
              <div key={v} onClick={() => setView(v)} style={{
                padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                background: view === v ? C.accent : "transparent", color: view === v ? "#fff" : C.sub, transition: "all .15s"
              }}>
                👤 {v === "front" ? t("front", lang) : t("backView", lang)}
              </div>
            ))}
          </div>
        )}

        {/* Zoom region indicator */}
        {zoomRegion && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ padding: "10px 16px", borderRadius: 10, background: C.accent, color: "#fff", fontSize: 13, fontWeight: 600 }}>
              🔍 {t(zoomRegion === "arm_l" ? "leftArm" : zoomRegion === "arm_r" ? "rightArm" : zoomRegion === "leg_l" ? "leftLeg" : zoomRegion === "leg_r" ? "rightLeg" : zoomRegion === "upper_back" ? "upperBack" : zoomRegion === "lower_back" ? "lowerBack" : zoomRegion, lang)}
            </div>
            <div onClick={() => setZoomRegion(null)} style={{
              padding: "10px 16px", borderRadius: 10, border: `1px solid ${C.border}`, cursor: "pointer",
              fontSize: 13, fontWeight: 600, color: C.sub
            }}>
              ← {t("fullBody", lang)}
            </div>
          </div>
        )}

        {/* Body Type */}
        <div style={{ display: "flex", gap: 6 }}>
          {BODY_TYPES.map(bt => (
            <div key={bt.id} onClick={() => setBodyType(bt.id)} style={{
              padding: "8px 14px", borderRadius: 8, cursor: "pointer",
              border: `2px solid ${bodyType === bt.id ? C.accent : C.border}`,
              background: bodyType === bt.id ? `${C.accent}10` : "transparent",
              fontSize: 12, fontWeight: 600, color: bodyType === bt.id ? C.accent : C.sub
            }}>
              {bt.icon} {t(bt.id, lang)}
            </div>
          ))}
        </div>

        {/* Selection count */}
        <div style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: C.accent, padding: "6px 12px", borderRadius: 6, background: `${C.accent}10` }}>
          {sel.length} {t("selected", lang)}
        </div>
      </div>

      {/* Region Filters - Click to zoom */}
      <Card style={{ padding: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {REGION_FILTERS.map(r => (
            <div key={r.id} onClick={() => handleFilterClick(r)} style={{
              padding: "6px 14px", borderRadius: 50, fontSize: 12, fontWeight: 600, cursor: "pointer",
              background: (zoomRegion === r.zoom) || (r.zoom === null && !zoomRegion) ? C.accent : "#F1F5F9", 
              color: (zoomRegion === r.zoom) || (r.zoom === null && !zoomRegion) ? "#fff" : C.sub,
              transition: "all .15s"
            }}>
              {t(r.transKey, lang)}
            </div>
          ))}
        </div>
      </Card>

      {/* Main Body Display */}
      <div style={{ display: "flex", gap: 16, flexDirection: isMobile ? "column" : "row" }}>
        {/* Body Figure */}
        <Card style={{ flex: 1, padding: 20, background: "#FAFBFC", minHeight: isMobile ? 450 : 550 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <svg viewBox={viewBox} style={{ width: "100%", maxWidth: isMobile ? 300 : 380, height: "auto" }} preserveAspectRatio="xMidYMid meet">
              <defs>
                <filter id="selectedGlow">
                  <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#3B82F6" floodOpacity="0.7"/>
                </filter>
              </defs>

              {/* Interactive zones */}
              {zones.map(zone => {
                const selected = isZoneSelected(zone);
                const hovered = hovZone === zone.id;
                
                // Map zone id to zoom region for full body view
                const zoneToZoom = {
                  head: "head", neck: "neck", shoulder_l: "shoulder", shoulder_r: "shoulder",
                  chest: "chest", abdomen: "abdomen", arm_l: "arm_l", arm_r: "arm_r",
                  hip: "hip", leg_l: "leg_l", leg_r: "leg_r",
                  b_head: "head", b_neck: "neck", upper_back: "upper_back", lower_back: "lower_back",
                  b_arm_l: "arm_l", b_arm_r: "arm_r", buttock: "buttock", b_leg_l: "leg_l", b_leg_r: "leg_r"
                };

                const handleClick = () => {
                  if (zoomRegion) {
                    // Already zoomed - select the zone
                    toggleZone(zone);
                  } else {
                    // Full body view - zoom into the region
                    const targetZoom = zoneToZoom[zone.id];
                    if (targetZoom && ZOOM_ZONES[targetZoom]) {
                      setZoomRegion(targetZoom);
                    }
                  }
                };

                return (
                  <g key={zone.id}>
                    <path
                      d={zone.path}
                      fill={selected ? zone.color : hovered ? `${zone.color}70` : `${zone.color}30`}
                      stroke={selected ? zone.color : hovered ? zone.color : `${zone.color}50`}
                      strokeWidth={selected ? 2.5 : hovered ? 2 : 1}
                      style={{ 
                        cursor: "pointer", 
                        transition: "all .15s ease",
                        filter: selected ? "url(#selectedGlow)" : "none"
                      }}
                      onClick={handleClick}
                      onMouseEnter={() => setHovZone(zone.id)}
                      onMouseLeave={() => setHovZone(null)}
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Hover tooltip */}
          {hovZone && (
            <div style={{ textAlign: "center", marginTop: 12, fontSize: 14, fontWeight: 600, color: C.text }}>
              {getZoneLabel(hovZone, lang)}
              {!zoomRegion && <span style={{ fontSize: 11, color: C.accent, marginLeft: 8 }}>→ {t("clickToZoom", lang)}</span>}
            </div>
          )}

          {/* Instructions */}
          <div style={{ textAlign: "center", marginTop: 8, fontSize: 12, color: C.mute }}>
            {zoomRegion ? t("tapToSelect", lang) : t("tapToZoom", lang)}
          </div>
        </Card>

        {/* Selected Zones Panel */}
        <div style={{ width: isMobile ? "100%" : 220, flexShrink: 0 }}>
          <Card style={{ padding: 14, height: "100%", minHeight: 200 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{t("selected", lang)}</div>
              {sel.length > 0 && <span onClick={() => setSel([])} style={{ fontSize: 11, color: C.red, cursor: "pointer", fontWeight: 600 }}>{t("clear", lang)}</span>}
            </div>
            
            {sel.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 10px", color: C.mute, fontSize: 12 }}>
                <div style={{ fontSize: 32, marginBottom: 8, opacity: .4 }}>👆</div>
                {t("tapBodyAreas", lang)}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 400, overflowY: "auto" }}>
                {selectedZoneIds.map(zoneId => (
                  <div key={zoneId} style={{ 
                    padding: "8px 12px", borderRadius: 8, 
                    background: `${C.accent}10`, color: C.accent, 
                    fontSize: 12, fontWeight: 600,
                    display: "flex", alignItems: "center", gap: 6
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent }}/>
                    {getZoneLabel(zoneId, lang)}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ═══ DASHBOARD ═══ */
function Dashboard({ go }) {
  const { patients, assessments, imageAnalyses, getPatient } = useData();
  const isMobile = useIsMobile();
  
  const alerts = useMemo(() => {
    return assessments.slice(0, 10).map(a => {
      const patient = getPatient(a.patient_id);
      return generateAlertFromAssessment(a, patient);
    }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [assessments, getPatient]);

  const recentAlerts = alerts.slice(0, 3);

  return (
    <div className="cv-f">
      <div style={{ borderRadius: 16, background: "linear-gradient(135deg, #3B82F6 0%, #6366F1 50%, #8B5CF6 100%)", padding: isMobile ? "20px 16px" : "28px 32px", marginBottom: 16, position: "relative", overflow: "hidden", color: "#fff" }}>
        <div style={{ position: "absolute", inset: 0, opacity: .1, backgroundImage: "radial-gradient(circle at 20% 50%, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div><div style={{ fontSize: 12, opacity: .8, marginBottom: 4 }}>✦ Welcome, Doctor!</div><div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 800, marginBottom: 4 }}>Welcome to CareVault</div><div style={{ fontSize: 13, opacity: .85 }}>AI-powered diagnosis & smart patient monitoring</div></div>
          {!isMobile && <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(255,255,255,.15)", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div>}
        </div>
      </div>
      
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,minmax(0,1fr))", gap: 12, marginBottom: 16 }}>
        {[
          { l: "PATIENTS", v: patients.length, c: C.accent, pct: "total" },
          { l: "ASSESSMENTS", v: assessments.length, c: C.amber, pct: "recorded" },
          { l: "IMAGES", v: imageAnalyses.length, c: C.teal, pct: "analyzed" },
          { l: "ALERTS", v: alerts.filter(a => a.sev !== "ok").length, c: C.red, pct: "active" }
        ].map((m,i) => (
          <Card key={i} style={{ padding: isMobile ? "14px 16px" : "18px 20px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.mute, letterSpacing: .5, marginBottom: 8 }}>{m.l}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: isMobile ? 26 : 32, fontWeight: 800, color: C.text }}>{m.v}</span>
              <span style={{ fontSize: 11, color: C.sub }}>{m.pct}</span>
            </div>
          </Card>
        ))}
      </div>
      
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 14 }}>
        <Card style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div><div style={{ fontSize: 14, fontWeight: 700 }}>Patients</div><div style={{ fontSize: 11, color: C.mute }}>Monitoring</div></div>
            <span onClick={() => go("patients")} style={{ fontSize: 11, color: C.accent, fontWeight: 600, cursor: "pointer" }}>All →</span>
          </div>
          <div style={{ flex: 1 }}>
          {patients.slice(0, 3).map((p, i) => (
            <div key={p.id} style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: i < 2 ? `1px solid ${C.border}08` : "none" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${stC(p.status)}10`, border: `2px solid ${stC(p.status)}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: stC(p.status), flexShrink: 0 }}>{p.name[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name} <span style={{ fontWeight: 400, color: C.sub, fontSize: 11 }}>· {p.age}y</span></div>
                <div style={{ fontSize: 11, color: C.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.condition}</div>
              </div>
              <Tag c={stC(p.status)}>{p.comm === "Non-verbal" ? "NON-V" : p.comm.slice(0,5).toUpperCase()}</Tag>
            </div>
          ))}
          </div>
          <div onClick={() => go("patients")} style={{ padding: "12px 16px", borderTop: `1px solid ${C.border}`, cursor: "pointer", fontSize: 12, color: C.accent, fontWeight: 600, textAlign: "center" }}>+ Add patient</div>
        </Card>
        
        <Card style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div><div style={{ fontSize: 14, fontWeight: 700 }}>AI Capabilities</div><div style={{ fontSize: 11, color: C.mute }}>MedGemma 1.5</div></div>
            <Tag c={C.purple}>Pro</Tag>
          </div>
          <div style={{ height: isMobile ? 180 : 220 }}><ResponsiveContainer><RadarChart data={RADAR_D}><PolarGrid stroke="#F1F5F9"/><PolarAngleAxis dataKey="a" tick={{ fontSize: 9, fill: C.sub }}/><Radar dataKey="v" stroke={C.purple} fill={C.purple} fillOpacity={.1} strokeWidth={2}/></RadarChart></ResponsiveContainer></div>
        </Card>
        
        <Card style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div><div style={{ fontSize: 14, fontWeight: 700 }}>Alerts</div><div style={{ fontSize: 11, color: C.mute }}>{alerts.length} total</div></div>
            <span onClick={() => go("alerts")} style={{ fontSize: 11, color: C.accent, fontWeight: 600, cursor: "pointer" }}>All →</span>
          </div>
          <div style={{ flex: 1 }}>
          {recentAlerts.length === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center", color: C.mute, fontSize: 12 }}>No alerts yet. Create an assessment to generate alerts.</div>
          ) : recentAlerts.map((a, i) => {
            const sc = a.sev === "crit" ? C.red : a.sev === "warn" ? C.amber : C.green;
            const bg = a.sev === "crit" ? "#FEF2F2" : a.sev === "warn" ? "#FFFBEB" : "#F0FDF4";
            return (
              <div key={a.id} style={{ padding: "10px 14px", background: bg, borderBottom: i < 2 ? `1px solid ${C.border}08` : "none" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: `${sc}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: sc }}>{a.sev === "crit" ? "!" : a.sev === "warn" ? "⚠" : "✓"}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 1 }}>{a.t}</div>
                    <div style={{ fontSize: 10, color: C.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.d}</div>
                    <div style={{ fontSize: 9, color: C.mute, marginTop: 2 }}>{a.p} · {a.time}</div>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ═══ ALERTS PAGE ═══ */
function AlertsPage({ go }) {
  const { patients, assessments, getPatient } = useData();
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState("all");
  
  const alerts = useMemo(() => {
    return assessments.map(a => {
      const patient = getPatient(a.patient_id);
      return generateAlertFromAssessment(a, patient);
    }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [assessments, getPatient]);
  
  const filtered = filter === "all" ? alerts : alerts.filter(a => a.sev === filter);
  
  return (
    <div className="cv-f">
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: isMobile ? 20 : 22, fontWeight: 800, marginBottom: 4 }}>Alerts</h2>
        <p style={{ fontSize: 12, color: C.sub }}>Generated from assessments</p>
      </div>
      
      <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", paddingBottom: 4 }}>
        {[{ id: "all", l: "All", c: C.accent }, { id: "crit", l: "Critical", c: C.red }, { id: "warn", l: "Warning", c: C.amber }, { id: "ok", l: "Normal", c: C.green }].map(f => (
          <div key={f.id} onClick={() => setFilter(f.id)} style={{ padding: "6px 14px", borderRadius: 50, fontSize: 11, fontWeight: 600, cursor: "pointer", background: filter === f.id ? f.c : C.card, color: filter === f.id ? "#fff" : C.sub, boxShadow: shadow, whiteSpace: "nowrap" }}>
            {f.l} ({f.id === "all" ? alerts.length : alerts.filter(a => a.sev === f.id).length})
          </div>
        ))}
      </div>
      
      <Card style={{ overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 10, opacity: .3 }}>🔔</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No alerts</div>
            <div style={{ fontSize: 12, color: C.mute }}>Create assessments to generate alerts</div>
            <Btn primary onClick={() => go("bridge")} style={{ marginTop: 14 }}>SymptomBridge</Btn>
          </div>
        ) : filtered.map((a, i) => {
          const sc = a.sev === "crit" ? C.red : a.sev === "warn" ? C.amber : C.green;
          const bg = a.sev === "crit" ? "#FEF2F2" : a.sev === "warn" ? "#FFFBEB" : "#F0FDF4";
          return (
            <div key={a.id} style={{ padding: "14px 16px", background: bg, borderBottom: `1px solid ${C.border}08`, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${sc}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: sc }}>{a.sev === "crit" ? "!" : a.sev === "warn" ? "⚠" : "✓"}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{a.t}</div>
                <div style={{ fontSize: 11, color: C.sub }}>{a.d}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{a.p}</div>
                <div style={{ fontSize: 10, color: C.mute }}>{a.time}</div>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

/* ═══ PATIENTS ═══ */
function Patients({ go, setPat }) {
  const { patients, addPatient, updatePatient, deletePatient } = useData();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name:"", age:"", gender:"M", condition:"", comm:"Non-verbal", note:"" });
  
  const filt = patients.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.condition.toLowerCase().includes(search.toLowerCase()));
  const rf = () => setForm({ name:"", age:"", gender:"M", condition:"", comm:"Non-verbal", note:"" });
  
  const add = () => { 
    if(!form.name||!form.age||!form.condition) return; 
    addPatient({
      id: "p" + Date.now(),
      name: form.name,
      age: +form.age,
      gender: form.gender,
      condition: form.condition,
      comm: form.comm,
      note: form.note,
      status: "ok",
      created: new Date().toISOString().slice(0,10)
    });
    rf(); 
    setShowAdd(false); 
  };
  
  const edit = () => { 
    if(!form.name||!form.age||!form.condition) return; 
    updatePatient({
      id: editing,
      name: form.name,
      age: +form.age,
      gender: form.gender,
      condition: form.condition,
      comm: form.comm,
      note: form.note,
    });
    rf(); 
    setEditing(null);
    setShowAdd(false);
  };
  
  const se = p => { 
    setForm({name:p.name, age:String(p.age), gender:p.gender, condition:p.condition, comm:p.comm, note:p.note||""}); 
    setEditing(p.id); 
    setShowAdd(true); 
  };
  
  const handleDelete = (patientId) => {
    if (window.confirm("Are you sure you want to delete this patient?")) {
      deletePatient(patientId);
    }
  };
  
  return (
    <div className="cv-f">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap: "wrap", gap: 10 }}>
        <div><h2 style={{ fontSize: isMobile ? 20 : 22, fontWeight:800, marginBottom:2 }}>Patients</h2><p style={{ fontSize:12, color:C.sub }}>Manage database</p></div>
        <Btn primary onClick={() => { rf(); setEditing(null); setShowAdd(!showAdd); }}>+ Add</Btn>
      </div>
      <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap: "wrap" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." className="cv-inp" style={{ flex: 1, minWidth: 150, maxWidth: 300 }}/>
        <Tag c={C.accent}>{patients.length} total</Tag>
      </div>
      {showAdd && (
        <Card style={{ padding: isMobile ? 14 : 18, marginBottom:12 }}>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:10 }}>{editing?"Edit":"Add"} Patient</div>
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 80px 80px 1fr 150px", gap:10 }}>
            <div style={{ gridColumn: isMobile ? "span 2" : "span 1" }}><label className="cv-lbl">Name</label><input className="cv-inp" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
            <div><label className="cv-lbl">Age</label><input className="cv-inp" type="number" value={form.age} onChange={e=>setForm({...form,age:e.target.value})}/></div>
            <div><label className="cv-lbl">Gender</label><select className="cv-inp" value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})}><option value="M">M</option><option value="F">F</option></select></div>
            <div style={{ gridColumn: isMobile ? "span 2" : "span 1" }}><label className="cv-lbl">Condition</label><input className="cv-inp" value={form.condition} onChange={e=>setForm({...form,condition:e.target.value})}/></div>
            <div style={{ gridColumn: isMobile ? "span 2" : "span 1" }}><label className="cv-lbl">Comm</label><select className="cv-inp" value={form.comm} onChange={e=>setForm({...form,comm:e.target.value})}><option value="Non-verbal">Non-verbal</option><option value="Aphasia">Aphasia</option><option value="Limited">Limited</option></select></div>
          </div>
          <div style={{ display:"flex", gap:8, marginTop:12 }}>
            <Btn primary onClick={editing?edit:add}>{editing?"Update":"Save"}</Btn>
            <Btn onClick={()=>{setShowAdd(false);setEditing(null);rf();}}>Cancel</Btn>
          </div>
        </Card>
      )}
      <Card style={{ overflow:"hidden" }}>
        {isMobile ? (
          <div>{filt.map(p=>
            <div key={p.id} style={{ padding: "12px 14px", borderBottom:`1px solid ${C.border}08`, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${stC(p.status)}10`, border: `2px solid ${stC(p.status)}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: stC(p.status), flexShrink: 0 }}>{p.name[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name} <span style={{ fontWeight: 400, color: C.sub, fontSize: 11 }}>· {p.age}y · {p.gender}</span></div>
                <div style={{ fontSize: 11, color: C.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.condition}</div>
                <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
                  <span onClick={()=>{setPat(p);go("bridge")}} style={{fontSize: 11, color:C.accent,fontWeight:600}}>Assess</span>
                  <span onClick={()=>se(p)} style={{fontSize: 11, color:C.sub,fontWeight:600}}>Edit</span>
                  <span onClick={()=>handleDelete(p.id)} style={{fontSize: 11, color:C.red,fontWeight:600}}>Delete</span>
                </div>
              </div>
              <Tag c={p.comm==="Non-verbal"?C.red:C.amber}>{p.comm.slice(0,5)}</Tag>
            </div>
          )}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, minWidth: 600 }}>
              <thead>
                <tr style={{ borderBottom:`2px solid ${C.border}` }}>
                  {["Patient","Age","Gender","Condition","Comm","Status","Actions"].map(h=>
                    <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:10, fontWeight:700, color:C.mute, textTransform:"uppercase" }}>{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filt.map(p=>
                  <tr key={p.id} style={{ borderBottom:`1px solid ${C.border}08` }}>
                    <td style={{ padding:"10px 14px", fontWeight:600 }}>{p.name}</td>
                    <td style={{ padding:"10px 14px" }}>{p.age}</td>
                    <td style={{ padding:"10px 14px" }}>{p.gender}</td>
                    <td style={{ padding:"10px 14px" }}>{p.condition}</td>
                    <td style={{ padding:"10px 14px" }}><Tag c={p.comm==="Non-verbal"?C.red:C.amber}>{p.comm}</Tag></td>
                    <td style={{ padding:"10px 14px" }}><Dot c={stC(p.status)}/></td>
                    <td style={{ padding:"10px 14px", whiteSpace:"nowrap" }}>
                      <span onClick={()=>{setPat(p);go("bridge")}} style={{color:C.accent,cursor:"pointer",fontWeight:600,marginRight:10}}>Assess</span>
                      <span onClick={()=>se(p)} style={{color:C.sub,cursor:"pointer",fontWeight:600,marginRight:10}}>Edit</span>
                      <span onClick={()=>handleDelete(p.id)} style={{color:C.red,cursor:"pointer",fontWeight:600}}>Delete</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ═══ SYMPTOMBRIDGE ═══ */
function Bridge({ patient, go }) {
  const { patients, addAssessment, bodySel, setBodySel, getPatient } = useData();
  const isMobile = useIsMobile();
  const [selP, setSelP] = useState(patient?.id || patients[0]?.id || "");
  const p = getPatient(selP) || patients[0];
  const [step, setStep] = useState(0);
  const [syms, setSyms] = useState([]);
  const [emo, setEmo] = useState(null);
  const [pain, setPain] = useState(3);
  const [dur, setDur] = useState("today");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [openCat, setOpenCat] = useState("pain");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bodyType, setBodyType] = useState("male");
  const [speaking, setSpeaking] = useState(false);
  const [lang, setLang] = useState("en");

  const tS = id => setSyms(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const pc = pain <= 3 ? C.green : pain <= 6 ? C.amber : C.red;
  const ST_KEYS = ["location", "symptoms", "details", "results"];

  // Get selected zone labels for TTS
  const selectedLabels = useMemo(() => {
    const labels = [];
    [...BODY_ZONES.front, ...BODY_ZONES.back].forEach(zone => {
      if (bodySel.includes(zone.id)) labels.push(zone.label);
    });
    Object.values(ZOOM_ZONES).forEach(region => {
      region.zones.forEach(zone => {
        if (bodySel.includes(zone.id)) labels.push(zone.label);
      });
    });
    return [...new Set(labels)];
  }, [bodySel]);

  // Get current language info
  const currentLangInfo = LANGUAGES.find(l => l.id === lang) || LANGUAGES[0];

  // TTS for results
  const speakReport = useCallback(async () => {
    if (!res) return;
    setSpeaking(true);
    
    const bodyTypeLabel = t(bodyType, lang);
    const reportParts = [];
    reportParts.push(`Medical report for ${p?.name || "patient"}, ${bodyTypeLabel} patient, age ${p?.age || "unknown"}.`);
    reportParts.push(`Condition: ${p?.condition || "unspecified"}.`);
    
    const painDesc = pain <= 3 ? "mild" : pain <= 6 ? "moderate" : "severe";
    reportParts.push(`Pain level: ${pain} out of 10, rated as ${painDesc}.`);
    
    if (selectedLabels.length > 0) {
      reportParts.push(`Affected areas: ${selectedLabels.join(", ")}.`);
    }
    if (syms.length > 0) {
      reportParts.push(`Symptoms reported: ${syms.slice(0, 5).join(", ")}.`);
    }
    
    const urgencyText = res.urgency === "urgent" ? "Urgent attention required." : 
                        res.urgency === "attention" ? "Needs monitoring." : "Routine follow-up.";
    reportParts.push(urgencyText);
    
    if (res.flags?.length > 0) {
      reportParts.push(`Red flags: ${res.flags.slice(0, 3).join(", ")}.`);
    }
    
    const reportText = reportParts.join(" ");
    
    // Use browser TTS with selected language
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(reportText);
      utterance.lang = currentLangInfo.ttsCode;
      utterance.rate = 0.9;
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      speechSynthesis.speak(utterance);
    } else {
      setSpeaking(false);
    }
  }, [res, p, pain, selectedLabels, syms, bodyType, lang, currentLangInfo]);

  const submit = async () => {
    setBusy(true);
    setSaved(false);
    const em = EMOTIONS.find(e => e.id === emo);
    const emLabel = em ? t(em.transKey, lang) : "N/A";
    const symCats = { pain: [], skin: [], respiratory: [], behavioral: [], digestive: [] };
    syms.forEach(s => {
      const cat = SYM_CATS.find(c => c.items.some(item => item.en === s));
      if (cat?.id === "pain") symCats.pain.push(s);
      else if (cat?.id === "skin") symCats.skin.push(s);
      else if (cat?.id === "resp") symCats.respiratory.push(s);
      else if (cat?.id === "behav") symCats.behavioral.push(s);
      else if (cat?.id === "gi") symCats.digestive.push(s);
    });

    try {
      const apiRes = await apiFetch("/assess/symptoms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id: p.id, body_regions: bodySel, symptoms: symCats, emotion: emo, pain_level: pain, duration: dur, caregiver_notes: notes, body_type: bodyType, image_ids: [] }),
      });
      if (apiRes?.assessment) {
        let parsed = {};
        try { const js = apiRes.assessment; const j0 = js.indexOf("{"); const j1 = js.lastIndexOf("}") + 1; if (j0 >= 0) parsed = JSON.parse(js.slice(j0, j1)); } catch (e) { parsed = {}; }
        setRes({ summary: parsed.simple_summary || parsed.assessment || apiRes.assessment, causes: parsed.possible_causes || ["See full assessment"], flags: parsed.red_flags || [], actions: parsed.immediate_actions || parsed.follow_up || [], urgency: parsed.urgency || "attention" });
        setStep(3); setBusy(false); return;
      }
    } catch (e) { console.warn("API fallback:", e); }

    const bodyTypeLabel = BODY_TYPES.find(b => b.id === bodyType)?.label || "Adult";
    setTimeout(() => {
      setBusy(false);
      setRes({ summary: `${p.name} (${bodyTypeLabel}, ${p.age}y, ${p.condition}): ${bodySel.length} region(s), ${syms.length} symptom(s). Emotion: ${emLabel}. Pain: ${pain}/10. Duration: ${dur}.`, causes: ["Contact dermatitis", "Pressure-related changes", "Medication side effect", "Stress response"], flags: ["Spreading redness", "Fever above 38°C", "Increasing agitation"], actions: ["Photograph areas", "Barrier cream", "Monitor temp q4h"], urgency: pain >= 7 ? "urgent" : pain >= 4 ? "attention" : "routine" });
      setStep(3);
    }, 2000);
  };

  const saveAssessment = async () => {
    if (!res || !p) return;
    setSaving(true);
    const assessmentData = { id: `assess_${Date.now()}`, patient_id: p.id, body_regions: [...bodySel], symptoms: [...syms], emotion: emo, pain_level: pain, duration: dur, caregiver_notes: notes, body_type: bodyType, result: res, timestamp: new Date().toISOString() };
    addAssessment(assessmentData);
    setSaving(false);
    setSaved(true);
  };

  const reset = () => { setStep(0); setBodySel([]); setSyms([]); setEmo(null); setPain(3); setNotes(""); setRes(null); setSaved(false); };
  const goToDashboard = () => { reset(); go("dash"); };

  return (
    <div className="cv-f">
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, marginBottom: 6 }}>SymptomBridge</h2>
        <p style={{ fontSize: 13, color: C.sub }}>Visual symptom communication for non-verbal patients</p>
      </div>
      
      <Card style={{ padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.sub }}>PATIENT:</span>
        <select value={selP} onChange={e => { setSelP(e.target.value); reset(); }} className="cv-inp" style={{ width: "auto", maxWidth: isMobile ? "100%" : 220, flex: isMobile ? 1 : "none" }}>
          {patients.map(pa => <option key={pa.id} value={pa.id}>{pa.name} — {pa.condition}</option>)}
        </select>
        {p && <><Tag c={stC(p.status)}>{p.comm}</Tag><span style={{ fontSize: 11, color: C.sub }}>{p.age}y {p.gender}</span></>}
      </Card>

      {!res && (
        <div style={{ display: "flex", marginBottom: 14, borderRadius: 50, overflow: "hidden", background: C.card, boxShadow: shadow, padding: 3 }}>
          {ST_KEYS.map((key, i) => (
            <div key={i} onClick={() => i <= step ? setStep(i) : null} style={{ flex: 1, padding: "8px 0", textAlign: "center", fontSize: 11, fontWeight: 700, cursor: i <= step ? "pointer" : "default", borderRadius: 50, background: i === step ? C.accent : "transparent", color: i === step ? "#fff" : i < step ? C.green : C.mute }}>
              {isMobile ? (i < step ? "✓" : i + 1) : (i < step ? "✓ " : "") + t(key, lang)}
            </div>
          ))}
        </div>
      )}

      {step === 0 && !res && <BodyPicker sel={bodySel} setSel={setBodySel} bodyType={bodyType} setBodyType={setBodyType} lang={lang} setLang={setLang} />}
      {step === 0 && !res && (
        <div style={{ marginTop: 16 }}>
          <Btn primary onClick={() => setStep(1)} disabled={!bodySel.length} style={{ width: "100%", padding: "14px 24px", fontSize: 15 }}>
            {t("continueToSymptoms", lang)} →
          </Btn>
        </div>
      )}

      {step === 1 && !res && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "140px 1fr", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: isMobile ? "row" : "column", gap: 4, overflowX: isMobile ? "auto" : "visible", paddingBottom: isMobile ? 4 : 0 }}>
            {SYM_CATS.map(c => (
              <div key={c.id} onClick={() => setOpenCat(c.id)} style={{ padding: isMobile ? "8px 14px" : "10px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: openCat === c.id ? 700 : 500, background: openCat === c.id ? `${c.color}08` : "transparent", color: openCat === c.id ? c.color : C.sub, borderLeft: isMobile ? "none" : `3px solid ${openCat === c.id ? c.color : "transparent"}`, whiteSpace: "nowrap" }}>
                {t(c.transKey, lang)}
              </div>
            ))}
          </div>
          <Card style={{ padding: isMobile ? 14 : 18 }}>
            {SYM_CATS.filter(c => c.id === openCat).map(cat => (
              <div key={cat.id}>
                <div style={{ fontSize: 14, fontWeight: 700, color: cat.color, marginBottom: 10 }}>{t(cat.transKey, lang)} {t("indicators", lang)}</div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(3,1fr)", gap: 8 }}>
                  {cat.items.map(s => {
                    const on = syms.includes(s.en);
                    return (
                      <div key={s.key} onClick={() => tS(s.en)} style={{ padding: isMobile ? 10 : 12, borderRadius: 10, border: `1.5px solid ${on ? cat.color : C.border}`, background: on ? `${cat.color}06` : C.card, cursor: "pointer", textAlign: "center", fontSize: 12, fontWeight: on ? 700 : 400, color: on ? cat.color : C.text }}>
                        {t(s.key, lang)}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {syms.length > 0 && (
              <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: "#F8FAFC" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.sub }}>{t("selectedCount", lang)} ({syms.length}): </span>
                {syms.map(s => {
                  const cat = SYM_CATS.find(c => c.items.some(item => item.en === s));
                  const item = cat?.items.find(item => item.en === s);
                  return <span key={s} onClick={() => tS(s)} style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 50, background: `${cat?.color}10`, color: cat?.color, marginRight: 4, cursor: "pointer" }}>{item ? t(item.key, lang) : s} ×</span>;
                })}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <Btn onClick={() => setStep(0)}>← {t("backBtn", lang)}</Btn>
              <Btn primary onClick={() => setStep(2)} style={{ flex: 1 }}>{t("continueBtn", lang)} →</Btn>
            </div>
          </Card>
        </div>
      )}

      {step === 2 && !res && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
          <Card style={{ padding: isMobile ? 14 : 18 }}>
            <Lbl>{t("emotionalState", lang)}</Lbl>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {EMOTIONS.map(e => (
                <div key={e.id} onClick={() => setEmo(e.id)} style={{ padding: isMobile ? 12 : 14, borderRadius: 10, border: `1.5px solid ${emo === e.id ? e.c : C.border}`, cursor: "pointer", fontSize: 13, fontWeight: emo === e.id ? 700 : 400, color: emo === e.id ? e.c : C.text, background: emo === e.id ? `${e.c}06` : C.card, textAlign: "center" }}>
                  {t(e.transKey, lang)}
                </div>
              ))}
            </div>
          </Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Card style={{ padding: isMobile ? 14 : 18 }}>
              <Lbl>{t("painLevel", lang)}</Lbl>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input type="range" min={0} max={10} value={pain} onChange={e => setPain(+e.target.value)} style={{ flex: 1, accentColor: pc }} />
                <div style={{ width: 36, height: 36, borderRadius: 10, background: pc, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16 }}>{pain}</div>
              </div>
            </Card>
            <Card style={{ padding: isMobile ? 14 : 18 }}>
              <Lbl>{t("duration", lang)}</Lbl>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {DURATIONS.map(d => (
                  <div key={d.key} onClick={() => setDur(d.en)} style={{ padding: "6px 14px", borderRadius: 50, fontSize: 11, fontWeight: 600, cursor: "pointer", background: dur === d.en ? C.accent : "#F1F5F9", color: dur === d.en ? "#fff" : C.sub }}>{t(d.key, lang)}</div>
                ))}
              </div>
            </Card>
            <Card style={{ padding: isMobile ? 14 : 18 }}>
              <Lbl>{t("notes", lang)}</Lbl>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={t("observations", lang)} className="cv-inp" style={{ minHeight: 50, resize: "vertical" }} />
            </Card>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn onClick={() => setStep(1)}>← {t("backBtn", lang)}</Btn>
              <Btn primary onClick={submit} disabled={busy} style={{ flex: 1 }}>
                {busy ? <><Spin /> {t("analyzing", lang) || "Analyzing..."}...</> : t("generateAssessment", lang)}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {res && (
        <Card style={{ padding: isMobile ? 16 : 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 12, borderBottom: `1px solid ${C.border}`, marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>Assessment Results</div>
              <div style={{ marginTop: 4 }}><Tag c={res.urgency === "urgent" ? C.red : res.urgency === "attention" ? C.amber : C.green}>{res.urgency.toUpperCase()}</Tag></div>
            </div>
            <Ring value={85} size={50} />
          </div>
          <div style={{ padding: 12, borderRadius: 10, background: "#F8FAFC", marginBottom: 12, fontSize: 12, lineHeight: 1.6 }}>
            <Lbl>Summary</Lbl>{res.summary}
          </div>
          <div style={{ marginBottom: 12 }}>
            <Lbl>Possible causes</Lbl>
            {res.causes.map((c, i) => <div key={i} style={{ fontSize: 12, padding: "4px 0", borderBottom: `1px solid ${C.border}08` }}>{i + 1}. {c}</div>)}
          </div>
          <div style={{ padding: 12, borderRadius: 10, background: "#FEF2F2", marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.red, marginBottom: 4 }}>RED FLAGS:</div>
            {res.flags.map((f, i) => <div key={i} style={{ fontSize: 12, color: "#991B1B", padding: "2px 0" }}>• {f}</div>)}
          </div>
          <div style={{ marginBottom: 14 }}>
            <Lbl>Actions</Lbl>
            {res.actions.map((a, i) => <div key={i} style={{ fontSize: 12, padding: "4px 0" }}>✓ {a}</div>)}
          </div>
          
          {/* TTS Button - Speak Report to Doctor */}
          <div style={{ marginBottom: 14, padding: 12, borderRadius: 10, background: `${C.accent}08`, border: `1px solid ${C.accent}20` }}>
            <Btn primary onClick={speakReport} disabled={speaking} style={{ width: "100%", padding: "14px 20px", fontSize: 15, background: speaking ? C.green : C.accent }}>
              {speaking ? `🔊 ${t("speaking", lang)}` : `🔊 ${t("speakReport", lang)}`}
            </Btn>
            <div style={{ marginTop: 8, fontSize: 11, color: C.sub, textAlign: "center" }}>
              AI will read a summary including patient info, body type, pain areas and symptoms
            </div>
          </div>
          
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn primary onClick={saveAssessment} disabled={saved || saving} style={{ background: saved ? C.green : C.accent }}>
              {saving ? <><Spin /> Saving...</> : saved ? "✓ Saved" : "Save"}
            </Btn>
            <Btn outline onClick={() => go("history")}>History</Btn>
            <Btn onClick={reset}>New</Btn>
            {saved && <Btn onClick={goToDashboard}>Dashboard</Btn>}
          </div>
          {saved && <div style={{ marginTop: 8, fontSize: 11, color: C.green, textAlign: "center" }}>✓ Saved! View in History or Alerts.</div>}
        </Card>
      )}
    </div>
  );
}

/* ═══ HISTORY PAGE ═══ */
function HistoryPage({ go }) {
  const { patients, assessments, getPatient } = useData();
  const isMobile = useIsMobile();
  const [selectedPatient, setSelectedPatient] = useState("all");
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState([]);
  const [viewDetail, setViewDetail] = useState(null);
  const [aiComparison, setAiComparison] = useState(null);
  const [comparing, setComparing] = useState(false);

  const filtered = selectedPatient === "all" ? assessments : assessments.filter(a => a.patient_id === selectedPatient);
  const sorted = [...filtered].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const toggleSelect = (id) => {
    if (selected.includes(id)) {
      setSelected(selected.filter(x => x !== id));
      setAiComparison(null);
    } else if (selected.length < 2) {
      setSelected([...selected, id]);
    }
  };

  // Basic comparison data (for quick stats)
  const comparison = useMemo(() => {
    if (selected.length !== 2) return null;
    const [a1, a2] = selected.map(id => assessments.find(a => a.id === id)).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    if (!a1 || !a2) return null;
    return { older: a1, newer: a2, painChange: a2.pain_level - a1.pain_level, newSymptoms: a2.symptoms.filter(s => !a1.symptoms.includes(s)), resolvedSymptoms: a1.symptoms.filter(s => !a2.symptoms.includes(s)) };
  }, [selected, assessments]);

  // Call AI comparison when 2 assessments are selected
  const runAIComparison = async () => {
    if (selected.length !== 2 || !comparison) return;
    setComparing(true);
    setAiComparison(null);
    
    const patient = getPatient(comparison.older.patient_id);
    
    try {
      const res = await fetch(`${API}/compare/assessments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessment_older: {
            timestamp: comparison.older.timestamp,
            body_regions: comparison.older.body_regions,
            symptoms: comparison.older.symptoms,
            pain_level: comparison.older.pain_level,
            emotion: comparison.older.emotion,
            duration: comparison.older.duration,
            result: comparison.older.result
          },
          assessment_newer: {
            timestamp: comparison.newer.timestamp,
            body_regions: comparison.newer.body_regions,
            symptoms: comparison.newer.symptoms,
            pain_level: comparison.newer.pain_level,
            emotion: comparison.newer.emotion,
            duration: comparison.newer.duration,
            result: comparison.newer.result
          },
          patient_info: patient ? `${patient.name}, ${patient.age}y ${patient.gender}, ${patient.condition}` : "Unknown patient"
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setAiComparison(data);
      } else {
        // Fallback to basic comparison display
        setAiComparison({ error: "AI comparison unavailable", fallback: true });
      }
    } catch (err) {
      console.error("AI comparison error:", err);
      setAiComparison({ error: err.message, fallback: true });
    } finally {
      setComparing(false);
    }
  };

  // Auto-trigger AI comparison when 2 items selected
  useEffect(() => {
    if (selected.length === 2 && comparison && !aiComparison && !comparing) {
      runAIComparison();
    }
  }, [selected, comparison]);

  const painTrend = useMemo(() => sorted.slice(0, 10).reverse().map((a, i) => ({ label: `#${i + 1}`, pain: a.pain_level })), [sorted]);

  // Detail view when clicking on assessment
  if (viewDetail) {
    const a = viewDetail;
    const patient = getPatient(a.patient_id);
    const urgency = a.result?.urgency || getUrgencyFromPain(a.pain_level);
    const uc = urgency === "urgent" ? C.red : urgency === "attention" ? C.amber : C.green;
    const emo = EMOTIONS.find(e => e.id === a.emotion);
    
    return (
      <div className="cv-f">
        <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <Btn onClick={() => setViewDetail(null)}>← Back</Btn>
          <div>
            <h2 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, marginBottom: 2 }}>Assessment Details</h2>
            <p style={{ fontSize: 12, color: C.sub }}>{new Date(a.timestamp).toLocaleString()}</p>
          </div>
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
          <Card style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ width: 50, height: 50, borderRadius: "50%", background: `${uc}10`, border: `3px solid ${uc}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: uc }}>{patient?.name?.[0] || "?"}</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{patient?.name || "Unknown"}</div>
                <div style={{ fontSize: 12, color: C.sub }}>{patient?.age}y {patient?.gender} · {patient?.condition}</div>
              </div>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ padding: 14, background: "#F8FAFC", borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: uc }}>{a.pain_level}</div>
                <div style={{ fontSize: 11, color: C.sub, fontWeight: 600 }}>PAIN LEVEL</div>
              </div>
              <div style={{ padding: 14, background: "#F8FAFC", borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: emo?.c || C.sub }}>{emo ? t(emo.transKey, "en") : (a.emotion || "N/A")}</div>
                <div style={{ fontSize: 11, color: C.sub, fontWeight: 600, marginTop: 4 }}>EMOTION</div>
              </div>
            </div>
            
            <div style={{ marginTop: 14 }}>
              <Lbl>Duration</Lbl>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{a.duration || "Not specified"}</div>
            </div>
            
            {a.caregiver_notes && (
              <div style={{ marginTop: 14 }}>
                <Lbl>Caregiver Notes</Lbl>
                <div style={{ fontSize: 13, padding: 12, background: "#FFFBEB", borderRadius: 8 }}>{a.caregiver_notes}</div>
              </div>
            )}
          </Card>
          
          <Card style={{ padding: 18 }}>
            <Lbl>Body Regions ({a.body_regions?.length || 0})</Lbl>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
              {a.body_regions?.length > 0 ? a.body_regions.map(r => {
                const pt = BP.find(p => p.id === r);
                return <span key={r} style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 50, background: `${C.accent}10`, color: C.accent }}>{pt?.l || r}</span>;
              }) : <span style={{ fontSize: 12, color: C.mute }}>No regions</span>}
            </div>
            
            <Lbl>Symptoms ({a.symptoms?.length || 0})</Lbl>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {a.symptoms?.length > 0 ? a.symptoms.map(s => {
                const cat = SYM_CATS.find(c => c.items.includes(s));
                return <span key={s} style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 50, background: `${cat?.color || C.mute}10`, color: cat?.color || C.mute }}>{s}</span>;
              }) : <span style={{ fontSize: 12, color: C.mute }}>No symptoms</span>}
            </div>
          </Card>
          
          {a.result && (
            <Card style={{ padding: 18, gridColumn: isMobile ? "1" : "1 / -1" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>AI Assessment Result</div>
                <Tag c={uc}>{urgency.toUpperCase()}</Tag>
              </div>
              
              <div style={{ padding: 14, borderRadius: 10, background: "#F0FDF4", marginBottom: 14, fontSize: 13, lineHeight: 1.7 }}>{a.result.summary}</div>
              
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
                {a.result.causes?.length > 0 && (
                  <div>
                    <Lbl>Possible Causes</Lbl>
                    {a.result.causes.map((c, i) => <div key={i} style={{ fontSize: 12, padding: "4px 0" }}>{i + 1}. {c}</div>)}
                  </div>
                )}
                {a.result.actions?.length > 0 && (
                  <div>
                    <Lbl>Actions</Lbl>
                    {a.result.actions.map((act, i) => <div key={i} style={{ fontSize: 12, padding: "4px 0", color: C.green }}>✓ {act}</div>)}
                  </div>
                )}
              </div>
              
              {a.result.flags?.length > 0 && (
                <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "#FEF2F2" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.red, marginBottom: 6 }}>⚠ RED FLAGS</div>
                  {a.result.flags.map((f, i) => <div key={i} style={{ fontSize: 12, color: "#991B1B", padding: "2px 0" }}>• {f}</div>)}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="cv-f">
      <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: isMobile ? 20 : 22, fontWeight: 800, marginBottom: 4 }}>History</h2>
          <p style={{ fontSize: 12, color: C.sub }}>Track & compare assessments</p>
        </div>
        <Btn primary={compareMode} sm onClick={() => { setCompareMode(!compareMode); setSelected([]); setAiComparison(null); }}>
          {compareMode ? "Exit Compare" : "Compare"}
        </Btn>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <select value={selectedPatient} onChange={e => setSelectedPatient(e.target.value)} className="cv-inp" style={{ width: "auto", maxWidth: 180 }}>
          <option value="all">All Patients</option>
          {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <Tag c={C.accent}>{filtered.length} assessments</Tag>
      </div>

      {compareMode && selected.length === 2 && comparison && (
        <Card style={{ padding: isMobile ? 14 : 18, marginBottom: 12, background: "#F0FDF4", border: `1px solid ${C.green}30` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.green }}>📊 AI Comparison</div>
            {!comparing && aiComparison && !aiComparison.fallback && (
              <Btn sm onClick={runAIComparison}>🔄 Re-analyze</Btn>
            )}
          </div>
          
          {/* Basic Stats Row */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <Lbl>Pain Change</Lbl>
              <div style={{ fontSize: 22, fontWeight: 800, color: comparison.painChange > 0 ? C.red : comparison.painChange < 0 ? C.green : C.sub }}>
                {comparison.painChange > 0 ? "+" : ""}{comparison.painChange}
                <span style={{ fontSize: 11, fontWeight: 400, color: C.sub, marginLeft: 4 }}>({comparison.older.pain_level} → {comparison.newer.pain_level})</span>
              </div>
            </div>
            <div>
              <Lbl>New Symptoms</Lbl>
              {comparison.newSymptoms.length === 0 ? <div style={{ fontSize: 12, color: C.green }}>✓ None</div> : comparison.newSymptoms.map(s => <Tag key={s} c={C.red}>{s}</Tag>)}
            </div>
            <div>
              <Lbl>Resolved</Lbl>
              {comparison.resolvedSymptoms.length === 0 ? <div style={{ fontSize: 12, color: C.mute }}>None</div> : comparison.resolvedSymptoms.map(s => <Tag key={s} c={C.green}>{s}</Tag>)}
            </div>
          </div>
          
          {/* AI Analysis Section */}
          {comparing ? (
            <div style={{ padding: 20, textAlign: "center", background: "#fff", borderRadius: 10 }}>
              <Spin />
              <div style={{ marginTop: 8, fontSize: 12, color: C.sub }}>AI analyzing changes...</div>
            </div>
          ) : aiComparison && !aiComparison.fallback ? (
            <div style={{ background: "#fff", borderRadius: 10, padding: 14 }}>
              {/* Overall Assessment */}
              {aiComparison.overall_assessment && (
                <div style={{ marginBottom: 14 }}>
                  <Lbl>🤖 AI Assessment</Lbl>
                  <div style={{ fontSize: 13, lineHeight: 1.6, color: "#374151" }}>{aiComparison.overall_assessment}</div>
                </div>
              )}
              
              {/* Trend */}
              {aiComparison.trend && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, background: aiComparison.trend === "improving" ? "#DCFCE7" : aiComparison.trend === "worsening" ? "#FEE2E2" : "#F3F4F6", marginBottom: 12 }}>
                  <span style={{ fontSize: 16 }}>{aiComparison.trend === "improving" ? "📈" : aiComparison.trend === "worsening" ? "📉" : "➡️"}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: aiComparison.trend === "improving" ? C.green : aiComparison.trend === "worsening" ? C.red : C.sub, textTransform: "uppercase" }}>{aiComparison.trend}</span>
                </div>
              )}
              
              {/* Key Changes */}
              {aiComparison.key_changes && aiComparison.key_changes.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <Lbl>Key Changes</Lbl>
                  {aiComparison.key_changes.map((change, i) => (
                    <div key={i} style={{ fontSize: 12, padding: "4px 0", display: "flex", alignItems: "flex-start", gap: 6 }}>
                      <span style={{ color: change.type === "positive" ? C.green : change.type === "negative" ? C.red : C.amber }}>
                        {change.type === "positive" ? "✓" : change.type === "negative" ? "⚠" : "•"}
                      </span>
                      <span>{change.description}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Recommendations */}
              {aiComparison.recommendations && aiComparison.recommendations.length > 0 && (
                <div style={{ padding: 12, background: "#FFFBEB", borderRadius: 8 }}>
                  <Lbl style={{ color: C.amber }}>💡 Recommendations</Lbl>
                  {aiComparison.recommendations.map((rec, i) => (
                    <div key={i} style={{ fontSize: 12, padding: "3px 0" }}>• {rec}</div>
                  ))}
                </div>
              )}
              
              {/* Concerns */}
              {aiComparison.concerns && aiComparison.concerns.length > 0 && (
                <div style={{ padding: 12, background: "#FEF2F2", borderRadius: 8, marginTop: 10 }}>
                  <Lbl style={{ color: C.red }}>⚠ Concerns</Lbl>
                  {aiComparison.concerns.map((c, i) => (
                    <div key={i} style={{ fontSize: 12, color: "#991B1B", padding: "3px 0" }}>• {c}</div>
                  ))}
                </div>
              )}
            </div>
          ) : aiComparison?.fallback ? (
            <div style={{ padding: 12, background: "#FEF3C7", borderRadius: 8, fontSize: 12, color: "#92400E" }}>
              ⚠ AI comparison unavailable. Showing basic stats only.
            </div>
          ) : null}
        </Card>
      )}

      {painTrend.length > 1 && (
        <Card style={{ padding: isMobile ? 14 : 18, marginBottom: 12 }}>
          <Lbl>Pain Trend</Lbl>
          <div style={{ height: 120 }}>
            <ResponsiveContainer>
              <LineChart data={painTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 9 }} />
                <Tooltip />
                <Line type="monotone" dataKey="pain" stroke={C.red} strokeWidth={2} dot={{ r: 3, fill: C.red }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card style={{ overflow: "hidden" }}>
        {sorted.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 10, opacity: .3 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>No assessments</div>
            <Btn primary onClick={() => go("bridge")} style={{ marginTop: 14 }}>SymptomBridge</Btn>
          </div>
        ) : sorted.map((a) => {
          const patient = getPatient(a.patient_id);
          const isSelected = selected.includes(a.id);
          const urgency = a.result?.urgency || getUrgencyFromPain(a.pain_level);
          const uc = urgency === "urgent" ? C.red : urgency === "attention" ? C.amber : C.green;
          
          return (
            <div key={a.id} onClick={compareMode ? () => toggleSelect(a.id) : () => setViewDetail(a)} style={{ padding: "12px 14px", borderBottom: `1px solid ${C.border}08`, cursor: "pointer", background: isSelected ? `${C.accent}08` : "transparent", border: isSelected ? `2px solid ${C.accent}` : "2px solid transparent", transition: "all .15s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {compareMode && (
                  <div style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${isSelected ? C.accent : C.border}`, background: isSelected ? C.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                    {isSelected ? "✓" : ""}
                  </div>
                )}
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${uc}10`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: uc }}>{a.pain_level}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{patient?.name || "Unknown"}</span>
                    <Tag c={uc}>{urgency.toUpperCase()}</Tag>
                  </div>
                  <div style={{ fontSize: 11, color: C.sub }}>{a.body_regions?.length || 0} regions · {a.symptoms?.length || 0} symptoms</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{new Date(a.timestamp).toLocaleDateString()}</div>
                  <div style={{ fontSize: 10, color: C.mute }}>{new Date(a.timestamp).toLocaleTimeString()}</div>
                </div>
                {!compareMode && <span style={{ fontSize: 18, color: C.mute, marginLeft: 4 }}>›</span>}
              </div>
            </div>
          );
        })}
      </Card>

      {compareMode && <div style={{ marginTop: 10, textAlign: "center", fontSize: 11, color: C.sub }}>{selected.length === 0 ? "Select 2 to compare" : selected.length === 1 ? "Select 1 more" : "Comparison above ↑"}</div>}
    </div>
  );
}

/* ═══ TIMELINE ═══ */
function Timeline() {
  const { patients, assessments, imageAnalyses, getPatient } = useData();
  const isMobile = useIsMobile();
  const [selectedPatient, setSelectedPatient] = useState(patients[0]?.id || "");
  const patient = getPatient(selectedPatient);

  const patientAssessments = assessments.filter(a => a.patient_id === selectedPatient);
  const patientImages = imageAnalyses.filter(i => i.patient_id === selectedPatient);

  const events = useMemo(() => {
    const all = [];
    patientAssessments.forEach(a => {
      const urgency = a.result?.urgency || getUrgencyFromPain(a.pain_level);
      all.push({ id: a.id, type: "assessment", date: new Date(a.timestamp), title: `SymptomBridge: Pain ${a.pain_level}/10`, desc: a.symptoms.slice(0, 3).join(", ") || "Assessment", color: urgency === "urgent" ? C.red : urgency === "attention" ? C.amber : C.green });
    });
    patientImages.forEach(i => {
      all.push({ id: i.id, type: "image", date: new Date(i.timestamp), title: `CareVision: ${i.finding}`, desc: `${i.type} analysis`, color: C.teal });
    });
    return all.sort((a, b) => b.date - a.date);
  }, [patientAssessments, patientImages]);

  const severityData = useMemo(() => patientAssessments.slice(0, 10).reverse().map(a => ({ d: new Date(a.timestamp).toLocaleDateString(), v: a.pain_level })), [patientAssessments]);

  const VITALS = [
    { l: "Assessments", v: patientAssessments.length, u: "total" },
    { l: "Avg Pain", v: patientAssessments.length ? (patientAssessments.reduce((s, a) => s + a.pain_level, 0) / patientAssessments.length).toFixed(1) : "N/A", u: "/10" },
    { l: "Images", v: patientImages.length, u: "analyzed" },
    { l: "Last Check", v: patientAssessments.length ? formatTime(patientAssessments[0].timestamp) : "N/A", u: "ago" },
  ];

  return (
    <div className="cv-f">
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: isMobile ? 20 : 22, fontWeight: 800, marginBottom: 4 }}>Timeline</h2>
        <p style={{ fontSize: 12, color: C.sub }}>Patient health over time</p>
      </div>

      <Card style={{ padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.sub }}>PATIENT:</span>
        <select value={selectedPatient} onChange={e => setSelectedPatient(e.target.value)} className="cv-inp" style={{ width: "auto", maxWidth: isMobile ? "100%" : 220, flex: isMobile ? 1 : "none" }}>
          {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {patient && <Tag c={stC(patient.status)}>{patient.status === "crit" ? "Critical" : patient.status === "warn" ? "Warning" : "Stable"}</Tag>}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 10, marginBottom: 12 }}>
        {VITALS.map((v, i) => (
          <Card key={i} style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.mute, textTransform: "uppercase" }}>{v.l}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 }}>
              <span style={{ fontSize: 20, fontWeight: 800 }}>{v.v}</span>
              <span style={{ fontSize: 10, color: C.mute }}>{v.u}</span>
            </div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <Card style={{ padding: isMobile ? 14 : 18 }}>
          <Lbl>Pain Severity</Lbl>
          {severityData.length > 0 ? (
            <div style={{ height: 140 }}>
              <ResponsiveContainer>
                <AreaChart data={severityData}>
                  <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.red} stopOpacity={.12} /><stop offset="100%" stopColor={C.red} stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="d" tick={{ fontSize: 9 }} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 9 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="v" stroke={C.red} fill="url(#sg)" strokeWidth={2} dot={{ fill: C.red, r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center", color: C.mute, fontSize: 12 }}>No data yet</div>}
        </Card>
        <Card style={{ padding: isMobile ? 14 : 18 }}>
          <Lbl>MedGemma AI</Lbl>
          <div style={{ height: 160 }}><ResponsiveContainer><RadarChart data={RADAR_D}><PolarGrid stroke="#F1F5F9" /><PolarAngleAxis dataKey="a" tick={{ fontSize: 8, fill: C.sub }} /><Radar dataKey="v" stroke={C.accent} fill={C.accent} fillOpacity={.08} strokeWidth={2} /></RadarChart></ResponsiveContainer></div>
        </Card>
      </div>

      <Card style={{ padding: isMobile ? 14 : 18 }}>
        <Lbl>Event Log</Lbl>
        {events.length === 0 ? (
          <div style={{ padding: "20px 0", textAlign: "center", color: C.mute, fontSize: 12 }}>No events for this patient</div>
        ) : events.slice(0, 10).map((ev, i) => (
          <div key={ev.id} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: i < events.length - 1 ? `1px solid ${C.border}08` : "none" }}>
            <span style={{ width: 55, fontSize: 10, fontWeight: 600, color: C.mute, flexShrink: 0 }}>{ev.date.toLocaleDateString()}</span>
            <Dot c={ev.color} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{ev.title}</div>
              <div style={{ fontSize: 10, color: C.sub }}>{ev.desc}</div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ═══ CAREVISION ═══ */
function Vision() {
  const { addImageAnalysis } = useData();
  const isMobile = useIsMobile();
  const [type, setType] = useState("skin");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [apiStatus, setApiStatus] = useState(null);
  const fileRef = useRef(null);

  const T = [{ id: "skin", l: "Skin" }, { id: "xray", l: "X-Ray" }, { id: "eye", l: "Eye" }, { id: "ct", l: "CT/MRI" }];
  const MOCK = { skin: { f: "Contact Dermatitis — Mild", c: 87, d: "Localized erythematous patch.", s: "A mild skin reaction.", r: ["Monitor 48h", "Apply barrier cream"] }, xray: { f: "No Acute Abnormality", c: 93, d: "Heart size normal. Lungs clear.", s: "Chest X-ray looks normal.", r: ["Routine follow-up"] }, eye: { f: "Mild Diabetic Retinopathy", c: 81, d: "Scattered microaneurysms.", s: "Early signs of diabetes affecting eyes.", r: ["Annual eye exam"] }, ct: { f: "Mild Degenerative Changes", c: 85, d: "L4-L5 disc dessication.", s: "Normal age-related wear.", r: ["Physical therapy if symptomatic"] } };

  const onFile = (e) => { const f = e.target.files?.[0]; if (!f) return; setFile(f); setPreview(URL.createObjectURL(f)); setRes(null); setApiStatus(null); };
  const analyze = async () => {
    if (!file) return; setBusy(true); setRes(null); setApiStatus(null);
    try {
      const data = await apiUpload("/analyze/image", file, { analysis_type: type });
      if (data && data.finding) {
        const result = { f: data.finding, c: Math.round((data.confidence || 0.5) * 100), d: data.details || "", s: data.simple_explanation || "", r: data.recommendations || [] };
        setRes(result); setApiStatus("ok");
        addImageAnalysis({ id: `img_${Date.now()}`, type, finding: result.f, confidence: result.c, timestamp: new Date().toISOString() });
      } else throw new Error("No data");
    } catch (e) { setRes(MOCK[type]); setApiStatus("fallback"); }
    setBusy(false);
  };
  const clear = () => { setFile(null); setPreview(null); setRes(null); setApiStatus(null); if (fileRef.current) fileRef.current.value = ""; };

  return (
    <div className="cv-f">
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: isMobile ? 20 : 22, fontWeight: 800, marginBottom: 4 }}>CareVision</h2>
        <p style={{ fontSize: 12, color: C.sub }}>Medical image analysis</p>
      </div>
      
      <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", paddingBottom: 4 }}>
        {T.map(t => (
          <div key={t.id} onClick={() => { setType(t.id); clear(); }} style={{ padding: "7px 16px", borderRadius: 50, fontSize: 12, fontWeight: 600, cursor: "pointer", background: type === t.id ? C.accent : C.card, color: type === t.id ? "#fff" : C.sub, boxShadow: shadow, whiteSpace: "nowrap" }}>{t.l}</div>
        ))}
      </div>
      
      <input type="file" ref={fileRef} onChange={onFile} accept="image/*,.dcm" style={{ display: "none" }} />
      
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        <Card style={{ padding: preview ? 14 : 40, textAlign: preview ? "left" : "center", cursor: !preview && !busy ? "pointer" : "default", minHeight: isMobile ? 180 : 220, display: "flex", flexDirection: "column", justifyContent: preview ? "flex-start" : "center", alignItems: preview ? "stretch" : "center" }} onClick={!preview && !busy ? () => fileRef.current?.click() : undefined}>
          {preview ? (
            <div>
              <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}`, marginBottom: 12 }}>
                <img src={preview} alt="Preview" style={{ width: "100%", maxHeight: isMobile ? 200 : 260, objectFit: "contain", display: "block", background: "#F8FAFC" }} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn primary onClick={analyze} disabled={busy} style={{ flex: 1 }}>{busy ? <><Spin /> Analyzing...</> : "🔬 Analyze"}</Btn>
                <Btn onClick={clear}>✕</Btn>
              </div>
              {apiStatus && <div style={{ marginTop: 8, fontSize: 10, fontWeight: 600, color: apiStatus === "ok" ? C.green : C.amber, textAlign: "center" }}>{apiStatus === "ok" ? "✓ API connected" : "⚠ Demo mode"}</div>}
            </div>
          ) : (
            <div>
              <div style={{ width: 50, height: 50, borderRadius: "50%", background: `${C.accent}10`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: 22 }}>📷</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Upload {T.find(t => t.id === type)?.l}</div>
              <div style={{ fontSize: 11, color: C.mute, marginBottom: 14 }}>PNG, JPG, DICOM</div>
              <Btn primary>Select File</Btn>
            </div>
          )}
        </Card>
        
        {res ? (
          <Card className="cv-f" style={{ padding: isMobile ? 14 : 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Results</span>
              <Ring value={res.c} size={44} />
            </div>
            <div style={{ padding: 10, borderRadius: 8, background: "#F0FDF4", marginBottom: 10, fontWeight: 700, color: C.green, fontSize: 13 }}>{res.f}</div>
            <Lbl>Details</Lbl>
            <div style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 10 }}>{res.d}</div>
            <Lbl>Simple Explanation</Lbl>
            <div style={{ fontSize: 12, padding: 10, background: "#FFFBEB", borderRadius: 8, marginBottom: 10, lineHeight: 1.5 }}>{res.s}</div>
            <Lbl>Recommendations</Lbl>
            {res.r.map((r, i) => <div key={i} style={{ fontSize: 12, padding: "4px 0" }}>✓ {r}</div>)}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Btn primary sm>Save</Btn>
              <Btn sm onClick={clear}>New</Btn>
            </div>
          </Card>
        ) : (
          <Card style={{ padding: 40, textAlign: "center", color: C.mute, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 28, opacity: .3 }}>🔬</div>
            <div>Select an image to analyze</div>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ═══ REPORT ═══ */
function Report() {
  const { patients, assessments, imageAnalyses, getPatient } = useData();
  const isMobile = useIsMobile();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(patients[0]?.id || "");

  const patient = getPatient(selectedPatient);
  const patientAssessments = assessments.filter(a => a.patient_id === selectedPatient);
  const patientImages = imageAnalyses.filter(i => i.patient_id === selectedPatient);
  const avgPain = patientAssessments.length ? (patientAssessments.reduce((s, a) => s + a.pain_level, 0) / patientAssessments.length).toFixed(1) : "N/A";

  const run = () => { setBusy(true); setTimeout(() => { setBusy(false); setDone(true); }, 2000); };

  if (!done) {
    return (
      <div className="cv-f" style={{ maxWidth: 450, margin: "0 auto", paddingTop: 20 }}>
        <Card style={{ padding: isMobile ? 28 : 36, textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Generate Report</div>
          <div style={{ fontSize: 13, color: C.sub, marginBottom: 20 }}>Compile patient data</div>
          <div style={{ marginBottom: 14 }}>
            <select value={selectedPatient} onChange={e => setSelectedPatient(e.target.value)} className="cv-inp" style={{ maxWidth: 280 }}>
              {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <Btn primary onClick={run} disabled={busy} style={{ fontSize: 14, padding: "10px 28px" }}>{busy ? <><Spin /> Generating...</> : "Generate Report"}</Btn>
        </Card>
      </div>
    );
  }

  const S = [
    { t: "Clinical Overview", c: `${patient?.age}yo ${patient?.gender === "M" ? "male" : "female"}. ${patient?.condition}. ${patient?.comm}.` },
    { t: "Assessments", c: `${patientAssessments.length} recorded. Avg pain: ${avgPain}/10.` },
    { t: "Images", c: `${patientImages.length} analyzed via CareVision.` },
    { t: "Symptoms", c: patientAssessments.length ? patientAssessments[0].symptoms.join(", ") || "None" : "No assessments" },
    { t: "Recommendations", c: "1. Continue monitoring\n2. Review in 2 weeks" }
  ];

  return (
    <div className="cv-f" style={{ maxWidth: 600, margin: "0 auto" }}>
      <Card style={{ padding: isMobile ? 18 : 24 }}>
        <div style={{ paddingBottom: 12, borderBottom: `1px solid ${C.border}`, marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, textTransform: "uppercase" }}>CareVault Report</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>Summary — {patient?.name}</div>
        </div>
        {S.map((s, i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{i + 1}. {s.t}</div>
            <div style={{ fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-line", color: "#374151" }}>{s.c}</div>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn primary>Print</Btn>
          <Btn outline>Download</Btn>
          <Btn onClick={() => setDone(false)}>New</Btn>
        </div>
      </Card>
    </div>
  );
}

/* ═══ MAIN APP ═══ */
export default function CareVault() {
  const [tab, setTab] = useState(() => window.location.hash.slice(1) || "dash");
  const [pat, setPat] = useState(null);
  const [patients, setPatients] = useState(() => {
    try {
      const saved = localStorage.getItem('carevault_patients');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) return parsed;
      }
    } catch {}
    return INIT_P;
  });
  const [assessments, setAssessments] = useState(() => { try { return JSON.parse(localStorage.getItem('carevault_assessments') || '[]'); } catch { return []; } });
  const [imageAnalyses, setImageAnalyses] = useState(() => { try { return JSON.parse(localStorage.getItem('carevault_images') || '[]'); } catch { return []; } });
  const [bodySel, setBodySel] = useState([]);
  const [online, setOnline] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => { localStorage.setItem('carevault_patients', JSON.stringify(patients)); }, [patients]);
  useEffect(() => { localStorage.setItem('carevault_assessments', JSON.stringify(assessments)); }, [assessments]);
  useEffect(() => { localStorage.setItem('carevault_images', JSON.stringify(imageAnalyses)); }, [imageAnalyses]);

  const addAssessment = useCallback((assessment) => { setAssessments(prev => [assessment, ...prev].slice(0, 100)); }, []);
  const addImageAnalysis = useCallback((analysis) => { setImageAnalyses(prev => [analysis, ...prev].slice(0, 100)); }, []);
  
  const updatePatient = useCallback((updatedPatient) => {
    setPatients(prev => prev.map(p => p.id === updatedPatient.id ? { ...p, ...updatedPatient } : p));
  }, []);
  
  const addPatient = useCallback((newPatient) => {
    setPatients(prev => [...prev, { ...newPatient, id: newPatient.id || "p" + Date.now(), status: "ok", created: new Date().toISOString().slice(0, 10) }]);
  }, []);
  
  const deletePatient = useCallback((patientId) => {
    setPatients(prev => prev.filter(p => p.id !== patientId));
  }, []);

  const go = useCallback((newTab) => { setTab(newTab); setMenuOpen(false); window.history.pushState({ tab: newTab }, "", `#${newTab}`); }, []);

  useEffect(() => {
    const handlePopState = () => setTab(window.location.hash.slice(1) || "dash");
    window.addEventListener("popstate", handlePopState);
    if (!window.location.hash) window.history.replaceState({ tab: "dash" }, "", "#dash");
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const dataValue = { 
    patients, setPatients, 
    assessments, addAssessment, 
    imageAnalyses, addImageAnalysis, 
    bodySel, setBodySel,
    getPatient: useCallback((id) => patients.find(p => p.id === id), [patients]),
    updatePatient,
    addPatient,
    deletePatient,
  };

  const NAV = [
    { id: "dash", l: "Dashboard", icon: "🏠" },
    { id: "patients", l: "Patients", icon: "👥" },
    { id: "bridge", l: "SymptomBridge", icon: "🩺" },
    { id: "history", l: "History", icon: "📋" },
    { id: "alerts", l: "Alerts", icon: "🔔" },
    { id: "vision", l: "CareVision", icon: "🔬" },
    { id: "timeline", l: "Timeline", icon: "📊" },
    { id: "report", l: "Report", icon: "📄" },
  ];

  const pages = {
    dash: <Dashboard go={go} />,
    patients: <Patients go={go} setPat={setPat} />,
    bridge: <Bridge patient={pat} go={go} />,
    history: <HistoryPage go={go} />,
    alerts: <AlertsPage go={go} />,
    vision: <Vision />,
    timeline: <Timeline />,
    report: <Report />,
  };

  const activeAlerts = assessments.filter(a => (a.result?.urgency || getUrgencyFromPain(a.pain_level)) !== "routine").length;

  return (
    <DataContext.Provider value={dataValue}>
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: C.text, fontSize: 14 }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
          *{margin:0;padding:0;box-sizing:border-box}
          html,body,#root{width:100%;min-height:100vh}
          .cv-f{animation:cvf .25s ease both}
          @keyframes cvf{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
          @keyframes cvs{to{transform:rotate(360deg)}}
          @keyframes cvpulse{0%,100%{opacity:1}50%{opacity:.4}}
          .cv-inp{padding:8px 12px;border-radius:8px;border:1px solid ${C.border};font-size:13px;font-family:inherit;outline:none;width:100%;background:#fff;transition:border .15s,box-shadow .15s}
          .cv-inp:focus{border-color:${C.accent};box-shadow:0 0 0 3px ${C.accent}15}
          .cv-lbl{display:block;font-size:11px;font-weight:600;margin-bottom:4px;color:${C.sub}}
          input[type=range]{-webkit-appearance:none;height:5px;border-radius:3px;background:#E2E8F0;outline:none}
          input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;cursor:pointer;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.2)}
          textarea.cv-inp{resize:vertical}
          ::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:2px}
          button:hover{opacity:.88}button:active{transform:scale(.98)}
          .cv-nav-item{padding:6px 12px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:500;white-space:nowrap;transition:all .15s;color:${C.sub};display:flex;align-items:center;gap:6px}
          .cv-nav-item:hover{background:#F1F5F9;color:${C.text}}
          .cv-nav-active{background:${C.accent}!important;color:#fff!important;font-weight:600}
          @media (max-width: 768px) {
            .cv-nav-item{padding:10px 14px;font-size:14px}
          }
        `}</style>
        
        <header style={{ background: "#fff", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 100 }}>
          <div style={{ padding: "0 20px", display: "flex", alignItems: "center", height: isMobile ? 56 : 52, gap: 10, maxWidth: 1800, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              </div>
              <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>CareVault</span>
            </div>
            
            {isMobile ? (
              <>
                <div style={{ flex: 1 }} />
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 50, background: `${C.green}12` }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: online ? C.green : C.amber, animation: "cvpulse 2s infinite" }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: online ? C.green : C.amber }}>{online ? "Online" : "Offline"}</span>
                </span>
                <div onClick={() => setMenuOpen(!menuOpen)} style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", borderRadius: 8, background: menuOpen ? "#F1F5F9" : "transparent" }}>
                  <span style={{ fontSize: 18 }}>{menuOpen ? "✕" : "☰"}</span>
                </div>
              </>
            ) : (
              <>
                <nav style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, justifyContent: "center", overflowX: "auto", padding: "0 8px" }}>
                  {NAV.map(n => (
                    <div key={n.id} onClick={() => go(n.id)} className={`cv-nav-item${tab === n.id ? " cv-nav-active" : ""}`}>
                      {n.l}
                      {n.id === "alerts" && activeAlerts > 0 && (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 50, background: tab === n.id ? "rgba(255,255,255,.3)" : C.red, color: "#fff", marginLeft: 2 }}>{activeAlerts}</span>
                      )}
                    </div>
                  ))}
                </nav>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 50, background: `${C.green}12`, cursor: "pointer", flexShrink: 0 }} onClick={() => setOnline(!online)}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: online ? C.green : C.amber, animation: "cvpulse 2s infinite" }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: online ? C.green : C.amber }}>{online ? "Online" : "Offline"}</span>
                </span>
              </>
            )}
          </div>
          
          {isMobile && menuOpen && (
            <div style={{ position: "absolute", top: 52, left: 0, right: 0, background: "#fff", borderBottom: `1px solid ${C.border}`, boxShadow: "0 4px 20px rgba(0,0,0,.1)", zIndex: 99 }}>
              {NAV.map(n => (
                <div key={n.id} onClick={() => go(n.id)} style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${C.border}08`, background: tab === n.id ? `${C.accent}08` : "transparent", color: tab === n.id ? C.accent : C.text, fontWeight: tab === n.id ? 700 : 500, fontSize: 14 }}>
                  <span style={{ fontSize: 18 }}>{n.icon}</span>
                  {n.l}
                  {n.id === "alerts" && activeAlerts > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 50, background: C.red, color: "#fff", marginLeft: "auto" }}>{activeAlerts}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </header>
        
        <main style={{ width: "100%", maxWidth: "100%", padding: isMobile ? "12px" : "20px 24px", minHeight: "calc(100vh - 52px)", margin: "0 auto" }}>
          <div style={{ width: "100%", maxWidth: 1800, margin: "0 auto" }}>
            {pages[tab] || pages.dash}
          </div>
        </main>
      </div>
    </DataContext.Provider>
  );
}