import os
import io
import json
import uuid
import logging
import wave
import base64
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from pathlib import Path
from enum import Enum
from contextlib import asynccontextmanager

import torch
from PIL import Image
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

from sqlalchemy import Column, String, Integer, Text, DateTime, Float, JSON as SA_JSON, Enum as SA_Enum
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import select, delete, update

# ──────────────────────────── GEMINI TTS ────────────────────────────

try:
    from google import genai
    from google.genai import types as genai_types
    HAS_GEMINI = True
except ImportError:
    HAS_GEMINI = False
    genai = None
    genai_types = None

def generate_tts_audio(text: str, voice: str = "Kore", language: str = "vi") -> bytes:
    """Generate TTS audio using Gemini 2.5 Flash TTS."""
    if not HAS_GEMINI:
        raise RuntimeError("google-genai is not installed. Run: pip install google-genai")

    client = genai.Client()

    # Vietnamese-friendly voices: Aoede, Charon, Fenrir, Kore, Puck
    response = client.models.generate_content(
        model="gemini-2.5-flash-preview-tts",
        contents=text,
        config=genai_types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=genai_types.SpeechConfig(
                voice_config=genai_types.VoiceConfig(
                    prebuilt_voice_config=genai_types.PrebuiltVoiceConfig(
                        voice_name=voice,
                    )
                )
            ),
        )
    )

    # Get PCM audio data
    pcm_data = response.candidates[0].content.parts[0].inline_data.data

    # Convert to WAV
    wav_buffer = io.BytesIO()
    with wave.open(wav_buffer, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(24000)
        wf.writeframes(pcm_data)

    return wav_buffer.getvalue()

# ──────────────────────────── PDF SUPPORT ────────────────────────────

try:
    import fitz  # PyMuPDF
    HAS_FITZ = True
except ImportError:
    HAS_FITZ = False

def pdf_to_images(pdf_bytes: bytes, dpi: int = 200) -> List[Image.Image]:
    """Convert PDF pages to PIL Images using PyMuPDF."""
    if not HAS_FITZ:
        raise RuntimeError("PyMuPDF (fitz) is not installed. Run: pip install PyMuPDF")
    images = []
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    zoom = dpi / 72.0
    mat = fitz.Matrix(zoom, zoom)
    for page in doc:
        pix = page.get_pixmap(matrix=mat)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        images.append(img)
    doc.close()
    return images

def is_pdf(file: UploadFile, file_bytes: bytes) -> bool:
    """Detect if a file is PDF by extension, content-type, or magic bytes."""
    if file.content_type == "application/pdf":
        return True
    if file.filename and file.filename.lower().endswith(".pdf"):
        return True
    if file_bytes[:5] == b"%PDF-":
        return True
    return False

# ──────────────────────────── LOGGING ────────────────────────────

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("carevault")

# ──────────────────────────── CONFIGURATION ────────────────────────────

class Config:
    MODEL_ID = r"E:\compe_kaggle\model_med\medgemma-4b-it"
    DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
    TORCH_DTYPE = torch.bfloat16 if torch.cuda.is_available() else torch.float32
    MAX_NEW_TOKENS = 2048
    DATA_DIR = Path("./carevault_data")
    PATIENTS_DIR = DATA_DIR / "patients"
    IMAGES_DIR = DATA_DIR / "images"
    REPORTS_DIR = DATA_DIR / "reports"
    AUDIO_DIR = DATA_DIR / "audio"
    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://carevault:carevault@localhost:5432/carevault"
    )

    @classmethod
    def init_dirs(cls):
        for d in [cls.DATA_DIR, cls.PATIENTS_DIR, cls.IMAGES_DIR, cls.REPORTS_DIR, cls.AUDIO_DIR]:
            d.mkdir(parents=True, exist_ok=True)

Config.init_dirs()

# ──────────────────────────── DATABASE (PostgreSQL) ────────────────────────────

engine_db = create_async_engine(Config.DATABASE_URL, echo=False, pool_size=10, max_overflow=20)
async_session = async_sessionmaker(engine_db, class_=AsyncSession, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

class PatientDB(Base):
    __tablename__ = "patients"
    id = Column(String(16), primary_key=True, default=lambda: str(uuid.uuid4())[:8])
    name = Column(String(100), nullable=False, index=True)
    age = Column(Integer, nullable=False)
    gender = Column(String(10), nullable=False)
    condition = Column(Text, nullable=False)
    communication_status = Column(String(50), nullable=False)
    notes = Column(Text, default="")
    status = Column(String(20), default="ok")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class SymptomReportDB(Base):
    __tablename__ = "symptom_reports"
    id = Column(String(16), primary_key=True, default=lambda: str(uuid.uuid4())[:8])
    patient_id = Column(String(16), nullable=False, index=True)
    body_regions = Column(SA_JSON, default=list)
    symptoms = Column(SA_JSON, default=dict)
    emotion = Column(String(30))
    pain_level = Column(Integer, default=0)
    duration = Column(String(30))
    caregiver_notes = Column(Text, default="")
    ai_assessment = Column(Text, default="")
    urgency = Column(String(20), default="routine")
    created_at = Column(DateTime, default=datetime.utcnow)

class ImageAnalysisDB(Base):
    __tablename__ = "image_analyses"
    id = Column(String(16), primary_key=True, default=lambda: str(uuid.uuid4())[:8])
    patient_id = Column(String(16), index=True)
    analysis_type = Column(String(20))
    finding = Column(Text)
    confidence = Column(Float)
    details = Column(Text)
    simple_explanation = Column(Text)
    recommendations = Column(SA_JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)

async def init_db():
    try:
        async with engine_db.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("PostgreSQL tables initialized successfully.")
    except Exception as e:
        logger.warning(f"PostgreSQL not available (will use in-memory fallback): {e}")

async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session

# ──────────────────────────── MODELS (Pydantic) ────────────────────────────

class AnalysisType(str, Enum):
    SKIN = "skin"
    XRAY = "xray"
    EYE = "eye"
    CT = "ct"
    WOUND = "wound"
    DOCUMENT = "document"

class PatientProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    name: str
    age: int
    gender: str
    condition: str
    communication_status: str
    notes: str = ""
    created_at: datetime = Field(default_factory=datetime.now)

class SymptomCategory(BaseModel):
    pain: List[str] = []
    skin: List[str] = []
    respiratory: List[str] = []
    behavioral: List[str] = []
    digestive: List[str] = []

class SymptomReport(BaseModel):
    patient_id: str
    body_regions: List[str] = []
    symptoms: SymptomCategory = Field(default_factory=SymptomCategory)
    emotion: Optional[str] = None
    pain_level: int = 0
    duration: str = ""
    caregiver_notes: str = ""
    image_ids: List[str] = []
    timestamp: datetime = Field(default_factory=datetime.now)

class TranslateRequest(BaseModel):
    """Request model for MedTranslate endpoint."""
    text: str
    mode: str = "simple"
    patient_id: Optional[str] = None

class TTSRequest(BaseModel):
    """Request model for TTS endpoint."""
    text: str
    voice: str = "Kore"
    language: str = "vi"

class SpeechReportRequest(BaseModel):
    """Request model for generating speech report from body selections."""
    patient_id: Optional[str] = None
    patient_name: str = "Bệnh nhân"
    body_zones: List[str] = []
    symptoms: List[str] = []
    pain_level: int = 0
    duration: str = ""
    emotion: Optional[str] = None
    language: str = "vi"
    voice: str = "Kore"

class ImageAnalysisRequest(BaseModel):
    patient_id: Optional[str] = None
    analysis_type: AnalysisType
    clinical_context: str = ""

class ImageAnalysisResult(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    patient_id: Optional[str] = None
    analysis_type: str
    finding: str
    confidence: float
    details: str
    simple_explanation: str
    recommendations: List[str]
    bounding_boxes: List[Dict[str, Any]] = []
    timestamp: datetime = Field(default_factory=datetime.now)

class DocumentExtractionResult(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    patient_id: Optional[str] = None
    document_type: str
    extracted_data: Dict[str, Any]
    abnormal_values: List[Dict[str, Any]]
    simple_explanation: str
    timestamp: datetime = Field(default_factory=datetime.now)

class ClinicalReport(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    patient_id: str
    period_start: datetime
    period_end: datetime
    sections: Dict[str, str]
    generated_by: str = "MedGemma 1.5 4B"
    timestamp: datetime = Field(default_factory=datetime.now)

# ══════════════════════════════════════════════════════════════════
# BODY ZONES - Large clickable areas with Vietnamese labels
# ══════════════════════════════════════════════════════════════════

BODY_ZONES_LABELS = {
    # Front body zones
    "head": {"vi": "Đầu", "en": "Head"},
    "face": {"vi": "Mặt", "en": "Face"},
    "neck": {"vi": "Cổ", "en": "Neck"},
    "shoulder_l": {"vi": "Vai trái", "en": "Left shoulder"},
    "shoulder_r": {"vi": "Vai phải", "en": "Right shoulder"},
    "chest": {"vi": "Ngực", "en": "Chest"},
    "abdomen": {"vi": "Bụng", "en": "Abdomen"},
    "arm_l": {"vi": "Tay trái", "en": "Left arm"},
    "arm_r": {"vi": "Tay phải", "en": "Right arm"},
    "hip": {"vi": "Hông", "en": "Hip"},
    "leg_l": {"vi": "Chân trái", "en": "Left leg"},
    "leg_r": {"vi": "Chân phải", "en": "Right leg"},
    # Back body zones
    "b_head": {"vi": "Sau đầu", "en": "Back of head"},
    "b_neck": {"vi": "Gáy", "en": "Nape"},
    "upper_back": {"vi": "Lưng trên", "en": "Upper back"},
    "lower_back": {"vi": "Thắt lưng", "en": "Lower back"},
    "b_arm_l": {"vi": "Cánh tay trái (sau)", "en": "Left arm (back)"},
    "b_arm_r": {"vi": "Cánh tay phải (sau)", "en": "Right arm (back)"},
    "buttock": {"vi": "Mông", "en": "Buttock"},
    "b_leg_l": {"vi": "Chân trái (sau)", "en": "Left leg (back)"},
    "b_leg_r": {"vi": "Chân phải (sau)", "en": "Right leg (back)"},
    # Detail zones - Head
    "f_head_top": {"vi": "Đỉnh đầu", "en": "Top of head"},
    "f_forehead": {"vi": "Trán", "en": "Forehead"},
    "f_temple_l": {"vi": "Thái dương trái", "en": "Left temple"},
    "f_temple_r": {"vi": "Thái dương phải", "en": "Right temple"},
    "f_eye_l": {"vi": "Mắt trái", "en": "Left eye"},
    "f_eye_r": {"vi": "Mắt phải", "en": "Right eye"},
    "f_nose": {"vi": "Mũi", "en": "Nose"},
    "f_cheek_l": {"vi": "Má trái", "en": "Left cheek"},
    "f_cheek_r": {"vi": "Má phải", "en": "Right cheek"},
    "f_ear_l": {"vi": "Tai trái", "en": "Left ear"},
    "f_ear_r": {"vi": "Tai phải", "en": "Right ear"},
    "f_mouth": {"vi": "Miệng", "en": "Mouth"},
    "f_chin": {"vi": "Cằm", "en": "Chin"},
    # Detail zones - Chest
    "f_chest_l": {"vi": "Ngực trái", "en": "Left chest"},
    "f_chest_r": {"vi": "Ngực phải", "en": "Right chest"},
    "f_sternum": {"vi": "Xương ức", "en": "Sternum"},
    "f_rib_l": {"vi": "Sườn trái", "en": "Left ribs"},
    "f_rib_r": {"vi": "Sườn phải", "en": "Right ribs"},
    # Detail zones - Abdomen
    "f_abd_upper": {"vi": "Bụng trên", "en": "Upper abdomen"},
    "f_abd_l": {"vi": "Bụng trái", "en": "Left abdomen"},
    "f_abd_r": {"vi": "Bụng phải", "en": "Right abdomen"},
    "f_navel": {"vi": "Rốn", "en": "Navel"},
    "f_abd_lower": {"vi": "Bụng dưới", "en": "Lower abdomen"},
    # Detail zones - Arms
    "f_shoulder_l": {"vi": "Vai trái", "en": "Left shoulder"},
    "f_uarm_l": {"vi": "Bắp tay trên trái", "en": "Left upper arm"},
    "f_elbow_l": {"vi": "Khuỷu tay trái", "en": "Left elbow"},
    "f_farm_l": {"vi": "Cẳng tay trái", "en": "Left forearm"},
    "f_wrist_l": {"vi": "Cổ tay trái", "en": "Left wrist"},
    "f_palm_l": {"vi": "Bàn tay trái", "en": "Left palm"},
    "f_shoulder_r": {"vi": "Vai phải", "en": "Right shoulder"},
    "f_uarm_r": {"vi": "Bắp tay trên phải", "en": "Right upper arm"},
    "f_elbow_r": {"vi": "Khuỷu tay phải", "en": "Right elbow"},
    "f_farm_r": {"vi": "Cẳng tay phải", "en": "Right forearm"},
    "f_wrist_r": {"vi": "Cổ tay phải", "en": "Right wrist"},
    "f_palm_r": {"vi": "Bàn tay phải", "en": "Right palm"},
    # Detail zones - Legs
    "f_hip_l": {"vi": "Hông trái", "en": "Left hip"},
    "f_thigh_l": {"vi": "Đùi trái", "en": "Left thigh"},
    "f_knee_l": {"vi": "Đầu gối trái", "en": "Left knee"},
    "f_shin_l": {"vi": "Ống chân trái", "en": "Left shin"},
    "f_ankle_l": {"vi": "Mắt cá trái", "en": "Left ankle"},
    "f_foot_l": {"vi": "Bàn chân trái", "en": "Left foot"},
    "f_hip_r": {"vi": "Hông phải", "en": "Right hip"},
    "f_thigh_r": {"vi": "Đùi phải", "en": "Right thigh"},
    "f_knee_r": {"vi": "Đầu gối phải", "en": "Right knee"},
    "f_shin_r": {"vi": "Ống chân phải", "en": "Right shin"},
    "f_ankle_r": {"vi": "Mắt cá phải", "en": "Right ankle"},
    "f_foot_r": {"vi": "Bàn chân phải", "en": "Right foot"},
    # Back detail zones
    "b_nape": {"vi": "Gáy", "en": "Nape"},
    "b_scapula_l": {"vi": "Bả vai trái", "en": "Left scapula"},
    "b_scapula_r": {"vi": "Bả vai phải", "en": "Right scapula"},
    "b_spine_upper": {"vi": "Cột sống trên", "en": "Upper spine"},
    "b_spine_mid": {"vi": "Cột sống giữa", "en": "Mid spine"},
    "b_lumbar": {"vi": "Thắt lưng", "en": "Lumbar"},
    "b_sacrum": {"vi": "Xương cùng", "en": "Sacrum"},
    "b_butt_l": {"vi": "Mông trái", "en": "Left buttock"},
    "b_butt_r": {"vi": "Mông phải", "en": "Right buttock"},
    "b_ham_l": {"vi": "Đùi sau trái", "en": "Left hamstring"},
    "b_calf_l": {"vi": "Bắp chân trái", "en": "Left calf"},
    "b_heel_l": {"vi": "Gót chân trái", "en": "Left heel"},
    "b_ham_r": {"vi": "Đùi sau phải", "en": "Right hamstring"},
    "b_calf_r": {"vi": "Bắp chân phải", "en": "Right calf"},
    "b_heel_r": {"vi": "Gót chân phải", "en": "Right heel"},
}

def get_zone_label(zone_id: str, language: str = "vi") -> str:
    """Get localized label for a body zone."""
    zone = BODY_ZONES_LABELS.get(zone_id, {})
    return zone.get(language, zone.get("en", zone_id))

def generate_medical_report_text(
    patient_name: str,
    body_zones: List[str],
    symptoms: List[str],
    pain_level: int,
    duration: str,
    emotion: Optional[str],
    language: str = "vi"
) -> str:
    """Generate a spoken medical report from body zone selections."""

    # Get localized zone names
    zone_names = [get_zone_label(z, language) for z in body_zones]

    if language == "vi":
        # Vietnamese report
        report_parts = []

        # Opening
        report_parts.append(f"Báo cáo triệu chứng cho {patient_name}.")

        # Pain level
        if pain_level > 0:
            pain_desc = "nhẹ" if pain_level <= 3 else "trung bình" if pain_level <= 6 else "nặng"
            report_parts.append(f"Mức độ đau: {pain_level} trên 10, được đánh giá là {pain_desc}.")

        # Body regions
        if zone_names:
            if len(zone_names) == 1:
                report_parts.append(f"Vị trí đau: {zone_names[0]}.")
            else:
                report_parts.append(f"Các vị trí bị ảnh hưởng: {', '.join(zone_names[:-1])} và {zone_names[-1]}.")

        # Duration
        if duration:
            report_parts.append(f"Thời gian: {duration}.")

        # Symptoms
        if symptoms:
            report_parts.append(f"Triệu chứng kèm theo: {', '.join(symptoms)}.")

        # Emotion
        emotion_map = {
            "pain": "đau đớn",
            "anxious": "lo lắng",
            "sad": "buồn",
            "confused": "bối rối",
            "calm": "bình tĩnh",
            "happy": "vui vẻ",
        }
        if emotion:
            emo_vi = emotion_map.get(emotion, emotion)
            report_parts.append(f"Trạng thái cảm xúc: {emo_vi}.")

        # Closing
        if pain_level >= 7:
            report_parts.append("Khuyến nghị: Cần được khám ngay.")
        elif pain_level >= 4:
            report_parts.append("Khuyến nghị: Cần theo dõi chặt chẽ.")

        return " ".join(report_parts)

    else:
        # English report
        report_parts = []

        report_parts.append(f"Symptom report for {patient_name}.")

        if pain_level > 0:
            pain_desc = "mild" if pain_level <= 3 else "moderate" if pain_level <= 6 else "severe"
            report_parts.append(f"Pain level: {pain_level} out of 10, rated as {pain_desc}.")

        if zone_names:
            if len(zone_names) == 1:
                report_parts.append(f"Location: {zone_names[0]}.")
            else:
                report_parts.append(f"Affected areas: {', '.join(zone_names[:-1])} and {zone_names[-1]}.")

        if duration:
            report_parts.append(f"Duration: {duration}.")

        if symptoms:
            report_parts.append(f"Associated symptoms: {', '.join(symptoms)}.")

        emotion_map = {
            "pain": "in pain",
            "anxious": "anxious",
            "sad": "sad",
            "confused": "confused",
            "calm": "calm",
            "happy": "happy",
        }
        if emotion:
            emo_en = emotion_map.get(emotion, emotion)
            report_parts.append(f"Emotional state: {emo_en}.")

        if pain_level >= 7:
            report_parts.append("Recommendation: Immediate attention required.")
        elif pain_level >= 4:
            report_parts.append("Recommendation: Close monitoring advised.")

        return " ".join(report_parts)


# ── Legacy body point registry for backward compatibility ──
BODY_REGIONS = [
    "Head", "Face", "Neck", "Shoulder", "Chest", "Abdomen",
    "Upper back", "Lower back", "Left arm", "Right arm",
    "Hip", "Buttock", "Left leg", "Right leg",
]
BODY_POINT_IDS = set(BODY_ZONES_LABELS.keys())
BODY_POINT_LABELS = {k: v.get("en", k) for k, v in BODY_ZONES_LABELS.items()}

# ──────────────────────────── MEDGEMMA ENGINE ────────────────────────────

class MedGemmaEngine:
    def __init__(self):
        self.model = None
        self.processor = None
        self.is_loaded = False

    def load_model(self):
        if self.is_loaded:
            return
        logger.info(f"Loading MedGemma from {Config.MODEL_ID}...")
        logger.info(f"Device: {Config.DEVICE}, Dtype: {Config.TORCH_DTYPE}")
        try:
            from transformers import AutoProcessor, AutoModelForImageTextToText
            self.processor = AutoProcessor.from_pretrained(Config.MODEL_ID)
            self.model = AutoModelForImageTextToText.from_pretrained(
                Config.MODEL_ID,
                dtype=Config.TORCH_DTYPE,
                device_map="auto" if Config.DEVICE == "cuda" else None,
            )
            if Config.DEVICE != "cuda":
                self.model = self.model.to(Config.DEVICE)
            self.is_loaded = True
            logger.info("MedGemma loaded successfully!")
        except Exception as e:
            logger.error(f"Failed to load MedGemma: {e}")
            raise

    def _generate(self, messages: List[Dict], images: List[Image.Image] = None) -> str:
        if not self.is_loaded:
            self.load_model()
        inputs = self.processor.apply_chat_template(
            messages, add_generation_prompt=True, tokenize=True,
            return_dict=True, return_tensors="pt",
        ).to(self.model.device, dtype=Config.TORCH_DTYPE)
        input_len = inputs["input_ids"].shape[-1]
        with torch.inference_mode():
            generation = self.model.generate(**inputs, max_new_tokens=Config.MAX_NEW_TOKENS, do_sample=False)
            generation = generation[0][input_len:]
        return self.processor.decode(generation, skip_special_tokens=True)

    # ──── MEDICAL IMAGE ANALYSIS ────

    def analyze_image(self, image: Image.Image, analysis_type: AnalysisType,
                      clinical_context: str = "", patient_info: str = "") -> ImageAnalysisResult:
        prompts = {
            AnalysisType.SKIN: self._skin_prompt(clinical_context, patient_info),
            AnalysisType.XRAY: self._xray_prompt(clinical_context, patient_info),
            AnalysisType.EYE: self._eye_prompt(clinical_context, patient_info),
            AnalysisType.CT: self._ct_prompt(clinical_context, patient_info),
            AnalysisType.WOUND: self._wound_prompt(clinical_context, patient_info),
        }
        prompt = prompts.get(analysis_type, self._generic_prompt(clinical_context))
        messages = [{"role": "user", "content": [{"type": "image", "image": image}, {"type": "text", "text": prompt}]}]
        raw_response = self._generate(messages)
        return self._parse_analysis_response(raw_response, analysis_type)

    def _skin_prompt(self, context, patient_info):
        return f"""You are a dermatology AI assistant analyzing a skin image for a caregiver of a non-verbal patient. {f'Patient info: {patient_info}.' if patient_info else ''} {f'Clinical context: {context}.' if context else ''}
Please provide your analysis in the following JSON format:
{{"finding": "Primary finding in 5 words or fewer", "confidence": 0.0-1.0, "details": "Detailed clinical description including morphology, distribution, color, texture", "simple_explanation": "Explanation in simple language that a non-medical caregiver can understand.", "recommendations": ["List of 3-5 actionable recommendations"], "bounding_boxes": [{{"x": 0, "y": 0, "w": 100, "h": 100, "label": "description"}}], "urgency": "routine|attention|urgent"}}
Focus on: identifying the skin condition, assessing severity, checking for signs of infection, and providing clear guidance for the caregiver."""

    def _xray_prompt(self, context, patient_info):
        return f"""You are a radiology AI assistant analyzing a chest X-ray. {f'Patient info: {patient_info}.' if patient_info else ''} {f'Clinical context: {context}.' if context else ''}
Provide a structured analysis in JSON format:
{{"finding": "Primary finding in 5 words or fewer", "confidence": 0.0-1.0, "details": "Systematic reading: heart size, lung fields, mediastinum, pleura, bones", "simple_explanation": "Plain language explanation for a caregiver", "recommendations": ["List of actionable recommendations"], "bounding_boxes": [{{"x": 0, "y": 0, "w": 100, "h": 100, "label": "finding"}}]}}"""

    def _eye_prompt(self, context, patient_info):
        return f"""You are an ophthalmology AI assistant analyzing a fundus image. {f'Patient info: {patient_info}.' if patient_info else ''} {f'Clinical context: {context}.' if context else ''}
Provide analysis in JSON format:
{{"finding": "Primary finding", "confidence": 0.0-1.0, "details": "Assessment of optic disc, macula, vessels, retina", "simple_explanation": "Plain language explanation", "recommendations": ["Recommendations"], "bounding_boxes": []}}"""

    def _ct_prompt(self, context, patient_info):
        return f"""You are a radiology AI assistant analyzing a CT/MRI image. {f'Patient info: {patient_info}.' if patient_info else ''} {f'Clinical context: {context}.' if context else ''}
Provide structured analysis in JSON format:
{{"finding": "Primary finding", "confidence": 0.0-1.0, "details": "Detailed radiological description", "simple_explanation": "Plain language explanation for caregiver", "recommendations": ["Recommendations"]}}"""

    def _wound_prompt(self, context, patient_info):
        return f"""You are a wound care AI assistant analyzing a wound image for a caregiver of a non-verbal patient. {f'Patient info: {patient_info}.' if patient_info else ''} {f'Clinical context: {context}.' if context else ''}
Provide wound assessment in JSON format:
{{"finding": "Wound type and stage", "confidence": 0.0-1.0, "details": "Size estimate, depth, wound bed description, edges, surrounding skin, signs of infection", "simple_explanation": "Simple explanation for caregiver", "recommendations": ["Wound care instructions", "When to seek medical help"], "bounding_boxes": [{{"x": 0, "y": 0, "w": 100, "h": 100, "label": "wound area"}}], "urgency": "routine|attention|urgent"}}
CRITICAL: Assess for signs of infection."""

    def _generic_prompt(self, context):
        return f"""Analyze this medical image and provide findings. {context}
Return JSON with: finding, confidence, details, simple_explanation, recommendations."""

    def _parse_analysis_response(self, raw, analysis_type):
        try:
            json_start = raw.find("{")
            json_end = raw.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                data = json.loads(raw[json_start:json_end])
            else:
                data = {"finding": raw[:100], "confidence": 0.5, "details": raw, "simple_explanation": raw, "recommendations": []}
        except json.JSONDecodeError:
            data = {"finding": raw[:100], "confidence": 0.5, "details": raw, "simple_explanation": raw, "recommendations": []}
        return ImageAnalysisResult(
            analysis_type=analysis_type.value,
            finding=data.get("finding", "Analysis complete"),
            confidence=float(data.get("confidence", 0.5)),
            details=data.get("details", raw),
            simple_explanation=data.get("simple_explanation", data.get("details", raw)),
            recommendations=data.get("recommendations", []),
            bounding_boxes=data.get("bounding_boxes", []),
        )

    # ──── DOCUMENT UNDERSTANDING ────

    def extract_document(self, image: Image.Image, document_type: str = "lab_report") -> DocumentExtractionResult:
        prompt = f"""You are a medical document AI assistant. Extract all structured data from this {document_type}.
Return a JSON object with:
{{"document_type": "{document_type}", "patient_name": "if visible", "date": "document date", "facility": "lab/hospital name", "tests": [{{"name": "test name", "value": "numeric value", "unit": "unit", "reference_range": "normal range", "status": "normal|high|low|critical"}}], "abnormal_values": [{{"test": "test name", "value": "value", "reference": "normal range", "clinical_significance": "what this means"}}], "simple_explanation": "Plain language summary of results."}}
Extract EVERY test result visible in the document."""
        messages = [{"role": "user", "content": [{"type": "image", "image": image}, {"type": "text", "text": prompt}]}]
        raw_response = self._generate(messages)
        return self._parse_document_response(raw_response)

    def extract_document_multi_page(self, images: List[Image.Image], document_type: str = "lab_report") -> DocumentExtractionResult:
        """Extract data from multiple pages (e.g., multi-page PDF)."""
        all_tests = []
        all_abnormal = []
        all_explanations = []
        for i, img in enumerate(images):
            logger.info(f"Processing PDF page {i+1}/{len(images)}")
            result = self.extract_document(img, document_type)
            if result.extracted_data.get("tests"):
                all_tests.extend(result.extracted_data["tests"])
            if result.abnormal_values:
                all_abnormal.extend(result.abnormal_values)
            if result.simple_explanation:
                all_explanations.append(result.simple_explanation)
        merged_data = {
            "document_type": document_type,
            "pages_processed": len(images),
            "tests": all_tests,
            "abnormal_values": all_abnormal,
        }
        return DocumentExtractionResult(
            document_type=document_type,
            extracted_data=merged_data,
            abnormal_values=all_abnormal,
            simple_explanation=" ".join(all_explanations) if all_explanations else "Multi-page document processed.",
        )

    def _parse_document_response(self, raw):
        try:
            json_start = raw.find("{")
            json_end = raw.rfind("}") + 1
            data = json.loads(raw[json_start:json_end]) if json_start >= 0 else {}
        except json.JSONDecodeError:
            data = {}
        return DocumentExtractionResult(
            document_type=data.get("document_type", "lab_report"),
            extracted_data=data,
            abnormal_values=data.get("abnormal_values", []),
            simple_explanation=data.get("simple_explanation", raw),
        )

    # ──── SYMPTOM ASSESSMENT ────

    def assess_symptoms(self, report: SymptomReport, patient: PatientProfile, images: List[Image.Image] = None) -> str:
        symptom_lines = []
        sym = report.symptoms
        if sym.pain: symptom_lines.append(f"  Pain indicators: {', '.join(sym.pain)}")
        if sym.skin: symptom_lines.append(f"  Skin changes: {', '.join(sym.skin)}")
        if sym.respiratory: symptom_lines.append(f"  Respiratory signs: {', '.join(sym.respiratory)}")
        if sym.behavioral: symptom_lines.append(f"  Behavioral signs: {', '.join(sym.behavioral)}")
        if sym.digestive: symptom_lines.append(f"  Digestive symptoms: {', '.join(sym.digestive)}")
        symptom_block = "\n".join(symptom_lines) if symptom_lines else "  No specific symptoms indicated"

        comm_guidance = {
            "non-verbal": "This patient CANNOT speak or describe symptoms. Rely entirely on caregiver observation.",
            "aphasia": "This patient understands language but CANNOT produce speech fluently (Broca's aphasia).",
            "limited": "This patient has limited verbal ability.",
        }.get(patient.communication_status.lower(), f"Communication status: {patient.communication_status}.")

        # Get localized body region labels
        region_labels = [get_zone_label(r, "en") for r in report.body_regions]

        prompt = f"""You are a clinical AI assistant performing a SymptomBridge assessment for a patient who cannot communicate symptoms verbally.

PATIENT PROFILE:
- Name: {patient.name}, Age: {patient.age}, Gender: {patient.gender}
- Condition: {patient.condition}, Communication: {patient.communication_status}
- Notes: {patient.notes}

COMMUNICATION CONTEXT: {comm_guidance}

CAREGIVER OBSERVATIONS:
- Body regions: {', '.join(region_labels) if region_labels else 'None'}
- Duration: {report.duration or 'Not specified'}
- Emotion: {report.emotion or 'Not specified'}
- Pain level: {report.pain_level}/10
- Symptoms:
{symptom_block}
- Notes: {report.caregiver_notes or 'None'}
- Photos: {'Yes' if images else 'No'}

Return assessment as JSON:
{{"assessment": "Detailed assessment", "possible_causes": ["cause 1", "cause 2", "cause 3"], "red_flags": ["flag 1", "flag 2"], "immediate_actions": ["action 1", "action 2"], "follow_up": ["follow-up 1"], "simple_summary": "2-3 sentence summary for caregiver", "urgency": "routine|attention|urgent|emergency", "confidence_note": "Brief note on confidence"}}"""

        if images and len(images) > 0:
            content = [{"type": "image", "image": img} for img in images]
            content.append({"type": "text", "text": prompt})
        else:
            content = [{"type": "text", "text": prompt}]
        messages = [{"role": "user", "content": content}]
        return self._generate(messages)

    # ──── MEDICAL TEXT TRANSLATION ────

    def translate_medical_text(self, text: str, mode: str = "simple") -> Dict[str, str]:
        """Translate clinical text into simple, visual, and sign language formats."""
        prompt = f"""You are a medical communication AI assistant. Translate the following clinical text into THREE accessible formats for caregivers and patients who may have communication difficulties.

CLINICAL TEXT:
{text}

Return a JSON object with exactly these three keys:
{{
    "simple": "Rewrite using everyday language at a 6th-grade reading level. Explain all medical terms. Be clear and direct.",
    "visual": "Create a visual card format using short lines, body part labels, and action items in brackets like [Clean] [Dress]. Use simple icons/words.",
    "sign": "Convert to sign language gloss — ALL CAPS, short words, no grammar words, just key concepts in order."
}}"""
        messages = [{"role": "user", "content": [{"type": "text", "text": prompt}]}]
        raw = self._generate(messages)
        try:
            json_start = raw.find("{")
            json_end = raw.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                data = json.loads(raw[json_start:json_end])
                return {
                    "simple": data.get("simple", raw),
                    "visual": data.get("visual", raw),
                    "sign": data.get("sign", raw),
                }
        except json.JSONDecodeError:
            pass
        return {"simple": raw, "visual": raw, "sign": raw}

    # ──── LONGITUDINAL COMPARISON ────

    def compare_images(self, image_before, image_after, context="", days_between=0):
        prompt = f"""Compare two medical images taken at different times. {f'Time between: {days_between} days.' if days_between else ''} {f'Context: {context}' if context else ''}
The FIRST image is EARLIER, SECOND is MORE RECENT. Analyze changes, improvement/worsening, and recommend next steps."""
        messages = [{"role": "user", "content": [{"type": "image", "image": image_before}, {"type": "image", "image": image_after}, {"type": "text", "text": prompt}]}]
        return self._generate(messages)

    # ──── REPORT GENERATION ────

    def generate_report(self, patient, symptom_reports, image_analyses, lab_results, vitals):
        prompt = f"""Generate a comprehensive clinical report.
PATIENT: {patient.name}, {patient.age}yrs, {patient.gender}. CONDITION: {patient.condition}. COMMUNICATION: {patient.communication_status}
DATA: Symptom reports: {json.dumps(symptom_reports, default=str)}, Image analyses: {json.dumps(image_analyses, default=str)}, Lab results: {json.dumps(lab_results, default=str)}, Vitals: {json.dumps(vitals, default=str)}
Sections: 1. Clinical Overview, 2. Active Concerns, 3. Behavioral Observations, 4. Image Analysis Summary, 5. Lab Results, 6. Vital Signs, 7. Recommendations"""
        messages = [{"role": "user", "content": [{"type": "text", "text": prompt}]}]
        raw = self._generate(messages)
        return ClinicalReport(
            patient_id=patient.id,
            period_start=datetime.now() - timedelta(days=30),
            period_end=datetime.now(),
            sections={"full_report": raw},
        )

# ──────────────────────────── FASTAPI APP ────────────────────────────

@asynccontextmanager
async def lifespan(app):
    logger.info("CareVault API v2.3.0 starting up...")
    logger.info(f"PDF support (PyMuPDF): {'enabled' if HAS_FITZ else 'DISABLED — pip install PyMuPDF'}")
    logger.info(f"TTS support (Gemini): {'enabled' if HAS_GEMINI else 'DISABLED — pip install google-genai'}")
    await init_db()
    try:
        engine.load_model()
        logger.info("MedGemma engine ready.")
    except Exception as e:
        logger.warning(f"MedGemma not loaded (will use mock mode): {e}")
    yield
    await engine_db.dispose()
    logger.info("CareVault API shut down.")

app = FastAPI(
    title="CareVault API",
    description="AI-powered medical assistant for non-verbal patients — v2.3.0 with TTS",
    version="2.3.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = MedGemmaEngine()
analyses_db: Dict[str, ImageAnalysisResult] = {}
reports_db: Dict[str, Any] = {}
symptom_history_db: Dict[str, List[Dict]] = {}

# Pre-populate fallback patients matching frontend INIT_P
patients_fallback: Dict[str, PatientProfile] = {
    "p1": PatientProfile(id="p1", name="Minh Anh", age=8, gender="M", condition="Autism Spectrum Disorder", communication_status="Non-verbal", notes="Uses AAC device."),
    "p2": PatientProfile(id="p2", name="Bà Lan", age=78, gender="F", condition="Alzheimer's (Stage 5)", communication_status="Non-verbal", notes="Pressure ulcer risk."),
    "p3": PatientProfile(id="p3", name="Tuấn", age=45, gender="M", condition="Broca's Aphasia", communication_status="Aphasia", notes="Post-stroke."),
}

# ──── HEALTH CHECK ────

@app.get("/health")
async def health_check():
    db_ok = False
    try:
        async with async_session() as session:
            await session.execute(select(PatientDB.id).limit(1))
            db_ok = True
    except Exception:
        pass
    return {
        "status": "healthy",
        "version": "2.3.0",
        "model_loaded": engine.is_loaded,
        "database": "postgresql" if db_ok else "in-memory-fallback",
        "database_url": Config.DATABASE_URL.split("@")[-1] if db_ok else None,
        "device": Config.DEVICE,
        "model": Config.MODEL_ID,
        "pdf_support": HAS_FITZ,
        "tts_support": HAS_GEMINI,
        "offline_capable": True,
    }

# ══════════════════════════════════════════════════════════════════
# TTS ENDPOINTS - Text-to-Speech using Gemini
# ══════════════════════════════════════════════════════════════════

@app.post("/tts")
async def text_to_speech(req: TTSRequest):
    """Convert text to speech using Gemini 2.5 Flash TTS."""
    if not HAS_GEMINI:
        raise HTTPException(
            status_code=400,
            detail="TTS requires google-genai. Install with: pip install google-genai"
        )

    logger.info(f"TTS: voice={req.voice}, lang={req.language}, text_len={len(req.text)}")

    try:
        audio_bytes = generate_tts_audio(req.text, req.voice, req.language)

        # Return as base64 for easy frontend handling
        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

        return {
            "audio_base64": audio_b64,
            "format": "wav",
            "sample_rate": 24000,
            "channels": 1,
            "text": req.text,
            "voice": req.voice,
        }
    except Exception as e:
        logger.error(f"TTS error: {e}")
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")


@app.post("/tts/stream")
async def text_to_speech_stream(req: TTSRequest):
    """Stream TTS audio as WAV file."""
    if not HAS_GEMINI:
        raise HTTPException(
            status_code=400,
            detail="TTS requires google-genai. Install with: pip install google-genai"
        )

    try:
        audio_bytes = generate_tts_audio(req.text, req.voice, req.language)
        return Response(
            content=audio_bytes,
            media_type="audio/wav",
            headers={"Content-Disposition": "attachment; filename=speech.wav"}
        )
    except Exception as e:
        logger.error(f"TTS stream error: {e}")
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")


@app.post("/tts/report")
async def generate_speech_report(req: SpeechReportRequest):
    """Generate a spoken medical report from body zone selections."""
    logger.info(f"Speech Report: patient={req.patient_name}, zones={len(req.body_zones)}, pain={req.pain_level}")

    # Generate the report text
    report_text = generate_medical_report_text(
        patient_name=req.patient_name,
        body_zones=req.body_zones,
        symptoms=req.symptoms,
        pain_level=req.pain_level,
        duration=req.duration,
        emotion=req.emotion,
        language=req.language,
    )

    result = {
        "report_text": report_text,
        "body_zones": req.body_zones,
        "zone_labels": [get_zone_label(z, req.language) for z in req.body_zones],
        "pain_level": req.pain_level,
        "language": req.language,
    }

    # Generate audio if TTS is available
    if HAS_GEMINI:
        try:
            audio_bytes = generate_tts_audio(report_text, req.voice, req.language)
            result["audio_base64"] = base64.b64encode(audio_bytes).decode("utf-8")
            result["audio_format"] = "wav"
        except Exception as e:
            logger.warning(f"TTS failed, returning text only: {e}")
            result["tts_error"] = str(e)
    else:
        result["tts_error"] = "TTS not available (install google-genai)"

    return result


# ──── BODY ZONES ENDPOINT ────

@app.get("/body-zones")
async def get_body_zones():
    """Get all body zones with localized labels."""
    return {
        "total_zones": len(BODY_ZONES_LABELS),
        "zones": BODY_ZONES_LABELS,
        "languages": ["vi", "en"],
    }


@app.get("/body-zones/{zone_id}")
async def get_body_zone(zone_id: str, language: str = "vi"):
    """Get a specific body zone label."""
    if zone_id not in BODY_ZONES_LABELS:
        raise HTTPException(status_code=404, detail="Zone not found")
    return {
        "id": zone_id,
        "label": get_zone_label(zone_id, language),
        "labels": BODY_ZONES_LABELS[zone_id],
    }


# ──── LEGACY BODY POINTS (backward compatibility) ────

@app.get("/body-points")
async def get_body_points():
    return {
        "total_points": len(BODY_POINT_IDS),
        "regions": BODY_REGIONS,
        "points": BODY_POINT_LABELS,
        "views": {
            "front": {pid: lbl for pid, lbl in BODY_POINT_LABELS.items() if pid.startswith("f_")},
            "back": {pid: lbl for pid, lbl in BODY_POINT_LABELS.items() if pid.startswith("b_")},
        },
    }

# ──── PATIENT MANAGEMENT ────
# ══════════════════════════════════════════════════════════════════
# ADD THIS CODE TO YOUR main.py (CareVault Backend)
# Insert after the existing endpoint definitions
# ══════════════════════════════════════════════════════════════════

# ──── PYDANTIC MODELS FOR COMPARISON ────
# Add these to the Models section of main.py

class AssessmentData(BaseModel):
    """Single assessment data for comparison."""
    timestamp: str
    body_regions: List[str] = []
    symptoms: List[str] = []
    pain_level: int = 0
    emotion: Optional[str] = None
    duration: Optional[str] = None
    result: Optional[Dict[str, Any]] = None


class CompareAssessmentsRequest(BaseModel):
    """Request model for comparing two assessments."""
    assessment_older: AssessmentData
    assessment_newer: AssessmentData
    patient_info: str = "Unknown patient"


# ──── ASSESSMENT COMPARISON ENDPOINT ────
# Add this after the /compare/images endpoint

@app.post("/compare/assessments")
async def compare_assessments_endpoint(req: CompareAssessmentsRequest):
    """Compare two symptom assessments using AI analysis."""
    logger.info(f"Comparing assessments: {req.assessment_older.timestamp} vs {req.assessment_newer.timestamp}")

    # Calculate basic stats
    pain_change = req.assessment_newer.pain_level - req.assessment_older.pain_level
    new_symptoms = [s for s in req.assessment_newer.symptoms if s not in req.assessment_older.symptoms]
    resolved = [s for s in req.assessment_older.symptoms if s not in req.assessment_newer.symptoms]

    try:
        t1 = datetime.fromisoformat(req.assessment_older.timestamp.replace("Z", "+00:00"))
        t2 = datetime.fromisoformat(req.assessment_newer.timestamp.replace("Z", "+00:00"))
        days_between = abs((t2 - t1).days)
    except:
        days_between = 0

    # Build AI prompt
    older = req.assessment_older
    newer = req.assessment_newer

    older_symptoms = ", ".join(older.symptoms) if older.symptoms else "None recorded"
    newer_symptoms = ", ".join(newer.symptoms) if newer.symptoms else "None recorded"
    older_regions = ", ".join([get_zone_label(r, "en") for r in older.body_regions]) if older.body_regions else "None"
    newer_regions = ", ".join([get_zone_label(r, "en") for r in newer.body_regions]) if newer.body_regions else "None"
    older_ai = older.result.get("summary", "") if older.result else ""
    newer_ai = newer.result.get("summary", "") if newer.result else ""

    prompt = f"""You are a clinical AI assistant comparing two symptom assessments for a patient who cannot communicate verbally.

PATIENT: {req.patient_info}
TIME BETWEEN ASSESSMENTS: {days_between} day(s)

═══ EARLIER ASSESSMENT ({older.timestamp}) ═══
Pain Level: {older.pain_level}/10
Emotion: {older.emotion or "Not recorded"}
Duration: {older.duration or "Not specified"}
Body Regions: {older_regions}
Symptoms: {older_symptoms}
{f"Previous AI Assessment: {older_ai}" if older_ai else ""}

═══ LATER ASSESSMENT ({newer.timestamp}) ═══
Pain Level: {newer.pain_level}/10
Emotion: {newer.emotion or "Not recorded"}
Duration: {newer.duration or "Not specified"}
Body Regions: {newer_regions}
Symptoms: {newer_symptoms}
{f"Latest AI Assessment: {newer_ai}" if newer_ai else ""}

═══ OBSERVED CHANGES ═══
Pain Change: {pain_change:+d} (from {older.pain_level} to {newer.pain_level})
New Symptoms: {', '.join(new_symptoms) if new_symptoms else 'None'}
Resolved Symptoms: {', '.join(resolved) if resolved else 'None'}

Analyze the progression between these two assessments. Consider:
1. What do the pain level changes indicate?
2. Are new symptoms concerning or expected progression?
3. Are resolved symptoms a positive sign?
4. Changes in affected body regions
5. Emotional state changes and their significance
6. Overall clinical trend

Return your analysis as JSON:
{{
    "overall_assessment": "2-3 sentence clinical summary comparing the assessments and what the changes mean for patient care",
    "trend": "improving|worsening|stable|mixed",
    "key_changes": [
        {{"type": "positive|negative|neutral", "description": "specific change and its significance"}}
    ],
    "recommendations": ["specific actionable recommendation"],
    "concerns": ["any red flags or concerns to monitor closely"]
}}"""

    try:
        if engine.is_loaded:
            messages = [{"role": "user", "content": [{"type": "text", "text": prompt}]}]
            raw_response = engine._generate(messages)

            # Parse JSON
            json_start = raw_response.find("{")
            json_end = raw_response.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                data = json.loads(raw_response[json_start:json_end])
            else:
                raise ValueError("No JSON in response")
        else:
            raise ValueError("Engine not loaded")

    except Exception as e:
        logger.warning(f"AI comparison failed, using fallback: {e}")

        # Determine trend based on simple heuristics
        trend = "stable"
        if pain_change > 1 or (len(new_symptoms) > len(resolved) + 1):
            trend = "worsening"
        elif pain_change < -1 or (len(resolved) > len(new_symptoms) + 1):
            trend = "improving"
        elif pain_change != 0 or new_symptoms or resolved:
            trend = "mixed"

        # Generate fallback assessment
        assessment_parts = []
        if pain_change != 0:
            assessment_parts.append(
                f"Pain level {'increased' if pain_change > 0 else 'decreased'} by {abs(pain_change)} points (from {older.pain_level} to {newer.pain_level}).")
        else:
            assessment_parts.append(f"Pain level remained stable at {newer.pain_level}/10.")

        if new_symptoms:
            assessment_parts.append(f"New symptoms observed: {', '.join(new_symptoms)}.")
        if resolved:
            assessment_parts.append(f"Resolved symptoms: {', '.join(resolved)}.")

        if trend == "improving":
            assessment_parts.append("Overall, the condition appears to be improving.")
        elif trend == "worsening":
            assessment_parts.append("The condition shows signs of worsening and requires attention.")
        else:
            assessment_parts.append("The condition shows mixed or stable progression.")

        data = {
            "overall_assessment": " ".join(assessment_parts),
            "trend": trend,
            "key_changes": [],
            "recommendations": ["Continue regular monitoring", "Document any additional changes",
                                "Consider follow-up if symptoms persist"],
            "concerns": []
        }

        # Build key changes list
        if pain_change != 0:
            data["key_changes"].append({
                "type": "negative" if pain_change > 0 else "positive",
                "description": f"Pain level {'increased' if pain_change > 0 else 'decreased'} from {older.pain_level} to {newer.pain_level}"
            })

        for s in new_symptoms:
            data["key_changes"].append({"type": "negative", "description": f"New symptom appeared: {s}"})
            data["concerns"].append(f"Monitor new symptom: {s}")

        for s in resolved:
            data["key_changes"].append({"type": "positive", "description": f"Symptom resolved: {s}"})

        # Emotion change
        if older.emotion and newer.emotion and older.emotion != newer.emotion:
            negative_emotions = ["distressed", "anxious", "sad", "pain", "confused"]
            positive_emotions = ["calm", "happy", "relaxed"]

            if newer.emotion in negative_emotions and older.emotion in positive_emotions:
                change_type = "negative"
            elif newer.emotion in positive_emotions and older.emotion in negative_emotions:
                change_type = "positive"
            else:
                change_type = "neutral"

            data["key_changes"].append({
                "type": change_type,
                "description": f"Emotional state changed from '{older.emotion}' to '{newer.emotion}'"
            })

        # Body region changes
        old_regions = set(older.body_regions)
        new_regions = set(newer.body_regions)
        added_regions = new_regions - old_regions
        removed_regions = old_regions - new_regions

        if added_regions:
            region_names = [get_zone_label(r, "en") for r in added_regions]
            data["key_changes"].append({
                "type": "negative",
                "description": f"New affected areas: {', '.join(region_names)}"
            })

        if removed_regions:
            region_names = [get_zone_label(r, "en") for r in removed_regions]
            data["key_changes"].append({
                "type": "positive",
                "description": f"Areas no longer affected: {', '.join(region_names)}"
            })

    # Add computed fields to response
    data["pain_change"] = pain_change
    data["new_symptoms"] = new_symptoms
    data["resolved_symptoms"] = resolved
    data["days_between"] = days_between
    data["timestamp"] = datetime.now().isoformat()

    return data
@app.post("/patients", response_model=PatientProfile)
async def create_patient(patient: PatientProfile, db: AsyncSession = Depends(get_db)):
    try:
        db_patient = PatientDB(
            id=patient.id, name=patient.name, age=patient.age, gender=patient.gender,
            condition=patient.condition, communication_status=patient.communication_status, notes=patient.notes,
        )
        db.add(db_patient)
        await db.commit()
        await db.refresh(db_patient)
        logger.info(f"Patient {patient.name} saved to PostgreSQL (id={patient.id})")
        return patient
    except Exception as e:
        logger.warning(f"PostgreSQL insert failed, using fallback: {e}")
        patients_fallback[patient.id] = patient
        return patient

@app.get("/patients")
async def list_patients(db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(select(PatientDB).order_by(PatientDB.created_at.desc()))
        rows = result.scalars().all()
        return [PatientProfile(id=r.id, name=r.name, age=r.age, gender=r.gender, condition=r.condition, communication_status=r.communication_status, notes=r.notes or "", created_at=r.created_at) for r in rows]
    except Exception:
        return list(patients_fallback.values())

@app.get("/patients/{patient_id}")
async def get_patient(patient_id: str, db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(select(PatientDB).where(PatientDB.id == patient_id))
        row = result.scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Patient not found")
        return PatientProfile(id=row.id, name=row.name, age=row.age, gender=row.gender, condition=row.condition, communication_status=row.communication_status, notes=row.notes or "", created_at=row.created_at)
    except HTTPException:
        raise
    except Exception:
        if patient_id in patients_fallback:
            return patients_fallback[patient_id]
        raise HTTPException(status_code=404, detail="Patient not found")

@app.put("/patients/{patient_id}", response_model=PatientProfile)
async def update_patient(patient_id: str, patient: PatientProfile, db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(select(PatientDB).where(PatientDB.id == patient_id))
        row = result.scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Patient not found")
        row.name = patient.name; row.age = patient.age; row.gender = patient.gender
        row.condition = patient.condition; row.communication_status = patient.communication_status
        row.notes = patient.notes; row.updated_at = datetime.utcnow()
        await db.commit()
        return patient
    except HTTPException:
        raise
    except Exception as e:
        if patient_id in patients_fallback:
            patients_fallback[patient_id] = patient
            return patient
        raise HTTPException(status_code=404, detail="Patient not found")

@app.delete("/patients/{patient_id}")
async def delete_patient(patient_id: str, db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(delete(PatientDB).where(PatientDB.id == patient_id))
        await db.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Patient not found")
        return {"deleted": True, "patient_id": patient_id}
    except HTTPException:
        raise
    except Exception:
        if patient_id in patients_fallback:
            del patients_fallback[patient_id]
            return {"deleted": True, "patient_id": patient_id}
        raise HTTPException(status_code=404, detail="Patient not found")

# ──── IMAGE ANALYSIS ────

@app.post("/analyze/image", response_model=ImageAnalysisResult)
async def analyze_image(
    file: UploadFile = File(...),
    analysis_type: AnalysisType = Form(AnalysisType.SKIN),
    patient_id: Optional[str] = Form(None),
    clinical_context: str = Form(""),
):
    """Analyze a medical image using MedGemma."""
    logger.info(f"CareVision: analysis_type={analysis_type.value}, file={file.filename}")

    image_bytes = await file.read()
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    patient_info = ""
    if patient_id and patient_id in patients_fallback:
        p = patients_fallback[patient_id]
        patient_info = f"{p.name}, {p.age}yrs {p.gender}, {p.condition}. {p.notes}"

    result = engine.analyze_image(
        image=image,
        analysis_type=analysis_type,
        clinical_context=clinical_context,
        patient_info=patient_info,
    )
    result.patient_id = patient_id
    analyses_db[result.id] = result
    image_path = Config.IMAGES_DIR / f"{result.id}.png"
    image.save(image_path)
    return result

# ──── DOCUMENT ANALYSIS ────

@app.post("/analyze/document", response_model=DocumentExtractionResult)
async def analyze_document(
    file: UploadFile = File(...),
    patient_id: Optional[str] = Form(None),
    document_type: str = Form("lab_report"),
):
    """Extract structured data from medical documents (images or PDFs)."""
    file_bytes = await file.read()

    if is_pdf(file, file_bytes):
        logger.info(f"DocAI: PDF detected — {file.filename} ({len(file_bytes)} bytes)")
        if not HAS_FITZ:
            raise HTTPException(
                status_code=400,
                detail="PDF support requires PyMuPDF. Install with: pip install PyMuPDF"
            )
        images = pdf_to_images(file_bytes, dpi=200)
        logger.info(f"DocAI: Converted PDF to {len(images)} page image(s)")
        if len(images) == 1:
            result = engine.extract_document(images[0], document_type)
        else:
            result = engine.extract_document_multi_page(images, document_type)
    else:
        image = Image.open(io.BytesIO(file_bytes)).convert("RGB")
        result = engine.extract_document(image, document_type)

    result.patient_id = patient_id
    return result

# ──── SYMPTOM ASSESSMENT ────

@app.post("/assess/symptoms")
async def assess_symptoms(report: SymptomReport):
    """SymptomBridge AI Assessment — JSON-only endpoint."""
    logger.info(f"SymptomBridge: patient_id={report.patient_id}, regions={len(report.body_regions)}, pain={report.pain_level}")

    if report.patient_id not in patients_fallback:
        logger.warning(f"Patient {report.patient_id} not in fallback store — creating temp profile")
        patients_fallback[report.patient_id] = PatientProfile(
            id=report.patient_id, name=f"Patient {report.patient_id}",
            age=0, gender="Unknown", condition="Unknown",
            communication_status="Non-verbal", notes="Auto-created from SymptomBridge submission",
        )

    patient = patients_fallback[report.patient_id]
    result = engine.assess_symptoms(report, patient, images=None)

    entry = {
        "report": report.dict(),
        "assessment": result,
        "timestamp": datetime.now().isoformat(),
    }
    if report.patient_id not in symptom_history_db:
        symptom_history_db[report.patient_id] = []
    symptom_history_db[report.patient_id].append(entry)

    return {
        "assessment": result,
        "patient_id": report.patient_id,
        "symptom_count": (
            len(report.symptoms.pain) + len(report.symptoms.skin) +
            len(report.symptoms.respiratory) + len(report.symptoms.behavioral) +
            len(report.symptoms.digestive)
        ),
        "regions_flagged": len(report.body_regions),
        "regions_labels": [get_zone_label(r, "vi") for r in report.body_regions],
        "timestamp": datetime.now().isoformat(),
    }

@app.post("/assess/symptoms/with-images")
async def assess_symptoms_with_images(
    patient_id: str = Form(...),
    body_regions: str = Form("[]"),
    symptoms_pain: str = Form("[]"),
    symptoms_skin: str = Form("[]"),
    symptoms_respiratory: str = Form("[]"),
    symptoms_behavioral: str = Form("[]"),
    symptoms_digestive: str = Form("[]"),
    emotion: Optional[str] = Form(None),
    pain_level: int = Form(0),
    duration: str = Form(""),
    caregiver_notes: str = Form(""),
    files: List[UploadFile] = File(default=[]),
):
    """SymptomBridge with image uploads."""
    if patient_id not in patients_fallback:
        raise HTTPException(status_code=404, detail="Patient not found")
    patient = patients_fallback[patient_id]

    report = SymptomReport(
        patient_id=patient_id,
        body_regions=json.loads(body_regions),
        symptoms=SymptomCategory(
            pain=json.loads(symptoms_pain),
            skin=json.loads(symptoms_skin),
            respiratory=json.loads(symptoms_respiratory),
            behavioral=json.loads(symptoms_behavioral),
            digestive=json.loads(symptoms_digestive),
        ),
        emotion=emotion,
        pain_level=pain_level,
        duration=duration,
        caregiver_notes=caregiver_notes,
    )

    images = []
    for f in files:
        img_bytes = await f.read()
        images.append(Image.open(io.BytesIO(img_bytes)).convert("RGB"))

    result = engine.assess_symptoms(report, patient, images if images else None)

    entry = {
        "report": report.dict(),
        "assessment": result,
        "timestamp": datetime.now().isoformat(),
    }
    if patient_id not in symptom_history_db:
        symptom_history_db[patient_id] = []
    symptom_history_db[patient_id].append(entry)

    return {
        "assessment": result,
        "patient_id": patient_id,
        "symptom_count": (
            len(report.symptoms.pain) + len(report.symptoms.skin) +
            len(report.symptoms.respiratory) + len(report.symptoms.behavioral) +
            len(report.symptoms.digestive)
        ),
        "regions_flagged": len(report.body_regions),
        "regions_labels": [get_zone_label(r, "vi") for r in report.body_regions],
        "timestamp": datetime.now().isoformat(),
    }

# ──── MEDICAL TEXT TRANSLATION ────

@app.post("/translate")
async def translate_medical_text(req: TranslateRequest):
    """Translate clinical text into accessible formats."""
    logger.info(f"MedTranslate: mode={req.mode}, text_len={len(req.text)}")
    result = engine.translate_medical_text(req.text, req.mode)
    return {
        "simple": result.get("simple", ""),
        "visual": result.get("visual", ""),
        "sign": result.get("sign", ""),
        "original": req.text,
        "timestamp": datetime.now().isoformat(),
    }

# ──── SYMPTOM HISTORY ────

@app.get("/symptombridge/history/{patient_id}")
async def get_symptom_history(patient_id: str, limit: int = 20):
    if patient_id not in patients_fallback:
        raise HTTPException(status_code=404, detail="Patient not found")
    history = symptom_history_db.get(patient_id, [])
    return {"patient_id": patient_id, "total_assessments": len(history), "history": history[-limit:]}

@app.get("/symptombridge/trends/{patient_id}")
async def get_symptom_trends(patient_id: str):
    history = symptom_history_db.get(patient_id, [])
    if not history:
        return {"patient_id": patient_id, "trends": [], "message": "No history available"}
    pain_trend, emotion_counts, region_frequency, symptom_frequency = [], {}, {}, {}
    for entry in history:
        report = entry.get("report", {})
        pain_trend.append({"timestamp": entry.get("timestamp"), "pain_level": report.get("pain_level", 0)})
        emo = report.get("emotion")
        if emo: emotion_counts[emo] = emotion_counts.get(emo, 0) + 1
        for r in report.get("body_regions", []):
            region_frequency[r] = region_frequency.get(r, 0) + 1
        syms = report.get("symptoms", {})
        for cat_items in syms.values():
            if isinstance(cat_items, list):
                for item in cat_items:
                    symptom_frequency[item] = symptom_frequency.get(item, 0) + 1
    return {
        "patient_id": patient_id, "pain_trend": pain_trend,
        "most_common_emotions": sorted(emotion_counts.items(), key=lambda x: -x[1]),
        "most_affected_regions": sorted([(get_zone_label(r, "vi"), c) for r, c in region_frequency.items()], key=lambda x: -x[1]),
        "most_frequent_symptoms": sorted(symptom_frequency.items(), key=lambda x: -x[1]),
        "total_assessments": len(history),
    }

# ──── LONGITUDINAL COMPARISON ────

@app.post("/compare/images")
async def compare_images(
    image_before: UploadFile = File(...),
    image_after: UploadFile = File(...),
    context: str = "",
    days_between: int = 0,
):
    img1 = Image.open(io.BytesIO(await image_before.read())).convert("RGB")
    img2 = Image.open(io.BytesIO(await image_after.read())).convert("RGB")
    result = engine.compare_images(img1, img2, context, days_between)
    return {"comparison": result, "timestamp": datetime.now().isoformat()}

# ──── REPORT GENERATION ────

@app.post("/reports/generate")
async def generate_report(patient_id: str):
    if patient_id not in patients_fallback:
        raise HTTPException(status_code=404, detail="Patient not found")
    patient = patients_fallback[patient_id]
    patient_analyses = [a.dict() for a in analyses_db.values() if a.patient_id == patient_id]
    report = engine.generate_report(patient=patient, symptom_reports=[], image_analyses=patient_analyses, lab_results=[], vitals=[])
    reports_db[report.id] = report
    return report

# ──── OFFLINE STATUS ────

@app.get("/status/offline")
async def offline_status():
    return {
        "offline_capable": True,
        "model_loaded_locally": engine.is_loaded,
        "pdf_support": HAS_FITZ,
        "tts_support": HAS_GEMINI,
        "supported_offline_features": [
            "Medical image analysis", "Document/lab report extraction (image + PDF)",
            "Symptom assessment", "Medical text translation",
            "Longitudinal image comparison", "Report generation",
            "Text-to-speech for medical reports",
        ],
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)