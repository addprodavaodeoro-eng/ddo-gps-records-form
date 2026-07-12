export interface User {
  id: number;
  username: string;
  email: string;
  role: 'Super Admin' | 'Admin' | 'Staff';
  mustChangePassword: boolean;
  isApproved: boolean;
}

export interface Locale {
  id: number;
  name: string;
}

export interface FamilyHead {
  id: number;
  fullName: string;
  cellNumber: string;
  localeId: number;
  localeName: string;
  genderRole?: 'MOTHER' | 'FATHER' | null;
  familySize?: number;
  memberCount?: number;
}

export interface Staff {
  id: number;
  staffName: string;
  position: string;
  cellphoneNumber: string;
  assignedLocaleId: number;
  assignedLocaleName: string;
  status: 'Active' | 'Inactive';
}

export interface Member {
  id: number;
  fullName: string;
  cellphoneNumber: string;
  localeId: number;
  localeName: string;
  familyHeadId: number | null;
  familyHeadName?: string;
  latitude: number;
  longitude: number;
  address?: string;
  riskLevel: 'Low Risk' | 'Medium Risk' | 'High Risk';
  submittedAt: string;
}

export interface ActivityLog {
  id: number;
  userId: number | null;
  username?: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface DbNotification {
  id: number;
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  status: 'read' | 'unread';
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
