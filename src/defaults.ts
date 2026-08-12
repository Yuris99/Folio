import type { Profile, Workspace } from './types';

export const emptyProfile: Profile = {
  name: '', englishName: '', role: '', target: '', summary: '', email: '', phone: '', birthDate: '', location: '', address: '',
  employmentType: '', desiredLocation: '', salary: '', availableDate: '', github: '', portfolio: '', blog: '', linkedin: '',
  education: '', period: '', links: [], skills: [], educations: [], experiences: [], projects: [], certifications: [], languages: [], awards: []
};

export const emptyWorkspace: Workspace = {
  profile: emptyProfile,
  stories: [], jobs: [], applications: [], tasks: [], docs: [], interviews: [], attachments: [],
  careerVaultVersion: 1, careerSources: [], careerFacts: []
};

function array<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export function normalizeProfile(value: Partial<Profile> | undefined): Profile {
  const profile: Profile = {
    ...emptyProfile,
    ...value,
    links: array<string>(value?.links),
    skills: array<string>(value?.skills),
    educations: array(value?.educations),
    experiences: array(value?.experiences),
    projects: array(value?.projects),
    certifications: array(value?.certifications),
    languages: array(value?.languages),
    awards: array(value?.awards)
  };
  if (!profile.github && profile.links[0]) profile.github = profile.links[0];
  if (!profile.portfolio && profile.links[1]) profile.portfolio = profile.links[1];
  (['github', 'portfolio', 'blog', 'linkedin'] as const).forEach((key) => {
    if (profile[key] && !/^https?:\/\//i.test(profile[key])) profile[key] = `https://${profile[key]}`;
  });
  if (!profile.educations.length && profile.education) {
    profile.educations = [{ school: profile.education, major: '', degree: '', status: '', startDate: '', endDate: '', gpa: '', description: profile.period }];
  }
  return profile;
}

export function normalizeWorkspace(value: Partial<Workspace> | undefined): Workspace {
  return {
    profile: normalizeProfile(value?.profile),
    stories: array(value?.stories),
    jobs: array(value?.jobs),
    applications: array(value?.applications),
    tasks: array(value?.tasks),
    docs: array(value?.docs),
    interviews: array(value?.interviews),
    attachments: array(value?.attachments),
    careerVaultVersion: Number(value?.careerVaultVersion || 1),
    careerSources: array(value?.careerSources),
    careerFacts: array(value?.careerFacts)
  };
}
