export type UserRole = "admin" | "teacher" | "student";
export type TeachingRole = "LECTURER" | "LAB_TEACHER" | "TD_TEACHER" | "ASSISTANT";
export type QuestionType = "MCQ" | "SCQ" | "True/False" | "Descriptive";
export type AssessmentStatus = "Draft" | "Scheduled" | "Active" | "Closed" | "Published";
export type SubmissionStatus = "Not Started" | "In Progress" | "Submitted" | "Graded";

export interface AssessmentResultsVisibility {
  showFinalScore: boolean;
  showScoreBreakdown: boolean;
  showTeacherFeedback: boolean;
  showAiKeywordAnalysis: boolean;
  showPerQuestionDetails: boolean;
  // Backward compatibility keys used in existing pages.
  showScore?: boolean;
  showQuestionBreakdown?: boolean;
  showKeywordAnalysis?: boolean;
}

export interface User {
  id: string | number;
  firstName?: string;
  lastName?: string;
  email: string;
  name: string;
  role: UserRole;
  status: "active" | "inactive";
  createdAt: string;
}

export interface Module {
  id: string | number;
  code: string;
  name: string;
  description?: string;
  topics: Topic[];
}

export interface Topic {
  id: string | number;
  name: string;
  moduleId: string | number;
}

export interface TeacherAssignment {
  id: string | number;
  teacherId: string | number;
  moduleId: string | number;
  teachingRole: TeachingRole;
}

export interface StudentEnrollment {
  id: string | number;
  studentId: string | number;
  moduleId: string | number;
  group?: string;
  studentName?: string;
  studentEmail?: string;
}

export interface Keyword {
  text: string;
  weight: number;
  synonyms?: string[];
}

export interface Question {
  id: string;
  moduleId: string;
  topicId: string;
  type: QuestionType;
  text: string;
  points: number;
  options?: string[];
  correctAnswer?: string | string[];
  referenceAnswer?: string;
  keywords?: Keyword[];
  createdBy: string;
  createdAt: string;
}

export interface Assessment {
  id: string;
  title: string;
  moduleId: string;
  duration: number; // in minutes
  startTime: string;
  endTime: string;
  status: AssessmentStatus;
  questions: string[]; // question IDs
  randomize: boolean;
  instructions?: string;
  shuffleAnswers?: boolean;
  autoSubmitOnTimeout?: boolean;
  tabSwitchWarning?: boolean;
  resultsVisibility?: AssessmentResultsVisibility;
  createdBy: string;
  createdAt: string;
}

export interface Answer {
  questionId: string;
  answer: string | string[];
  detectedKeywords?: string[];
  missingKeywords?: string[];
  autoScore?: number;
}

export interface Submission {
  id: string;
  assessmentId: string;
  studentId: string;
  answers: Answer[];
  status: SubmissionStatus;
  score?: number;
  maxScore: number;
  submittedAt?: string;
  gradedAt?: string;
  feedback?: string;
}
