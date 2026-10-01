import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard,
  Network,
  Users,
  Monitor,
  ScanFace,
  ShieldAlert,
  ScrollText,
  UserRound,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Shield,
  GraduationCap,
  BriefcaseBusiness,
  ShieldCheck,
  BookOpen,
} from 'lucide-react';
import { isUserManagementRoute } from '../../utils/adminRoutes';

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ collapsed, onToggle, mobileOpen = false, onMobileClose }) => {
  const { activeAdminRoute, setActiveAdminRoute, violations, language } = useApp();
  const isThai = language === 'th';
  const usersRouteActive = isUserManagementRoute(activeAdminRoute);
  const [usersExpanded, setUsersExpanded] = useState(usersRouteActive);

  useEffect(() => {
    if (usersRouteActive) setUsersExpanded(true);
  }, [activeAdminRoute, usersRouteActive]);

  const unacknowledgedViolations = violations.filter((violation) => !violation.acknowledged).length;
  const userSubItems = [
    { id: 'A2_STUDENTS', label: 'นักศึกษา', icon: GraduationCap },
    { id: 'A2_TEACHERS', label: 'อาจารย์', icon: BriefcaseBusiness },
    { id: 'A2_ADMINS', label: 'ผู้ดูแลระบบ', icon: ShieldCheck },
  ];
  const menuItems = [
    { id: 'ACADEMIC', label: 'จัดการคณะและกลุ่มเรียน', icon: Network },
    { id: 'COURSES', label: 'จัดการรายวิชาและตอนเรียน', icon: BookOpen },
    { id: 'A4', label: 'ห้องสอบและเครื่องคอมพิวเตอร์', icon: Monitor },
    { id: 'A6', label: 'จัดการข้อมูลใบหน้าอ้างอิง', icon: ScanFace },
    {
      id: 'A8',
      label: 'ความปลอดภัยและการตรวจจับ',
      icon: ShieldAlert,
      badge: unacknowledgedViolations || undefined,
    },
    { id: 'A10', label: 'บันทึกประวัติระบบ', icon: ScrollText },
    { id: 'A12', label: 'ข้อมูลผู้ดูแลระบบ', icon: UserRound },
  ];

  const navigate = (route: string) => {
    setActiveAdminRoute(route);
    onMobileClose?.();
  };

  const isMenuItemActive = (route: string) =>
    activeAdminRoute === route ||
    (route === 'A4' && activeAdminRoute === 'A5') ||
    (route === 'A6' && activeAdminRoute === 'A7') ||
    (route === 'A8' && activeAdminRoute === 'A9') ||
    (route === 'A10' && activeAdminRoute === 'A11');

  const activeClasses = 'bg-blue-50 text-blue-700';
  const inactiveClasses = 'text-gray-600 hover:bg-gray-100 hover:text-gray-900';

  return (
    <>
      {mobileOpen && <button type="button" onClick={onMobileClose} className="fixed inset-0 top-16 z-30 bg-slate-950/30 md:hidden" aria-label="ปิดเมนูผู้ดูแลระบบ" />}
    <aside
      className={`fixed inset-y-0 left-0 top-16 z-40 flex w-60 shrink-0 transform flex-col overflow-hidden border-r border-gray-200 bg-white text-gray-700 transition-[transform,width] duration-200 md:relative md:inset-auto md:z-20 md:h-full md:min-h-0 md:translate-x-0 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      } ${
        collapsed ? 'md:w-18' : 'md:w-60'
      }`}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-4">
        <div className={`mb-4 flex items-center justify-between px-4 ${collapsed ? 'md:justify-center' : ''}`}>
          <span className={`text-[11px] font-bold uppercase tracking-wider text-gray-400 ${collapsed ? 'md:hidden' : ''}`}>
            {isThai ? 'การจัดการระบบส่วนกลาง' : 'System Administration'}
          </span>
          <button
            type="button"
            onClick={onToggle}
            className="hidden cursor-pointer rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 md:block"
            title={collapsed ? (isThai ? 'ขยายแถบข้าง' : 'Expand Sidebar') : isThai ? 'ย่อแถบข้าง' : 'Collapse Sidebar'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className="space-y-1 px-2.5" aria-label={isThai ? 'เมนูผู้ดูแลระบบ' : 'Admin navigation'}>
          <button
            type="button"
            onClick={() => navigate('A1')}
            aria-current={isMenuItemActive('A1') ? 'page' : undefined}
            className={`relative flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors ${
              isMenuItemActive('A1') ? activeClasses : inactiveClasses
            } ${collapsed ? 'md:justify-center' : ''}`}
            title={collapsed ? 'แดชบอร์ด' : undefined}
          >
            <LayoutDashboard className={`h-4 w-4 shrink-0 ${isMenuItemActive('A1') ? 'text-blue-600' : 'text-gray-400'}`} />
            <span className={`truncate ${collapsed ? 'md:hidden' : ''}`}>แดชบอร์ด</span>
          </button>

          <div>
            <div className={`flex rounded-xl transition-colors ${usersRouteActive ? activeClasses : 'hover:bg-gray-100'}`}>
              <button
                type="button"
                onClick={() => { navigate('A2'); setUsersExpanded(true); }}
                className={`flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-l-xl px-3 py-2.5 text-xs font-semibold ${
                  usersRouteActive ? 'text-blue-700' : 'text-gray-600 hover:text-gray-900'
                } ${collapsed ? 'md:justify-center md:rounded-r-xl' : ''}`}
                title={collapsed ? 'จัดการผู้ใช้งาน' : undefined}
              >
                <Users className={`h-4 w-4 shrink-0 ${usersRouteActive ? 'text-blue-600' : 'text-gray-400'}`} />
                <span className={`truncate ${collapsed ? 'md:hidden' : ''}`}>จัดการผู้ใช้งาน</span>
              </button>
              <button
                type="button"
                onClick={() => setUsersExpanded((expanded) => !expanded)}
                aria-expanded={usersExpanded}
                aria-controls="admin-user-submenu"
                className={`cursor-pointer rounded-r-xl px-2.5 transition-colors ${collapsed ? 'md:hidden' : ''} ${
                  usersRouteActive ? 'text-blue-600 hover:bg-blue-100' : 'text-gray-400 hover:bg-gray-200 hover:text-gray-700'
                }`}
                title={usersExpanded
                  ? (isThai ? 'ยุบเมนูจัดการผู้ใช้งาน' : 'Collapse user menu')
                  : (isThai ? 'ขยายเมนูจัดการผู้ใช้งาน' : 'Expand user menu')}
              >
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${usersExpanded ? '' : '-rotate-90'}`} />
              </button>
            </div>

            <div
              id="admin-user-submenu"
              className={`grid transition-[grid-template-rows,opacity] duration-200 ${
                usersExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              } ${collapsed ? 'md:grid-rows-[0fr] md:opacity-0' : ''}`}
            >
              <div className="overflow-hidden">
                <div className="mt-1 space-y-0.5 pl-5">
                  {userSubItems.map((item) => {
                    const isActive = activeAdminRoute === item.id;
                    const SubIcon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigate(item.id)}
                        aria-current={isActive ? 'page' : undefined}
                        className={`flex w-full cursor-pointer items-center gap-2 rounded-lg border-l-2 px-3 py-2 text-[11px] font-medium transition-colors ${
                          isActive ? `${activeClasses} border-blue-600` : `${inactiveClasses} border-transparent`
                        }`}
                      >
                        <SubIcon className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} strokeWidth={1.75} />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = isMenuItemActive(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors ${
                  isActive ? activeClasses : inactiveClasses
                } ${collapsed ? 'md:justify-center' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                <span className={`truncate ${collapsed ? 'md:hidden' : ''}`}>{item.label}</span>
                {item.badge && (
                  <span className={`ml-auto rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white ${collapsed ? 'md:hidden' : ''}`}>
                    {item.badge}
                  </span>
                )}
                {item.badge && collapsed && <span className="absolute top-2 right-2 hidden h-2 w-2 rounded-full bg-red-600 md:block" />}
              </button>
            );
          })}
        </nav>
      </div>

      <div className={`m-3 shrink-0 space-y-1 rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-[11px] text-gray-600 ${collapsed ? 'md:hidden' : ''}`}>
          <div className="flex items-center gap-1.5 font-semibold text-blue-700">
            <Shield className="h-3.5 w-3.5 text-blue-600" />
            <span>สิทธิ์ผู้ดูแลระบบสูงสุด • Root</span>
          </div>
          <div>{isThai ? 'เครือข่าย ICIT คลัสเตอร์ 1 กำลังทำงาน' : 'ICIT Network Cluster 1 Active'}</div>
      </div>
    </aside>
    </>
  );
};
