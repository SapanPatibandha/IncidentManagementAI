export interface Incident {
  id: string;
  title: string;
  description: string;
  status: 'Open' | 'In-Process' | 'Closed';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  creatorId: string;
  assigneeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  role: 'Incident Creator' | 'Issue Responder' | 'Administrator';
  createdAt: Date;
}

export interface Comment {
  id: string;
  incidentId: string;
  authorId: string;
  content: string;
  createdAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

export interface Analytics {
  id: string;
  metric: string;
  value: number;
  timestamp: Date;
}