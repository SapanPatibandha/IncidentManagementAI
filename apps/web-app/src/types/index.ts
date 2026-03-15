export type IncidentStatus = 'Open' | 'In-Process' | 'Closed';
export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';

export interface Incident {
  id: string;
  title: string;
  description: string;
  status: IncidentStatus;
  priority: Priority;
  creatorId: string;
  assigneeId?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export interface Comment {
  id: string;
  incidentId: string;
  content: string;
  authorId: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  role: 'Incident Creator' | 'Issue Responder' | 'Administrator';
  name?: string;
}