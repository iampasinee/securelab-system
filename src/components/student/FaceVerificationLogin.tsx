import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ScanFace,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Camera,
} from 'lucide-react';

export const FaceVerificationLogin: React.FC = () => {
  const { currentStudent, setActiveStudentStep, showToast, language } = useApp();
  const isThai = language === 'th';

  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [verificationState, setVerificationState] = useState<'idle' | 'scanning' | 'success' | 'failed'>('idle');
  const [matchScore, setMatchScore] = useState<number>(0);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    startCamera();
    // Auto-trigger verification scan after brief pause
    const timer = setTimeout(() => {
      runVerificationScan();
    }, 800);

    return () => {
      stopCamera();
      clearTimeout(timer);
    };
  }, []);

  const startCamera = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }
    } catch (e) {
      console.warn('Camera access unavailable or declined:', e);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
  };

  const runVerificationScan = (forceFailure: boolean = false) => {
    setVerificationState('scanning');
    setMatchScore(0);

    // If student is suspended (e.g. std_0003), or forced failure
    const shouldFail = forceFailure || currentStudent?.accountStatus === 'suspended';

    let progress = 10;
    const interval = setInterval(() => {
      progress += 20;
      if (progress >= 95) {
        clearInterval(interval);
        if (shouldFail) {
          setMatchScore(42);
          setVerificationState('failed');
          setAttempts((prev) => prev + 1);
          showToast(
            isThai ? 'ยืนยันตัวตนไม่สำเร็จ' : 'Verification Failed',
            currentStudent?.accountStatus === 'suspended'
              ? (isThai ? 'บัญชีนักศึกษาถูกระงับสิทธิ์ กรุณาติดต่ออาจารย์ผู้คุมสอบ' : 'Student account is suspended. Proctor authorization required.')
              : (isThai ? 'คะแนนความเหมือนต่ำกว่าเกณฑ์ที่กำหนด (42% < 85%) กรุณาลองใหม่อีกครั้ง' : 'Facial similarity threshold not met (42% < 85%). Please retry or contact proctor.'),
            'error'
          );
        } else {
          setMatchScore(98.4);
          setVerificationState('success');
          showToast(
            isThai ? 'ยืนยันตัวตนถูกต้อง' : 'Identity Verified',
            isThai ? 'ความสอดคล้องของใบหน้าผ่านเกณฑ์ที่ 98.4%' : 'Facial reference match confirmed at 98.4%.',
            'success'
          );
        }
      } else {
        setMatchScore(progress);
      }
    }, 150);
  };

  const handleContinue = () => {
    stopCamera();
    setActiveStudentStep('ST3');
  };

  return (
    <div className="relative mx-auto mt-3 mb-6 w-[calc(100%-2rem)] max-w-[920px] scroll-mt-[92px] rounded-2xl border border-gray-100 bg-white p-6 text-left shadow-xl sm:mt-4">
      <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
            {isThai ? 'การยืนยันตัวตนชีวมิติประจำเครื่องสอบ (ขั้นตอน ST2C)' : 'Workstation Biometric Authentication (ST2C)'}
          </span>
          <h2 className="text-2xl font-bold text-gray-900 mt-1">
            {isThai ? 'ตรวจสอบความถูกต้องของใบหน้าผู้เข้าสอบ' : 'Facial Identity Verification'}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {isThai ? 'ผู้เข้าสอบ: ' : 'Examinee: '}
            <strong className="text-gray-800">{currentStudent?.fullName}</strong> ({currentStudent?.studentCode})
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
          <ScanFace className="w-5 h-5" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Enrolled Reference Image */}
        <div className="md:col-span-1 flex flex-col items-center justify-center p-4 bg-gray-50 rounded-xl border border-gray-200 text-center">
          <span className="text-xs font-semibold text-gray-600 mb-3">
            {isThai ? 'ภาพถ่ายอ้างอิง ICIT' : 'Enrolled ICIT Reference'}
          </span>
          <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-blue-500 shadow-sm mb-3 bg-gray-200">
            {currentStudent?.faceReferenceUrl ? (
              <img
                src={currentStudent.faceReferenceUrl}
                alt="Enrolled Reference"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 text-xs">
                {isThai ? 'ไม่มีรูปภาพ' : 'No Photo'}
              </div>
            )}
          </div>
          <span className="text-xs font-medium text-gray-800">{currentStudent?.fullName}</span>
          <span className="text-[11px] text-gray-500 font-mono mt-0.5">{currentStudent?.studentCode}</span>
        </div>

        {/* Live Video / Scanner */}
        <div className="md:col-span-2 relative h-[280px] md:h-[300px] bg-slate-950 rounded-xl overflow-hidden border-2 border-slate-800 flex items-center justify-center">
          {stream ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />
          ) : (
            <div className="text-center p-6 text-slate-400">
              <Camera className="w-12 h-12 mx-auto mb-2 text-slate-600" />
              <div className="text-sm font-medium text-slate-300">
                {isThai ? 'สัญญาณภาพจากกล้องเว็บแคม' : 'Live Camera Stream'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {isThai ? 'จัดตำแหน่งใบหน้าให้อยู่ภายในกรอบเป้าหมาย' : 'Align face inside biometric target frame'}
              </div>
            </div>
          )}

          {/* Biometric Scanning Reticle */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
            <div
              className={`w-40 h-52 border-2 rounded-[50%] transition-all duration-300 flex items-center justify-center ${
                verificationState === 'scanning'
                  ? 'border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.6)] animate-pulse'
                  : verificationState === 'success'
                  ? 'border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.7)]'
                  : verificationState === 'failed'
                  ? 'border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.7)]'
                  : 'border-slate-500'
              }`}
            >
              {verificationState === 'scanning' && (
                <div className="w-full h-0.5 bg-blue-400 shadow-[0_0_8px_#3b82f6] animate-bounce" />
              )}
            </div>
          </div>

          {/* Status Overlay Badge */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between bg-black/70 backdrop-blur-sm px-3 py-2 rounded-lg text-xs text-white">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span>{isThai ? 'โมเดลเปรียบเทียบ: AI ResNet-50 ในแล็บ' : 'Matching AI Model: Local ResNet-50'}</span>
            </span>
            <span className="font-mono font-bold">
              {verificationState === 'scanning'
                ? `${isThai ? 'กำลังสแกน...' : 'Scanning...'} ${matchScore}%`
                : `${matchScore}% ${isThai ? 'ตรงกัน' : 'Match'}`}
            </span>
          </div>
        </div>
      </div>

      {/* Outcome Feedback */}
      {verificationState === 'success' && (
        <div className="relative mt-4 flex w-full scroll-mt-[92px] transform-none items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-800">
            <strong className="text-sm font-semibold block mb-0.5">
              {isThai ? 'ยืนยันตัวตนทางชีวมิติสำเร็จ' : 'Biometric Identity Verified'}
            </strong>
            {isThai
              ? 'การสแกนใบหน้าของคุณตรงกับฐานข้อมูลนักศึกษาของ ICIT ด้วยความมั่นใจ 98.4% เซสชันเครื่องสอบถูกปลดล็อกเรียบร้อยแล้ว'
              : 'Your physical facial scan matches the enrolled ICIT student reference database with 98.4% confidence. Your workstation session is unlocked.'}
          </div>
        </div>
      )}

      {verificationState === 'failed' && (
        <div className="relative mt-4 flex w-full scroll-mt-[92px] transform-none items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs text-red-800 flex-1">
            <strong className="text-sm font-semibold block mb-0.5">
              {isThai ? 'ไม่สามารถยืนยันตัวตนได้' : 'Unable to Verify Identity'}
            </strong>
            {currentStudent?.accountStatus === 'suspended' ? (
              <span>
                {isThai
                  ? 'สถานะบัญชีของคุณถูกระงับสิทธิ์การใช้งาน ระบบถูกจำกัดสิทธิ์ กรุณาติดต่ออาจารย์ผู้คุมสอบประจำห้อง'
                  : 'Your account status is currently Suspended. System access is restricted. Please consult the chief laboratory proctor.'}
              </span>
            ) : (
              <span>
                {isThai
                  ? `คะแนนความมั่นใจ (${matchScore}%) ต่ำกว่าเกณฑ์ที่กำหนดไว้ที่ 85% กรุณาถอดแว่นตาหรือหน้ากาก หันหน้าเข้าหาแสงสว่าง แล้วลองใหม่อีกครั้ง`
                  : `Confidence score (${matchScore}%) was below the strict 85% requirement. Please remove glasses or face coverings, sit facing the main light source, and retry.`}
              </span>
            )}
            {attempts >= 2 && (
              <div className="mt-2 pt-2 border-t border-red-200 font-semibold flex items-center gap-1.5 text-red-700">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>
                  {isThai
                    ? 'สแกนไม่ผ่านหลายครั้ง: กรุณายกมือเพื่อให้อาจารย์ผู้คุมสอบตรวจสอบตัวตนด้วยตนเอง'
                    : 'Repeated failure: Please raise your hand for manual proctor verification.'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-2">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <button
            type="button"
            onClick={() => runVerificationScan(true)}
            className="text-gray-400 hover:text-gray-600 underline text-[11px]"
            title={isThai ? 'จำลองกรณีไม่ผ่านเกณฑ์' : 'Simulate verification mismatch'}
          >
            {isThai ? '[จำลองกรณีสแกนไม่ผ่าน]' : '[Simulate Verification Failure]'}
          </button>
        </div>

        <div className="flex items-center gap-3">
          {verificationState !== 'success' ? (
            <button
              type="button"
              onClick={() => runVerificationScan(false)}
              disabled={verificationState === 'scanning'}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${verificationState === 'scanning' ? 'animate-spin' : ''}`} />
              <span>{isThai ? 'ลองสแกนอีกครั้ง' : 'Retry Verification'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleContinue}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>{isThai ? 'ไปยังข้อมูลการสอบและระเบียบห้องสอบ' : 'Continue to Exam Information'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
