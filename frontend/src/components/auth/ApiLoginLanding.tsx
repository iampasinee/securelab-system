import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/apiClient';
import { SecureLabBrandHeader } from '../common/SecureLabBrandHeader';

export const ApiLoginLanding: React.FC = () => {
  const { apiLogin, apiLoading, apiError } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [link] = useState(() => {
    const match = window.location.hash.match(/^#\/(activate|reset_password)\?token=([^&]+)$/);
    if (!match) return null;
    return { purpose: match[1], token: decodeURIComponent(match[2]) };
  });
  const [summary, setSummary] = useState<{ email: string; fullName: string } | null>(null);
  useEffect(() => {
    if (!link) return;
    // Initializers stay pure under StrictMode. The secret then lives in memory only.
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    let current = true;
    api.request<{ email: string; fullName: string }>('/auth/activation/inspect', { method: 'POST', public: true, body: { token: link.token } })
      .then((result) => { if (current) setSummary(result); }).catch((failure) => { if (current) setError(failure.message); });
    return () => { current = false; };
  }, [link]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(''); setBusy(true);
    try {
      if (link && !completed) {
        if (password !== confirmation) throw new Error('รหัสผ่านและการยืนยันไม่ตรงกัน');
        await api.request(link.purpose === 'activate' ? '/auth/activation/complete' : '/auth/password-reset/complete', {
          method: 'POST', public: true, body: { token: link.token, newPassword: password },
        });
        setCompleted(true); setEmail(summary?.email || ''); setPassword(''); setConfirmation('');
      } else {
        await apiLogin?.(email.trim(), password);
        setPassword('');
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'ดำเนินการไม่สำเร็จ'); }
    finally { setBusy(false); }
  };
  const activating = Boolean(link && !completed);
  return <div className="min-h-screen bg-gray-50">
    <SecureLabBrandHeader />
    <main className="mx-auto max-w-md px-5 py-16">
      <form onSubmit={submit} className="space-y-5 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">{activating ? 'ตั้งรหัสผ่าน SecureLab' : 'เข้าสู่ระบบ SecureLab'}</h1>
        <p className="text-sm text-gray-600">{activating ? `${summary?.fullName || 'กำลังตรวจสอบลิงก์'} ${summary?.email || ''}` : 'ใช้บัญชีมหาวิทยาลัยที่ผู้ดูแลระบบจัดเตรียมให้'}</p>
        {completed && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">ตั้งรหัสผ่านแล้ว สามารถเข้าสู่ระบบได้</p>}
        {!activating && <label className="block text-sm font-medium">อีเมลมหาวิทยาลัย<input name="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2.5" /></label>}
        <label className="block text-sm font-medium">{activating ? 'รหัสผ่านใหม่' : 'รหัสผ่าน'}<input name="password" type="password" autoComplete={activating ? 'new-password' : 'current-password'} required maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2.5" /></label>
        {activating && <><p className="text-xs text-gray-500">อย่างน้อย 8 ตัวอักษร มีตัวอักษรอังกฤษและตัวเลข ไม่มีช่องว่างต้นหรือท้าย</p><label className="block text-sm font-medium">ยืนยันรหัสผ่าน<input name="confirmation" type="password" autoComplete="new-password" required maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2.5" /></label></>}
        {(error || apiError) && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error || apiError}</p>}
        <button type="submit" disabled={busy || apiLoading || (activating && !summary)} className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white disabled:opacity-50">{busy || apiLoading ? 'กำลังดำเนินการ…' : activating ? 'ยืนยันตั้งรหัสผ่าน' : 'เข้าสู่ระบบ'}</button>
        {!activating && <p className="text-xs text-gray-500">หากยังไม่มีบัญชีหรือลืมรหัสผ่าน ให้ติดต่อผู้ดูแลระบบเพื่อขอลิงก์ตั้งรหัสผ่าน</p>}
      </form>
    </main>
  </div>;
};
