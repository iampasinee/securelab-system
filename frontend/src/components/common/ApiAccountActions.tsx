import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/apiClient';
import type { ApiUser } from '../../types/api';
import { Modal } from './Modal';

export const ApiAccountActions: React.FC = () => {
  const { role, students, teachers, admins, showToast, setRole } = useApp();
  const [open, setOpen] = useState<'password' | 'links' | null>(null);
  const [userId, setUserId] = useState('');
  const [link, setLink] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const close = () => { setOpen(null); setLink(''); setCurrentPassword(''); setNewPassword(''); setConfirmation(''); setError(''); };
  const logoutAll = async () => {
    setBusy(true);
    try {
      await api.request('/auth/logout-all', { method: 'POST' });
      setRole(null);
      showToast('ออกจากระบบทุกอุปกรณ์แล้ว');
    } catch (failure) {
      showToast('ออกจากระบบไม่สำเร็จ', failure instanceof Error ? failure.message : 'กรุณาลองอีกครั้ง', 'error');
    } finally { setBusy(false); }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (open === 'links') {
        const user = await api.request<ApiUser>(`/users/${userId}`);
        const response = await api.request<{ link: string }>(`/users/${userId}/account-links`, { method: 'POST', body: { purpose: user.activatedAt ? 'reset_password' : 'activate' } });
        setLink(response.link);
      } else {
        if (newPassword !== confirmation) throw new Error('รหัสผ่านและการยืนยันไม่ตรงกัน');
        await api.request('/auth/password/change', { method: 'POST', body: { currentPassword, newPassword } });
        close(); setRole(null); showToast('เปลี่ยนรหัสผ่านแล้ว', 'กรุณาเข้าสู่ระบบใหม่', 'success');
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'ดำเนินการไม่สำเร็จ'); }
    finally { setBusy(false); }
  };
  return <>
    <div className="flex flex-wrap justify-end gap-3 border-b bg-white px-5 py-2 text-sm">
      {role === 'admin' && <button onClick={() => { close(); setOpen('links'); }} className="text-blue-700">ออกลิงก์ตั้งรหัสผ่าน</button>}
      <button onClick={() => { close(); setOpen('password'); }} className="text-gray-700">เปลี่ยนรหัสผ่าน</button>
      <button disabled={busy} onClick={() => { void logoutAll(); }} className="text-gray-700 disabled:opacity-50">ออกจากระบบทุกอุปกรณ์</button>
    </div>
    <Modal isOpen={Boolean(open)} onClose={close} title={open === 'links' ? 'ออกลิงก์ตั้งรหัสผ่าน' : 'เปลี่ยนรหัสผ่าน'}>
      <form onSubmit={submit} className="space-y-4">
        {open === 'links' ? <><label className="block text-sm">บัญชี<select required value={userId} onChange={(event) => { setUserId(event.target.value); setLink(''); }} className="mt-2 w-full rounded-lg border p-2"><option value="">เลือกบัญชี</option>{[...students, ...teachers, ...admins].map((user) => <option key={user.id} value={user.id}>{user.fullName} — {user.email}</option>)}</select></label>
          {link && <div className="space-y-2 rounded-xl bg-blue-50 p-3"><p className="text-sm">ลิงก์ใช้ได้ครั้งเดียว ภายใน 24 ชั่วโมง การออกลิงก์ใหม่จะยกเลิกลิงก์เดิม</p><input readOnly aria-label="ลิงก์ตั้งรหัสผ่าน" value={link} className="w-full rounded-lg border bg-white p-2 text-xs" /><button type="button" onClick={() => { void navigator.clipboard.writeText(link).then(() => showToast('คัดลอกลิงก์แล้ว')); }} className="text-sm text-blue-700">คัดลอกลิงก์</button></div>}</>
          : <>{[['รหัสผ่านปัจจุบัน', currentPassword, setCurrentPassword], ['รหัสผ่านใหม่', newPassword, setNewPassword], ['ยืนยันรหัสผ่านใหม่', confirmation, setConfirmation]].map(([label, value, setter], index) => <label key={index} className="block text-sm">{label as string}<input required type="password" maxLength={128} autoComplete={index === 0 ? 'current-password' : 'new-password'} value={value as string} onChange={(event) => (setter as (value: string) => void)(event.target.value)} className="mt-2 w-full rounded-lg border p-2" /></label>)}<p className="text-xs text-gray-500">อย่างน้อย 8 ตัวอักษร มีตัวอักษรอังกฤษและตัวเลข ไม่มีช่องว่างต้นหรือท้าย</p></>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{busy ? 'กำลังดำเนินการ…' : open === 'links' ? 'ออกลิงก์' : 'ยืนยันเปลี่ยนรหัสผ่าน'}</button>
      </form>
    </Modal>
  </>;
};
