import { 
  User, 
  Module, 
  TeacherAssignment, 
  StudentEnrollment, 
  Question, 
  Assessment, 
  Submission 
} from "./types";

// Users
export const users: User[] = [
  {
    id: "1",
    email: "admin@university.edu",
    name: "Admin User",
    role: "admin",
    status: "active",
    createdAt: "2024-01-15T10:00:00Z",
  },
  {
    id: "2",
    email: "john.doe@university.edu",
    name: "Dr. John Doe",
    role: "teacher",
    status: "active",
    createdAt: "2024-02-01T10:00:00Z",
  },
  {
    id: "3",
    email: "jane.smith@university.edu",
    name: "Prof. Jane Smith",
    role: "teacher",
    status: "active",
    createdAt: "2024-02-01T10:00:00Z",
  },
  {
    id: "4",
    email: "alice.johnson@student.edu",
    name: "Alice Johnson",
    role: "student",
    status: "active",
    createdAt: "2024-09-01T10:00:00Z",
  },
  {
    id: "5",
    email: "bob.williams@student.edu",
    name: "Bob Williams",
    role: "student",
    status: "active",
    createdAt: "2024-09-01T10:00:00Z",
  },
  {
    id: "6",
    email: "carol.davis@student.edu",
    name: "Carol Davis",
    role: "student",
    status: "active",
    createdAt: "2024-09-01T10:00:00Z",
  },
];

// Modules
export const modules: Module[] = [
  {
    id: "m1",
    code: "CS101",
    name: "Introduction to Programming",
    description: "Fundamentals of programming using Python",
    topics: [
      { id: "t1", name: "Variables and Data Types", moduleId: "m1" },
      { id: "t2", name: "Control Structures", moduleId: "m1" },
      { id: "t3", name: "Functions", moduleId: "m1" },
      { id: "t4", name: "Object-Oriented Programming", moduleId: "m1" },
    ],
  },
  {
    id: "m2",
    code: "CS201",
    name: "Data Structures and Algorithms",
    description: "Core data structures and algorithmic techniques",
    topics: [
      { id: "t5", name: "Arrays and Lists", moduleId: "m2" },
      { id: "t6", name: "Trees and Graphs", moduleId: "m2" },
      { id: "t7", name: "Sorting Algorithms", moduleId: "m2" },
      { id: "t8", name: "Dynamic Programming", moduleId: "m2" },
    ],
  },
  {
    id: "m3",
    code: "CS301",
    name: "Database Systems",
    description: "Relational databases and SQL",
    topics: [
      { id: "t9", name: "Relational Model", moduleId: "m3" },
      { id: "t10", name: "SQL Queries", moduleId: "m3" },
      { id: "t11", name: "Normalization", moduleId: "m3" },
      { id: "t12", name: "Transactions", moduleId: "m3" },
    ],
  },
];

// Teacher Assignments
export const teacherAssignments: TeacherAssignment[] = [
  {
    id: "ta1",
    teacherId: "2",
    moduleId: "m1",
    teachingRole: "Lecturer",
  },
  {
    id: "ta2",
    teacherId: "3",
    moduleId: "m1",
    teachingRole: "Lab Instructor",
  },
  {
    id: "ta3",
    teacherId: "2",
    moduleId: "m2",
    teachingRole: "Lecturer",
  },
  {
    id: "ta4",
    teacherId: "3",
    moduleId: "m3",
    teachingRole: "Lecturer",
  },
];

// Student Enrollments
export const studentEnrollments: StudentEnrollment[] = [
  { id: "e1", studentId: "4", moduleId: "m1", group: "A" },
  { id: "e2", studentId: "4", moduleId: "m2", group: "A" },
  { id: "e3", studentId: "5", moduleId: "m1", group: "B" },
  { id: "e4", studentId: "5", moduleId: "m3", group: "A" },
  { id: "e5", studentId: "6", moduleId: "m1", group: "A" },
  { id: "e6", studentId: "6", moduleId: "m2", group: "B" },
];

// Questions
export const questions: Question[] = [
  {
    id: "q1",
    moduleId: "m1",
    topicId: "t1",
    type: "MCQ",
    text: "Which of the following is NOT a valid Python data type?",
    points: 2,
    options: ["int", "float", "char", "str"],
    correctAnswer: "char",
    createdBy: "2",
    createdAt: "2024-01-20T10:00:00Z",
  },
  {
    id: "q2",
    moduleId: "m1",
    topicId: "t2",
    type: "True/False",
    text: "Python uses curly braces {} to define code blocks.",
    points: 1,
    options: ["True", "False"],
    correctAnswer: "False",
    createdBy: "2",
    createdAt: "2024-01-20T10:00:00Z",
  },
  {
    id: "q3",
    moduleId: "m1",
    topicId: "t3",
    type: "Descriptive",
    text: "Explain the difference between parameters and arguments in Python functions.",
    points: 5,
    referenceAnswer: "Parameters are the variables listed in the function definition, while arguments are the actual values passed to the function when it is called. Parameters act as placeholders that define what type of data the function expects, whereas arguments are the concrete data provided during function invocation.",
    keywords: [
      { text: "parameters", weight: 1 },
      { text: "function definition", weight: 1 },
      { text: "arguments", weight: 1 },
      { text: "values passed", weight: 1 },
      { text: "function call", weight: 1 },
    ],
    createdBy: "2",
    createdAt: "2024-01-20T10:00:00Z",
  },
  {
    id: "q4",
    moduleId: "m1",
    topicId: "t4",
    type: "MCQ",
    text: "Which keyword is used to create a class in Python?",
    points: 2,
    options: ["class", "Class", "define", "def"],
    correctAnswer: "class",
    createdBy: "2",
    createdAt: "2024-01-20T10:00:00Z",
  },
  {
    id: "q5",
    moduleId: "m2",
    topicId: "t7",
    type: "Descriptive",
    text: "Describe the Quick Sort algorithm and its time complexity.",
    points: 10,
    referenceAnswer: "Quick Sort is a divide-and-conquer sorting algorithm that works by selecting a pivot element and partitioning the array around it. Elements smaller than the pivot go to the left, and larger elements go to the right. This process is recursively applied to the sub-arrays. The average time complexity is O(n log n), but the worst-case time complexity is O(n²) when the pivot is consistently the smallest or largest element.",
    keywords: [
      { text: "divide-and-conquer", weight: 2 },
      { text: "pivot", weight: 2 },
      { text: "partitioning", weight: 2 },
      { text: "O(n log n)", weight: 2 },
      { text: "worst-case", weight: 1 },
      { text: "O(n²)", weight: 1 },
    ],
    createdBy: "2",
    createdAt: "2024-01-25T10:00:00Z",
  },
];

// Assessments
export const assessments: Assessment[] = [
  {
    id: "a1",
    title: "Python Basics Quiz",
    moduleId: "m1",
    duration: 30,
    startTime: "2026-02-25T10:00:00Z",
    endTime: "2026-02-25T12:00:00Z",
    status: "Scheduled",
    questions: ["q1", "q2", "q3"],
    randomize: false,
    instructions: "This quiz covers basic Python concepts including data types, control structures, and functions.",
    shuffleAnswers: true,
    autoSubmitOnTimeout: true,
    tabSwitchWarning: true,
    resultsVisibility: {
      showScore: true,
      showQuestionBreakdown: true,
      showKeywordAnalysis: true,
    },
    createdBy: "2",
    createdAt: "2024-02-15T10:00:00Z",
  },
  {
    id: "a2",
    title: "OOP Concepts Assessment",
    moduleId: "m1",
    duration: 45,
    startTime: "2026-02-20T09:00:00Z",
    endTime: "2026-02-20T11:00:00Z",
    status: "Published",
    questions: ["q4"],
    randomize: false,
    instructions: "Assessment on core OOP concepts such as classes and objects.",
    shuffleAnswers: true,
    autoSubmitOnTimeout: true,
    tabSwitchWarning: false,
    resultsVisibility: {
      showScore: true,
      showQuestionBreakdown: true,
      showKeywordAnalysis: false,
    },
    createdBy: "2",
    createdAt: "2024-02-10T10:00:00Z",
  },
  {
    id: "a3",
    title: "Sorting Algorithms Exam",
    moduleId: "m2",
    duration: 60,
    startTime: "2026-02-23T14:00:00Z",
    endTime: "2026-02-23T16:00:00Z",
    status: "Active",
    questions: ["q5"],
    randomize: false,
    instructions: "Exam focused on sorting algorithms with an emphasis on Quick Sort.",
    shuffleAnswers: false,
    autoSubmitOnTimeout: true,
    tabSwitchWarning: true,
    resultsVisibility: {
      showScore: true,
      showQuestionBreakdown: true,
      showKeywordAnalysis: true,
    },
    createdBy: "2",
    createdAt: "2024-02-18T10:00:00Z",
  },
  {
    id: "a4",
    title: "Midterm Exam - Data Structures",
    moduleId: "m2",
    duration: 120,
    startTime: "2026-03-15T09:00:00Z",
    endTime: "2026-03-15T13:00:00Z",
    status: "Draft",
    questions: [],
    randomize: true,
    instructions: "Midterm exam covering multiple data structure topics.",
    shuffleAnswers: true,
    autoSubmitOnTimeout: true,
    tabSwitchWarning: false,
    resultsVisibility: {
      showScore: true,
      showQuestionBreakdown: false,
      showKeywordAnalysis: false,
    },
    createdBy: "2",
    createdAt: "2024-02-22T10:00:00Z",
  },
];

// Submissions
export const submissions: Submission[] = [
  {
    id: "s1",
    assessmentId: "a2",
    studentId: "4",
    answers: [
      {
        questionId: "q4",
        answer: "class",
      },
    ],
    status: "Graded",
    score: 2,
    maxScore: 2,
    submittedAt: "2026-02-20T09:35:00Z",
    gradedAt: "2026-02-20T10:00:00Z",
    feedback: "Perfect! Well done.",
  },
  {
    id: "s2",
    assessmentId: "a2",
    studentId: "5",
    answers: [
      {
        questionId: "q4",
        answer: "Class",
      },
    ],
    status: "Graded",
    score: 0,
    maxScore: 2,
    submittedAt: "2026-02-20T09:40:00Z",
    gradedAt: "2026-02-20T10:05:00Z",
    feedback: "Remember that Python is case-sensitive.",
  },
  {
    id: "s3",
    assessmentId: "a3",
    studentId: "4",
    answers: [
      {
        questionId: "q5",
        answer: "Quick Sort uses a pivot element to divide the array into smaller parts. Elements are compared with the pivot and sorted accordingly. The time complexity is usually O(n log n) but can be O(n²) in worst cases when the pivot selection is poor.",
        detectedKeywords: ["pivot", "O(n log n)", "worst-case", "O(n²)"],
        missingKeywords: ["divide-and-conquer", "partitioning"],
        autoScore: 6,
      },
    ],
    status: "Submitted",
    maxScore: 10,
    submittedAt: "2026-02-23T14:55:00Z",
  },
  {
    id: "s4",
    assessmentId: "a3",
    studentId: "6",
    answers: [
      {
        questionId: "q5",
        answer: "",
      },
    ],
    status: "In Progress",
    maxScore: 10,
  },
];

// Current logged in user (for demo purposes)
export let currentUser: User = users[0]; // Default to admin

export function setCurrentUser(user: User) {
  currentUser = user;
}

export function getCurrentUser() {
  return currentUser;
}
