import type { Application, ApplicationPayload, Attachment, CareerFact, CareerSource, CareerStory, ConsultationRecord, Interview, Job, Profile, SupportDocument, TaskItem, User, Workspace } from './types';

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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), requestTimeoutMs);
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
  createJob: (payload: Omit<Job, 'id'>) => request<Job>('/jobs', json('POST', payload)),
  updateJob: (id: string, payload: Partial<Job>) => request<Job>(`/jobs/${id}`, json('PATCH', payload)),
  analyzeJob: (payload: Pick<Job, 'company' | 'role' | 'deadline' | 'url' | 'description'>) => request<{ skills: string[] }>('/ai/jobs/analyze', json('POST', payload)),
  createApplication: (payload: ApplicationPayload) => request<Application>('/applications', json('POST', payload)),
  updateApplication: (id: string, payload: Partial<ApplicationPayload>) => request<Application>(`/applications/${id}`, json('PATCH', payload)),
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
  deleteFile: (id: string) => request<void>(`/files/${id}`, { method: 'DELETE' }),
  fileUrl: (id: string) => `${apiBaseUrl}/files/${id}`
};
