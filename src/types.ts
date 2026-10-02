export type View = 'home' | 'applications' | 'documents' | 'vault' | 'calendar' | 'career' | 'imports' | 'consultations' | 'jobs' | 'recommendations' | 'interviews' | 'stats';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface Education {
  id?: string;
  school: string;
  major: string;
  degree: string;
  status: string;
  startDate: string;
  endDate: string;
  gpa: string;
  majorGpa?: string;
  gpaScale?: string;
  courses?: Array<{ name: string; category: string; credits: string; grade: string }>;
  attachmentIds?: string[];
  verified?: boolean;
  description: string;
}

export interface Experience {
  id?: string;
  company: string;
  department: string;
  position: string;
  employmentType: string;
  startDate: string;
  endDate: string;
  description: string;
  achievements: string;
  attachmentIds?: string[];
  verified?: boolean;
}

export interface Project {
  id?: string;
  name: string;
  organization: string;
  role: string;
  tech: string;
  startDate: string;
  endDate: string;
  url: string;
  description: string;
  achievements: string;
  attachmentIds?: string[];
  verified?: boolean;
}

export interface Certification {
  id?: string;
  name: string;
  issuer: string;
  acquiredDate: string;
  credentialId: string;
  attachmentIds?: string[];
  verified?: boolean;
}

export interface Language {
  id?: string;
  name: string;
  level: string;
  score: string;
  acquiredDate: string;
  attachmentIds?: string[];
  verified?: boolean;
}

export interface Award {
  id?: string;
  name: string;
  issuer: string;
  date: string;
  description: string;
  attachmentIds?: string[];
  verified?: boolean;
}

export interface Activity {
  id?: string; name: string; organization: string; role: string; startDate: string; endDate: string;
  description: string; achievements: string; skills: string[]; attachmentIds?: string[]; verified?: boolean;
}

export interface MilitaryService {
  id?: string; branch: string; rank: string; role: string; startDate: string; endDate: string;
  dischargeType: string; description: string; attachmentIds?: string[]; verified?: boolean;
}

export interface Profile {
  name: string;
  englishName: string;
  role: string;
  target: string;
  summary: string;
  email: string;
  phone: string;
  birthDate: string;
  location: string;
  address: string;
  employmentType: string;
  desiredLocation: string;
  salary: string;
  availableDate: string;
  github: string;
  portfolio: string;
  blog: string;
  linkedin: string;
  education: string;
  period: string;
  links: string[];
  skills: string[];
  educations: Education[];
  experiences: Experience[];
  projects: Project[];
  certifications: Certification[];
  languages: Language[];
  awards: Award[];
  activities: Activity[];
  militaryServices: MilitaryService[];
}

export interface CareerStory {
  id: string;
  title: string;
  role: string;
  skills: string[];
  summary: string;
  createdAt?: string;
}

export interface Job {
  id: string;
  discoveryPostingId?: string;
  company: string;
  role: string;
  location?: string;
  deadline: string;
  alwaysOpen?: boolean;
  url: string;
  notionUrl?: string;
  description: string;
  skills: string[];
  pageContent?: string;
  pageHtml?: string;
  coverImage?: string;
  pages?: JobSubpage[];
  attachmentIds?: string[];
  companyAnalysis?: {
    overview: string; products: string[]; industry: string; culture: string[]; recentTopics: string[];
    roleResponsibilities: string[]; requirements: string[]; preferred: string[]; fitEvidence: string[];
    gaps: string[]; interviewTopics: string[]; sources: Array<{ title: string; url: string }>;
    analyzedAt?: string;
  };
  createdAt?: string;
}

export interface JobSubpage {
  id: string;
  title: string;
  content: string;
  html?: string;
  coverImage?: string;
  attachmentIds?: string[];
  children: JobSubpage[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ApplicationProcessStep {
  id: string;
  name: string;
  date: string;
  status: '예정' | '진행 중' | '완료' | '취소';
  dateTbd?: boolean;
  timeTbd?: boolean;
  result?: DocumentResult;
  todos?: ProcessTodo[];
}

export interface ProcessTodo {
  id: string;
  text: string;
  done: boolean;
}

export type DocumentResult = '' | '합격' | '불합격';

export type CareerGrade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface Application {
  id: string;
  jobId: string;
  status: string;
  next: string;
  appliedAt?: string;
  nextProcess?: string;
  nextDate?: string;
  processSteps?: ApplicationProcessStep[];
  memo?: string;
  rejectionReason?: string;
  documentResult?: DocumentResult;
  considering?: boolean;
  pinned?: boolean;
  priority?: '높음' | '보통' | '낮음';
  careerGrade?: CareerGrade;
  // 우선순위 5단계 입력 (1~5, 비우면 보통으로 계산)
  careerLevel?: number;
  compensationLevel?: number;
  passLevel?: number;
  workLevel?: number;
  // 예전 숫자 점수. 새 5단계 값이 없을 때만 옮겨서 씁니다.
  applicationFitScore?: number;
  compensationScore?: number;
  companyScore?: number;
  locationScore?: number;
  processScore?: number;
  priorityAdjustment?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskItem {
  id: string;
  text: string;
  date: string;
  done: boolean;
  createdAt?: string;
}

export interface Interview {
  id: string;
  company: string;
  role: string;
  date: string;
  type: string;
  memo?: string;
  prepared?: number;
  createdAt?: string;
}

export interface SupportDocument {
  id: string;
  title: string;
  jobId?: string;
  content: string;
  citations?: Array<{ sentence: number; careerStoryId: string }>;
  warnings?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt?: string;
}

export type ConsultationType = 'career-coaching' | 'company' | 'mentoring' | 'mock-interview' | 'qna' | 'other';
export interface ConsultationQA { question: string; answer: string; topic: string; }
export interface ConsultationRecord {
  id: string; type: ConsultationType; title: string; organization: string; consultant: string; date: string;
  relatedCompany: string; relatedRole: string; summary: string; transcript: string; qna: ConsultationQA[];
  insights: string[]; actionItems: string[]; tags: string[]; attachmentIds: string[];
  createdAt?: string; updatedAt?: string;
}

export type CareerSourceType = 'resume' | 'portfolio' | 'career-note';
export type CareerSourceStatus = 'ready' | 'review' | 'complete' | 'needs-text';
export type CareerFactStatus = 'review' | 'verified' | 'excluded';
export type CareerFactCategory = 'profile' | 'education' | 'experience' | 'project' | 'skill' | 'certification' | 'language' | 'activity' | 'other';

export interface CareerSource {
  id: string;
  name: string;
  type: CareerSourceType;
  attachmentId?: string;
  rawText?: string;
  status: CareerSourceStatus;
  extractedAt?: string;
  createdAt?: string;
}

export interface CareerFact {
  id: string;
  category: CareerFactCategory;
  title: string;
  organization: string;
  period: string;
  description: string;
  achievements: string;
  skills: string[];
  sourceIds: string[];
  status: CareerFactStatus;
  sensitive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Workspace {
  profile: Profile;
  stories: CareerStory[];
  jobs: Job[];
  applications: Application[];
  archivedApplications: Application[];
  tasks: TaskItem[];
  docs: SupportDocument[];
  interviews: Interview[];
  attachments: Attachment[];
  careerVaultVersion: number;
  careerSources: CareerSource[];
  careerFacts: CareerFact[];
  consultations: ConsultationRecord[];
  vaultNotes: VaultNote[];
  discovery: DiscoveryState;
}

export interface DiscoveryPreferences {
  enabled: boolean;
  keywords: string[];
  excludeKeywords: string[];
  locations: string[];
  experience: 'any' | 'entry' | 'junior';
  sources: Array<'inthiswork' | 'saramin'>;
  intervalHours: number;
}
export interface JobFitAnalysis {
  score: number | null;
  confidence: 'low' | 'medium' | 'high';
  summary: string;
  evidence: Array<{ claim: string; careerFactIds: string[]; jobQuote: string }>;
  gaps: string[];
  questions: string[];
  matchedSkills: string[];
  missingSkills: string[];
  sourceUrls: string[];
  contextVersion: string;
  analyzedAt: string;
  provider: 'chatgpt';
}
export interface DiscoveredJob {
  id: string;
  company: string;
  title: string;
  location: string;
  experience: string;
  deadline: string;
  alwaysOpen: boolean;
  url: string;
  description: string;
  contentQuality: 'full' | 'partial' | 'image';
  sources: Array<{ source: string; externalId: string; url: string }>;
  publishedAt: string;
  discoveredAt: string;
  checkedAt: string;
  hidden: boolean;
  closed: boolean;
  savedJobId?: string;
  suppressed?: boolean;
  matchedKeywords?: string[];
  analysis?: JobFitAnalysis;
  analysisStale?: boolean;
}
export interface DiscoverySourceStatus {
  source: string;
  ok: boolean;
  checkedAt: string;
  fetched: number;
  matched: number;
  truncated: boolean;
  message: string;
}
export interface DiscoveryState {
  preferences: DiscoveryPreferences;
  items: DiscoveredJob[];
  running?: boolean;
  lastRunAt: string;
  lastCompletedAt?: string;
  nextRunAt: string;
  sourceStatus: DiscoverySourceStatus[];
}
export interface DiscoveryStatus extends DiscoveryState {
  sources: Array<{ id: 'inthiswork' | 'saramin'; name: string; ready: boolean; note: string }>;
  mcp: { allowed: boolean; configured: boolean; endpoint: string; connected: boolean; subscriptions: number; pendingDeliveries: number; lastDeliveredAt: string; failures: string[] };
}

export interface VaultNote {
  id: string;
  title: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApplicationPayload {
  company: string;
  role: string;
  location?: string;
  status: string;
  deadline: string;
  alwaysOpen?: boolean;
  next: string;
  appliedAt: string;
  nextProcess: string;
  nextDate: string;
  processSteps: ApplicationProcessStep[];
  considering?: boolean;
  pinned?: boolean;
  priority?: '높음' | '보통' | '낮음';
  careerGrade?: CareerGrade;
  // 우선순위 5단계 입력 (1~5, 비우면 보통으로 계산)
  careerLevel?: number;
  compensationLevel?: number;
  passLevel?: number;
  workLevel?: number;
  // 예전 숫자 점수. 새 5단계 값이 없을 때만 옮겨서 씁니다.
  applicationFitScore?: number;
  compensationScore?: number;
  companyScore?: number;
  locationScore?: number;
  processScore?: number;
  priorityAdjustment?: number;
  url: string;
  notionUrl?: string;
  memo: string;
  rejectionReason?: string;
  documentResult?: DocumentResult;
  jobId?: string;
}
