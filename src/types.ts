export type View = 'home' | 'applications' | 'documents' | 'calendar' | 'career' | 'jobs' | 'interviews';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface Education {
  school: string;
  major: string;
  degree: string;
  status: string;
  startDate: string;
  endDate: string;
  gpa: string;
  description: string;
}

export interface Experience {
  company: string;
  department: string;
  position: string;
  employmentType: string;
  startDate: string;
  endDate: string;
  description: string;
  achievements: string;
}

export interface Project {
  name: string;
  organization: string;
  role: string;
  tech: string;
  startDate: string;
  endDate: string;
  url: string;
  description: string;
  achievements: string;
}

export interface Certification {
  name: string;
  issuer: string;
  acquiredDate: string;
  credentialId: string;
}

export interface Language {
  name: string;
  level: string;
  score: string;
  acquiredDate: string;
}

export interface Award {
  name: string;
  issuer: string;
  date: string;
  description: string;
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

export interface Workspace {
  profile: Profile;
  stories: CareerStory[];
  jobs: Job[];
  applications: Application[];
  tasks: TaskItem[];
  docs: SupportDocument[];
  interviews: Interview[];
  attachments: Attachment[];
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
