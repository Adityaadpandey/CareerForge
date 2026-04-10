export type CvData = {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  summary: string;
  skills: {
    languages: string[];
    frameworks: string[];
    tools: string[];
  };
  projects: {
    name: string;
    tech: string[];
    bullets: string[];
  }[];
  education: {
    degree: string;
    institution: string;
    year: string;
  };
};

export type CoverLetterData = {
  name: string;
  email: string;
  phone: string;
  company: string;
  role: string;
  greeting: string;
  paragraphs: string[];
  closing: string;
};
