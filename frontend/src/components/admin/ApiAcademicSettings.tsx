import React, { useEffect, useState } from 'react';
import { api } from '../../services/apiClient';
import { useApp } from '../../context/AppContext';

interface Settings { currentAcademicYear: number; currentSemester: '1' | '2' | 'summer'; rowVersion: number }
export const ApiAcademicSettings: React.FC = () => {
  const { apiRefresh } = useApp();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { void api.request<Settings>('/academic/settings').then(setSettings).catch((failure) => setError(failure.message)); }, []);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!settings) return; setBusy(true); setError('');
    try {
      const result = await api.request<Settings>('/academic/settings', { method: 'PATCH', body: {
        currentAcademicYear: settings.currentAcademicYear, currentSemester: settings.currentSemester, expectedVersion: settings.rowVersion,
      } });
      setSettings(result); await apiRefresh?.();
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  };
  return <section className="mb-5 rounded-2xl border bg-white p-4"><h2 className="mb-3 font-semibold">ปีการศึกษาและภาคเรียนปัจจุบัน</h2>{settings && <form onSubmit={save} className="flex flex-wrap items-end gap-4 text-sm"><label>ปีการศึกษา (พ.ศ.)<input required min={2500} max={32767} type="number" value={settings.currentAcademicYear} onChange={(event) => setSettings({ ...settings, currentAcademicYear: Number(event.target.value) })} className="mt-1 block w-36 rounded-lg border p-2" /></label><label>ภาคเรียน<select value={settings.currentSemester} onChange={(event) => setSettings({ ...settings, currentSemester: event.target.value as Settings['currentSemester'] })} className="mt-1 block rounded-lg border p-2"><option value="1">1</option><option value="2">2</option><option value="summer">ฤดูร้อน</option></select></label><button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{busy ? 'กำลังบันทึก…' : 'บันทึกค่ากลาง'}</button><p className="text-xs text-gray-500">ชั้นปีของนักศึกษาคำนวณจากปีที่เข้าศึกษาโดยอัตโนมัติ</p></form>}{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}</section>;
};
