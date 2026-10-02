import type { Application, ApplicationPayload, Attachment, CareerFact, CareerSource, CareerStory, ConsultationRecord, DiscoveredJob, DiscoveryPreferences, DiscoverySourceStatus, DiscoveryStatus, Interview, Job, JobFitAnalysis, Profile, SupportDocument, TaskItem, User, VaultNote, Workspace } from './types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const requestTimeoutMs = Number(import.meta.env.VITE_REQUEST_TIMEOUT_MS || 15000);

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, options: RequestInit = {}, timeoutMs = requestTimeoutMs): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      credentials: 'include',
      ...options,
      headers: options.body ? { 'Content-Type': 'application/json', ...options.headers } : options.headers,
      signal: controller.signal
    });
    const body = response.status === 204 ? null : await response.json().catch(() => null) as { data?: T; message?: string } | null;
    if (!response.ok) throw new ApiError(body?.message || '요청을 처리하지 못했습니다.', response.status, body);
    return (body?.data ?? body) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new ApiError('서버 응답 시간이 초과되었습니다.', 408);
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

const json = (method: string, payload?: unknown): RequestInit => ({ method, body: payload === undefined ? undefined : JSON.stringify(payload) });

export const api = {
  loginWithGoogle() {
    const returnTo = encodeURIComponent(window.location.href.split('#')[0]);
    window.location.assign(`${apiBaseUrl}/auth/google?returnTo=${returnTo}`);
  },
  session: () => request<User>('/auth/session'),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  bootstrap: () => request<Workspace>('/bootstrap'),
  discoveryStatus: () => request<DiscoveryStatus>('/discovery/status'),
  updateDiscoveryPreferences: (payload: DiscoveryPreferences) => request<DiscoveryPreferences>('/discovery/preferences', json('PUT', payload)),
  collectJobs: () => request<{ added: number; total: number; sourceStatus: DiscoverySourceStatus[] }>('/discovery/collect', { method: 'POST' }, 180_000),
  addDiscoveredJob: (payload: { company: string; title: string; url: string; description: string; location: string }) => request<DiscoveredJob>('/discovery/postings', json('POST', payload)),
  // Keep the collected identity as a tombstone so the next collection cannot revive it.
  deleteDiscoveredJob: (id: string) => request<DiscoveredJob>(`/discovery/postings/${id}`, json('PATCH', { hidden: true })),
  restoreDiscoveredJob: (id: string) => request<DiscoveredJob>(`/discovery/postings/${id}`, json('PATCH', { hidden: false })),
  saveDiscoveredJob: (id: string) => request<Job>(`/discovery/postings/${id}/save`, { method: 'POST' }),
  jobAnalysisInput: (id: string) => request<Record<string, unknown>>(`/discovery/postings/${id}/analysis-input`),
  saveJobFitAnalysis: (id: string, payload: unknown) => request<JobFitAnalysis>(`/discovery/postings/${id}/analysis`, json('PUT', payload)),
  mcpAuthorization: (id: string) => request<{ clientName: string; scopes: string[]; consentToken: string; expiresAt: string }>(`/mcp/authorization/${id}`),
  approveMcpAuthorization: (id: string, consentToken: string, approve: boolean) => request<{ redirectUrl: string }>(`/mcp/authorization/${id}`, json('POST', { consentToken, approve })),
  disconnectMcp: () => request<DiscoveryStatus['mcp']>('/mcp/disconnect', { method: 'POST' }),
  calendarStatus: () => request<{ connected: boolean; lastSyncedAt: string; configured?: boolean }>('/calendar/status'),
  connectGoogleCalendar() {
    const url = new URL(window.location.href.split('#')[0]);
    url.searchParams.delete('calendar');
    window.location.assign(`${apiBaseUrl}/calendar/connect?returnTo=${encodeURIComponent(url.href)}`);
  },
  syncGoogleCalendar: () => request<{ created: number; updated: number; removed: number; failed: number; skipped: number; total: number; lastSyncedAt: string; failures: string[] }>('/calendar/sync', { method: 'POST' }, 60_000),
  disconnectGoogleCalendar: () => request<void>('/calendar/disconnect', { method: 'POST' }),
  exportUrl: () => `${apiBaseUrl}/account/export`,
  importCareerData: (payload: unknown) => request<{ workspace: Workspace; imported: { profileFields: number; profileItems: number; facts: number; skippedDuplicates: number } }>('/career-import', json('POST', payload)),
  importChatData: (payload: unknown) => request<{ workspace: Workspace; imported: { total: number; skippedDuplicates: number } }>('/chat-import', json('POST', payload)),
  deleteAccount: () => request<void>('/account', { method: 'DELETE' }),
  resetWorkspace: () => request<Workspace>('/workspace/reset', { method: 'POST' }),
  updateProfile: (payload: Profile) => request<Profile>('/profile', json('PUT', payload)),
  createCareerStory: (payload: Omit<CareerStory, 'id'>) => request<CareerStory>('/career-stories', json('POST', payload)),
  createCareerSource: (payload: Omit<CareerSource, 'id' | 'status' | 'createdAt' | 'extractedAt'>) => request<CareerSource>('/career-sources', json('POST', payload)),
  extractCareerSource: (id: string) => request<{ source: CareerSource; facts: CareerFact[] }>(`/career-sources/${id}/extract`, json('POST')),
  deleteCareerSource: (id: string) => request<void>(`/career-sources/${id}`, { method: 'DELETE' }),
  createCareerFact: (payload: Omit<CareerFact, 'id' | 'createdAt' | 'updatedAt'>) => request<CareerFact>('/career-facts', json('POST', payload)),
  updateCareerFact: (id: string, payload: Partial<CareerFact>) => request<CareerFact>(`/career-facts/${id}`, json('PATCH', payload)),
  deleteCareerFact: (id: string) => request<void>(`/career-facts/${id}`, { method: 'DELETE' }),
  createConsultation: (payload: Omit<ConsultationRecord, 'id'>) => request<ConsultationRecord>('/consultations', json('POST', payload)),
  updateConsultation: (id: string, payload: Partial<ConsultationRecord>) => request<ConsultationRecord>(`/consultations/${id}`, json('PUT', payload)),
  deleteConsultation: (id: string) => request<void>(`/consultations/${id}`, { method: 'DELETE' }),
  createVaultNote: (payload: Pick<VaultNote, 'title' | 'content'>) => request<VaultNote>('/vault-notes', json('POST', payload)),
  updateVaultNote: (id: string, payload: Partial<Pick<VaultNote, 'title' | 'content'>>) => request<VaultNote>(`/vault-notes/${id}`, json('PUT', payload)),
  deleteVaultNote: (id: string) => request<void>(`/vault-notes/${id}`, { method: 'DELETE' }),
  createJob: (payload: Omit<Job, 'id'>) => request<Job>('/jobs', json('POST', payload)),
  updateJob: (id: string, payload: Partial<Job>) => request<Job>(`/jobs/${id}`, json('PATCH', payload)),
  analyzeJob: (payload: Pick<Job, 'company' | 'role' | 'deadline' | 'url' | 'description'>) => request<{ skills: string[] }>('/ai/jobs/analyze', json('POST', payload)),
  createApplication: (payload: ApplicationPayload) => request<Application>('/applications', json('POST', payload)),
  updateApplication: (id: string, payload: Partial<ApplicationPayload>) => request<Application>(`/applications/${id}`, json('PATCH', payload)),
  restoreApplication: (id: string) => request<Application>(`/applications/${id}/restore`, { method: 'POST' }),
  deleteApplication: (id: string) => request<void>(`/applications/${id}`, { method: 'DELETE' }),
  createTask: (payload: Omit<TaskItem, 'id'>) => request<TaskItem>('/tasks', json('POST', payload)),
  updateTask: (id: string, payload: Partial<TaskItem>) => request<TaskItem>(`/tasks/${id}`, json('PATCH', payload)),
  createInterview: (payload: Omit<Interview, 'id'>) => request<Interview>('/interviews', json('POST', payload)),
  updateInterview: (id: string, payload: Partial<Interview>) => request<Interview>(`/interviews/${id}`, json('PATCH', payload)),
  deleteInterview: (id: string) => request<void>(`/interviews/${id}`, { method: 'DELETE' }),
  createDocument: (payload: Omit<SupportDocument, 'id'>) => request<SupportDocument>('/documents', json('POST', payload)),
  saveDocument: (id: string, payload: Partial<SupportDocument>) => request<SupportDocument>(`/documents/${id}`, json('PUT', payload)),
  generateDocument: (payload: { jobId: string; documentType: string; careerStoryIds: string[] }) => request<SupportDocument>('/ai/documents/generate', json('POST', payload)),
  uploadFile: (payload: { name: string; type: string; data: string }) => request<Attachment>('/files', json('POST', payload)),
  renameFile: (id: string, name: string) => request<Attachment>(`/files/${id}`, json('PATCH', { name })),
  deleteFile: (id: string) => request<void>(`/files/${id}`, { method: 'DELETE' }),
  fileUrl: (id: string) => `${apiBaseUrl}/files/${id}`
};
