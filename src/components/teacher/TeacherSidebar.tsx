import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  Activity,
  FolderArchive,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

interface TeacherSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const TeacherSidebar: React.FC<TeacherSidebarProps> = ({
  collapsed,
  onToggle,
  mobileOpen = false,
  onMobileClose,
}) => {
  const { activeTeacherRoute, setActiveTeacherRoute, violations, language } = useApp();
  const isThai = language === 'th';

  const activeViolationsCount = violations.filter((v) => !v.acknowledged).length;

  const menuItems = [
    { id: 'T1', label: 'แดชบอร์ด', icon: LayoutDashboard, routes: ['T1'] },
    { id: 'T3', label: 'จัดการรายวิชา & กลุ่มเรียน', icon: BookOpen, routes: ['T3'] },
    { id: 'T2', label: 'จัดการสอบ', icon: ClipboardList, routes: ['T2', 'T4'] },
    {
      id: 'T5',
      label: 'ติดตามการสอบ',
      icon: Activity,
      routes: ['T5', 'T6'],
      badge: activeViolationsCount > 0 ? activeViolationsCount : undefined,
    },
    { id: 'T7', label: 'คลังไฟล์คำตอบ', icon: FolderArchive, routes: ['T7', 'T8'] },
  ];

  const navigate = (route: string) => {
    setActiveTeacherRoute(route);
    onMobileClose?.();
  };

  return (
    <>
      {mobileOpen && <button type="button" onClick={onMobileClose} className="fixed inset-0 top-16 z-30 bg-slate-950/30 md:hidden" aria-label="ปิดเมนูอาจารย์" />}
      <aside
        className={`fixed inset-y-0 left-0 top-16 z-40 flex w-64 shrink-0 transform flex-col justify-between overflow-hidden border-r border-gray-200 bg-white transition-[transform,width] duration-200 md:relative md:inset-auto md:z-20 md:h-full md:min-h-0 md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'md:w-18' : 'md:w-64'}`}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-4">
          {/* Module Title */}
          <div className={`px-4 mb-4 flex items-center justify-between ${collapsed ? 'md:justify-center' : ''}`}>
            <span className={`text-[11px] font-bold uppercase tracking-wider text-gray-400 ${collapsed ? 'md:hidden' : ''}`}>
              {isThai ? 'พอร์ทัลอาจารย์ผู้สอน' : 'Instructor Portal'}
            </span>
            <button
              type="button"
              onClick={onToggle}
              className="hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer md:block"
              title={collapsed ? (isThai ? 'ขยายแถบเมนู' : 'Expand Sidebar') : (isThai ? 'ย่อแถบเมนู' : 'Collapse Sidebar')}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Nav Items */}
          <nav className="space-y-1 px-2.5" aria-label="เมนูอาจารย์ผู้สอน">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.routes.includes(activeTeacherRoute);

            return (
              <button
                type="button"
                key={item.id}
                onClick={() => navigate(item.id)}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all relative cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                } ${collapsed ? 'md:justify-center' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                <span className={`truncate ${collapsed ? 'md:hidden' : ''}`}>{item.label}</span>

                {/* Badge if violations or notices */}
                {item.badge && (
                  <span className={`ml-auto bg-red-600 text-white rounded-full text-[10px] font-bold px-1.5 py-0.5 ${collapsed ? 'md:hidden' : ''}`}>
                    {item.badge}
                  </span>
                )}
                {item.badge && collapsed && (
                  <span className="absolute top-2 right-2 hidden w-2 h-2 rounded-full bg-red-600 md:block" />
                )}
              </button>
            );
          })}
          </nav>
        </div>

        {/* Footer Info */}
        <div className={`p-4 border-t border-gray-100 bg-gray-50/50 m-2 rounded-xl text-[11px] text-gray-500 space-y-1 ${collapsed ? 'md:hidden' : ''}`}>
          <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{isThai ? 'ระบบคุมสอบ ICIT ทำงานปกติ' : 'ICIT Proctor Session Active'}</span>
          </div>
          <div>{isThai ? 'เชื่อมต่อห้องแล็บ 301 แล้ว' : 'Computer Lab 301 Connected'}</div>
        </div>
      </aside>
    </>
  );
};
