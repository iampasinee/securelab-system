import React, { useEffect, useState } from 'react';
import { api } from '../../services/apiClient';
import type { CheatDetectionRules } from '../../types';
import { useApp } from '../../context/AppContext';

interface Settings extends CheatDetectionRules { rowVersion: number; allowedDomains: string[] }
const labels: [keyof CheatDetectionRules, string][] = [
  ['multipleFaceDetection', 'ตรวจพบหลายใบหน้า'], ['lookingAwayDetection', 'ตรวจการมองออกจากจอ'],
  ['windowSwitchDetection', 'ตรวจการสลับหน้าต่าง'], ['urlWhitelistEnforcement', 'จำกัดเว็บไซต์ตามรายการ'],
];
export const ApiSecuritySettings: React.FC = () => {
  const { apiRefresh } = useApp();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [domains, setDomains] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try { const result = await api.request<Settings>('/admin/security-settings'); setSettings(result); setDomains(result.allowedDomains.join('\n')); setError(''); } catch (failure) { setError(failure.message); }
  };
  useEffect(() => { void load(); }, []);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const { rowVersion, ...values } = settings!;
      const result = await api.request<Settings>('/admin/security-settings', { method: 'PUT', body: {
        ...Object.fromEntries([...labels.map(([key]) => [key, values[key]]), ['lookingAwayThresholdSeconds', values.lookingAwayThresholdSeconds], ['allowedWindowSwitches', values.allowedWindowSwitches]]),
        allowedDomains: domains.split('\n').map((value) => value.trim()).filter(Boolean), expectedVersion: rowVersion,
      } });
      setSettings(result); setDomains(result.allowedDomains.join('\n')); setMessage('บันทึกการตั้งค่าแล้ว'); await apiRefresh?.();
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  };
  return <div className="max-w-3xl space-y-5"><h1 className="text-2xl font-bold">ตั้งค่าการตรวจเหตุผิดปกติ</h1><p className="rounded-xl bg-gray-100 p-4 text-sm text-gray-600">MVP เก็บการตั้งค่าเท่านั้น การตรวจใบหน้า Agent และการควบคุมเครือข่ายยังไม่พร้อมใช้งาน การแก้ค่ากลางไม่เปลี่ยนนโยบายของการสอบเดิม</p>{error && <div role="alert" className="text-red-700">{error}<button onClick={load} className="ml-3 underline">โหลดข้อมูลล่าสุด</button></div>}{message && <p role="status" className="text-emerald-700">{message}</p>}{settings && <form onSubmit={save} className="space-y-4 rounded-2xl border bg-white p-6">{labels.map(([key, label]) => <label key={key} className="flex items-center gap-3"><input type="checkbox" checked={Boolean(settings[key])} onChange={(event) => setSettings({ ...settings, [key]: event.target.checked })} />{label}</label>)}<label className="block">เวลามองออกจากจอ (วินาที)<input required type="number" min={1} max={3600} value={settings.lookingAwayThresholdSeconds} onChange={(event) => setSettings({ ...settings, lookingAwayThresholdSeconds: Number(event.target.value) })} className="mt-2 block rounded-lg border p-2" /></label><label className="block">จำนวนครั้งที่อนุญาตให้สลับหน้าต่าง<input required type="number" min={0} value={settings.allowedWindowSwitches} onChange={(event) => setSettings({ ...settings, allowedWindowSwitches: Number(event.target.value) })} className="mt-2 block rounded-lg border p-2" /></label><label className="block">โดเมนที่อนุญาต (หนึ่งรายการต่อบรรทัด)<textarea value={domains} onChange={(event) => setDomains(event.target.value)} className="mt-2 w-full rounded-lg border p-3" rows={5} /></label><button disabled={busy} className="rounded-xl bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{busy ? 'กำลังบันทึก…' : 'บันทึกการตั้งค่า'}</button></form>}</div>;
};
