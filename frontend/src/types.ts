export type Source = 'jira' | 'gmail' | 'calendar' | 'slack' | 'paste';
export type Status = 'todo' | 'inprogress' | 'waiting' | 'done';
export type Priority = 'high' | 'medium' | 'low';

export interface Task {
  id: string;
  title: string;
  description?: string;
  source: Source;
  status: Status;
  priority?: Priority;
  dueDate?: string;
  url?: string;
  sourceId: string;
  ticketKey?: string;
  epicKey?: string;
  epicName?: string;
  updatedAt: string;
}

export interface Config {
  jiraUrl?: string;
  jiraEmail?: string;
  jiraToken?: string;
  jiraJql?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  googleAccessToken?: string;
  googleRefreshToken?: string;
  slackToken?: string;
  anthropicKey?: string;
  anthropicBaseUrl?: string;
  // Status flags returned by the API
  jiraConfigured?: boolean;
  googleConfigured?: boolean;
  slackConfigured?: boolean;
  anthropicConfigured?: boolean;
}

export interface SyncResult {
  tasks: Task[];
  errors: Array<{ source: string; error: string }>;
}
