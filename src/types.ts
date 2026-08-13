export type View = 'home' | 'applications' | 'documents' | 'calendar' | 'career' | 'jobs' | 'interviews';

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
  company: string;
  role: string;
  deadline: string;
  url: string;
  description: string;
  skills: string[];
  createdAt?: string;
}

export interface Application {
  id: string;
  jobId: string;
  status: string;
  next: string;
  memo?: string;
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
  tasks: TaskItem[];
  docs: SupportDocument[];
  interviews: Interview[];
  attachments: Attachment[];
  careerVaultVersion: number;
  careerSources: CareerSource[];
  careerFacts: CareerFact[];
}

export interface ApplicationPayload {
  company: string;
  role: string;
  status: string;
  deadline: string;
  next: string;
  url: string;
  memo: string;
  jobId?: string;
}
