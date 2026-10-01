import React from 'react';
import { useApp } from '../../context/AppContext';

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'neutral' | 'info' | 'purple';
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  children,
  className = '',
  size = 'md'
}) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-medium';

  const variantClasses = {
    default: 'bg-blue-50 text-blue-700 border border-blue-200',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
    danger: 'bg-red-50 text-red-700 border border-red-200',
    neutral: 'bg-gray-100 text-gray-700 border border-gray-200',
    info: 'bg-cyan-50 text-cyan-700 border border-cyan-200',
    purple: 'bg-purple-50 text-purple-700 border border-purple-200',
  }[variant];

  return (
    <span className={`inline-flex items-center gap-1 rounded-full ${sizeClasses} ${variantClasses} ${className}`}>
      {children}
    </span>
  );
};

export const AccountStatusBadge: React.FC<{ status: 'active' | 'suspended' | 'graduated_inactive' }> = ({ status }) => {
  const { language } = useApp();
  const isThai = language === 'th';

  if (status === 'active') {
    return <Badge variant="success">{isThai ? 'สถานะปกติ' : 'Active'}</Badge>;
  }
  if (status === 'suspended') {
    return <Badge variant="danger">{isThai ? 'ถูกระงับสิทธิ์' : 'Suspended'}</Badge>;
  }
  return <Badge variant="neutral">{isThai ? 'พ้นสภาพ / ไม่ใช้งาน' : 'Graduated / Inactive'}</Badge>;
};

export const MachineStatusBadge: React.FC<{ status: 'online' | 'offline' | 'damaged' | 'unavailable' }> = ({ status }) => {
  const { language } = useApp();
  const isThai = language === 'th';

  switch (status) {
    case 'online':
      return (
        <Badge variant="success">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          {isThai ? 'ออนไลน์' : 'Online'}
        </Badge>
      );
    case 'offline':
      return (
        <Badge variant="neutral">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
          {isThai ? 'ออฟไลน์' : 'Offline'}
        </Badge>
      );
    case 'damaged':
      return (
        <Badge variant="danger">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
          {isThai ? 'ชำรุด' : 'Damaged'}
        </Badge>
      );
    case 'unavailable':
      return (
        <Badge variant="warning">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          {isThai ? 'ไม่พร้อมใช้งาน' : 'Unavailable'}
        </Badge>
      );
  }
};

export const ExamSubmissionStatusBadge: React.FC<{ status: 'submitted' | 'in_progress' | 'working' | 'late' | 'violation' | 'offline' | 'not_started' | 'reopened' }> = ({ status }) => {
  const { language } = useApp();
  const isThai = language === 'th';

  switch (status) {
    case 'submitted':
      return <Badge variant="success">{isThai ? 'ส่งข้อสอบแล้ว' : 'Submitted'}</Badge>;
    case 'working':
      return <Badge variant="default">{isThai ? 'กำลังทำข้อสอบ' : 'Working'}</Badge>;
    case 'in_progress':
      return <Badge variant="default">{isThai ? 'กำลังดำเนินการ' : 'In Progress'}</Badge>;
    case 'late':
      return <Badge variant="warning">{isThai ? 'ส่งล่าช้า' : 'Late Submission'}</Badge>;
    case 'violation':
      return <Badge variant="danger">{isThai ? 'พบการทุจริต' : 'Violation Flagged'}</Badge>;
    case 'reopened':
      return <Badge variant="purple">{isThai ? 'เปิดให้ส่งเพิ่ม' : 'Reopened'}</Badge>;
    case 'offline':
      return <Badge variant="neutral">{isThai ? 'ออฟไลน์' : 'Offline'}</Badge>;
    default:
      return <Badge variant="neutral">{isThai ? 'ยังไม่เริ่มสอบ' : 'Not Started'}</Badge>;
  }
};
