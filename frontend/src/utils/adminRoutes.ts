export const adminRouteHashes: Record<string, string> = {
  A1: '#/admin/dashboard',
  A2: '#/admin/users',
  A2_STUDENTS: '#/admin/users/students',
  A2_TEACHERS: '#/admin/users/teachers',
  A2_ADMINS: '#/admin/users/admins',
  ACADEMIC: '#/admin/faculties-and-groups',
  COURSES: '#/admin/courses',
  A4: '#/admin/rooms',
  A5: '#/admin/rooms/devices',
  A6: '#/admin/biometrics',
  A7: '#/admin/biometrics/details',
  A8: '#/admin/security',
  A9: '#/admin/security/incidents',
  A10: '#/admin/audit-log',
  A11: '#/admin/audit-log/details',
  A12: '#/admin/profile',
};

const routeByHash = Object.fromEntries(
  Object.entries(adminRouteHashes).map(([route, hash]) => [hash.toLowerCase(), route]),
);

export const userManagementRoutes = [
  'A2',
  'A2_STUDENTS',
  'A2_TEACHERS',
  'A2_ADMINS',
] as const;

export type UserManagementRoute = (typeof userManagementRoutes)[number];
export type UserManagementView = 'overview' | 'students' | 'teachers' | 'admins';

export const isUserManagementRoute = (route: string): route is UserManagementRoute =>
  userManagementRoutes.includes(route as UserManagementRoute);

export const getAdminRouteFromHash = (hash?: string): string => {
  const currentHash = hash ?? (typeof window !== 'undefined' ? window.location.hash : '');
  return routeByHash[currentHash.toLowerCase()] || 'A1';
};

export const getAdminHashForRoute = (route: string): string =>
  adminRouteHashes[route] || adminRouteHashes.A1;

export const getUserManagementView = (route: string): UserManagementView => {
  if (route === 'A2_STUDENTS') return 'students';
  if (route === 'A2_TEACHERS') return 'teachers';
  if (route === 'A2_ADMINS') return 'admins';
  return 'overview';
};
