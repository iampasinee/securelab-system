import { dataSource } from './dataSource';
let owner: string | null = null;
export const setExamDraftOwner = (value: string | null) => { owner = value; };
export const getExamDraftStorageKey = (mockKey: string) => {
  if (dataSource === 'mock') return mockKey;
  if (!owner) throw new Error('กรุณาเข้าสู่ระบบก่อนใช้งานร่างการสอบ');
  return `securelab_api_teacher_exam_drafts_v1:${owner}`;
};
