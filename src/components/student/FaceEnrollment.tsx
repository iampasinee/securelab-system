import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Camera, RefreshCw, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, User } from 'lucide-react';

export const FaceEnrollment: React.FC = () => {
  const { currentStudent, updateFaceReference, setActiveStudentStep, showToast, language } = useApp();
  const isThai = language === 'th';

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } else {
        setCameraError(isThai ? 'เบราว์เซอร์ไม่รองรับกล้องเว็บแคม ระบบจะใช้ตัวจำลองภาพชีวมิติอัตโนมัติ' : 'Webcam API is not supported in this browser. Falling back to camera simulator.');
      }
    } catch (err: any) {
      console.warn('Camera access error or denied:', err);
      setCameraError(isThai ? 'ไม่สามารถเข้าถึงกล้องเว็บแคมได้ หรือไม่ได้เชื่อมต่อกล้อง คุณสามารถใช้ระบบจำลองภาพชีวมิติเพื่อเสร็จสิ้นขั้นตอนนี้ได้' : 'Webcam access was denied or no camera device found. You may use the built-in biometric simulator to complete enrollment.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const handleCapture = () => {
    setIsProcessing(true);

    setTimeout(() => {
      if (videoRef.current && canvasRef.current && stream) {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg');
          setCapturedImage(dataUrl);
          setFaceDetected(true);
        }
      } else {
        // Simulated capture fallback
        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(0, 0, 400, 400);
          ctx.fillStyle = '#3b82f6';
          ctx.beginPath();
          ctx.arc(200, 160, 70, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(200, 360, 120, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 16px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(currentStudent?.fullName || 'Enrolled Student', 200, 380);
          const dataUrl = canvas.toDataURL('image/jpeg');
          setCapturedImage(dataUrl);
          setFaceDetected(true);
        }
      }
      setIsProcessing(false);
    }, 400);
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setFaceDetected(false);
  };

  const handleConfirm = () => {
    if (!capturedImage || !currentStudent) return;
    updateFaceReference(currentStudent.id, capturedImage);
    setActiveStudentStep('ST3'); // Continue to Exam Info & Rules
  };

  return (
    <div className="relative mx-auto mt-3 mb-6 w-[calc(100%-2rem)] max-w-2xl scroll-mt-[92px] rounded-2xl border border-gray-100 bg-white p-6 text-left shadow-xl sm:mt-4">
      <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
            {isThai ? 'การตั้งค่าสำหรับผู้เข้าสอบครั้งแรก (ขั้นตอนที่ 2 จาก 2)' : 'First-Time Setup (Step 2 of 2)'}
          </span>
          <h2 className="text-2xl font-bold text-gray-900 mt-1">
            {isThai ? 'ลงทะเบียนข้อมูลภาพชีวมิติใบหน้าอ้างอิง' : 'Biometric Face Reference Enrollment'}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {isThai ? 'ผู้เข้าสอบ: ' : 'Examinee: '}
            <strong className="text-gray-800">{currentStudent?.fullName}</strong> ({currentStudent?.studentCode})
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
          <Camera className="w-5 h-5" />
        </div>
      </div>

      {cameraError && (
        <div className="mb-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="leading-snug">
            <span className="font-semibold block mb-0.5">
              {isThai ? 'ข้อความแจ้งเตือนกล้องห้องปฏิบัติการ:' : 'Laboratory Camera Notice:'}
            </span>
            {cameraError}
          </div>
        </div>
      )}

      {/* Video / Capture Container */}
      <div className="relative aspect-4/3 w-full bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-800 flex items-center justify-center shadow-inner">
        {capturedImage ? (
          <img
            src={capturedImage}
            alt="Captured Face Reference"
            className="w-full h-full object-cover"
          />
        ) : stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform -scale-x-100"
          />
        ) : (
          <div className="text-center p-6 text-slate-400">
            <User className="w-16 h-16 mx-auto mb-3 text-slate-600 animate-pulse" />
            <div className="text-sm font-medium text-slate-300">
              {isThai ? 'ระบบจำลองตำแหน่งใบหน้าชีวมิติ' : 'Biometric Positioning Simulator'}
            </div>
            <div className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              {isThai
                ? 'มองตรงไปยังกรอบกล้องเพื่อบันทึกภาพแม่แบบอ้างอิงสำหรับการคุมสอบ'
                : 'Look directly into the camera preview frame to record your reference template.'}
            </div>
          </div>
        )}

        {/* Biometric Oval Guide Overlay (when not captured yet) */}
        {!capturedImage && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
            <div className="w-48 h-64 border-2 border-dashed border-blue-400/80 rounded-[50%] shadow-[0_0_0_9999px_rgba(15,23,42,0.4)] flex items-center justify-center">
              <span className="text-[11px] font-semibold text-blue-200 bg-blue-900/80 px-2 py-0.5 rounded-md backdrop-blur-xs">
                {isThai ? 'จัดตำแหน่งใบหน้าในกรอบ' : 'Align Face Here'}
              </span>
            </div>
            <div className="mt-4 text-xs text-white/90 bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-sm">
              {isThai ? 'วางศีรษะให้อยู่ตรงกลาง มองตรง และหลีกเลี่ยงแสงสะท้อนจ้า' : 'Keep head centered, look straight ahead, avoid glare'}
            </div>
          </div>
        )}

        {/* Success overlay on capture */}
        {capturedImage && (
          <div className="absolute top-4 right-4 bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
            <CheckCircle2 className="w-4 h-4" />
            <span>{isThai ? 'บันทึกภาพแม่แบบอ้างอิงสำเร็จ' : 'Face Reference Captured'}</span>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Action Controls */}
      <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-gray-500 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>
            {isThai
              ? 'จัดเก็บรหัสภาพชีวมิติความปลอดภัยเพื่อให้อาจารย์ผู้คุมสอบตรวจสอบ'
              : 'Biometric hash stored locally for proctor verification'}
          </span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {capturedImage ? (
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{isThai ? 'ถ่ายภาพใหม่' : 'Retake Photo'}</span>
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{isThai ? 'ยืนยันภาพอ้างอิงและดำเนินการต่อ' : 'Confirm Face Reference'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleCapture}
              disabled={isProcessing}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>
                {isProcessing
                  ? (isThai ? 'กำลังประมวลผล...' : 'Processing...')
                  : (isThai ? 'ถ่ายภาพใบหน้าอ้างอิง' : 'Capture Face Reference')}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
