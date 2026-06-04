export type Source = 'jira' | 'gmail' | 'calendar' | 'slack' | 'paste' | 'github';
export type Status = 'todo' | 'inprogress' | 'waiting' | 'done' | 'wontdo';
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
  fixVersion?: string;
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
  slackWorkspaceUrl?: string;
  slackTeamId?: string;
  slackChannelMap?: Record<string, string>;
  anthropicKey?: string;
  anthropicBaseUrl?: string;
  githubToken?: string;
  githubBaseUrl?: string;
  githubConfigured?: boolean;
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
