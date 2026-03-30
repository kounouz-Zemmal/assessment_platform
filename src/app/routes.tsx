import { createBrowserRouter } from "react-router";
import React, { Suspense } from "react";
import Login from "./pages/Login";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminUsers from "./pages/admin/Users";
import AdminModules from "./pages/admin/Modules";
import AdminTeacherAssignment from "./pages/admin/TeacherAssignment";
import AdminEnrollment from "./pages/admin/Enrollment";
import TeacherDashboard from "./pages/teacher/Dashboard";
import TeacherQuestionBank from "./pages/teacher/QuestionBank";
import TeacherCreateQuestion from "./pages/teacher/CreateQuestion";
import TeacherAssessments from "./pages/teacher/Assessments";
import TeacherCreateAssessment from "./pages/teacher/CreateAssessment";
import TeacherSubmissions from "./pages/teacher/Submissions";
import TeacherGrading from "./pages/teacher/Grading";
import TeacherAnalytics from "./pages/teacher/Analytics";
import TeacherModules from "./pages/teacher/Modules";
import StudentDashboard from "./pages/student/Dashboard";
import StudentAssessments from "./pages/student/Assessments";
import StudentExamInstructions from "./pages/student/ExamInstructions";
import StudentTakeExam from "./pages/student/TakeExam";
import StudentResults from "./pages/student/Results";
import StudentHistory from "./pages/student/History";
import Profile from "./pages/Profile";
const ResultsSettings = React.lazy(
  () => import("./pages/teacher/ResultsSettings"),
);
import AdminLayout from "./layouts/AdminLayout";
import TeacherLayout from "./layouts/TeacherLayout";
import StudentLayout from "./layouts/StudentLayout";
import NotFound from "./pages/NotFound";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Login />,
  },
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      { index: true, element: <AdminDashboard /> },
      { path: "users", element: <AdminUsers /> },
      { path: "modules", element: <AdminModules /> },
      { path: "teacher-assignment", element: <AdminTeacherAssignment /> },
      { path: "enrollment", element: <AdminEnrollment /> },
      { path: "profile", element: <Profile /> },
    ],
  },
  {
    path: "/teacher",
    element: <TeacherLayout />,
    children: [
      { index: true, element: <TeacherDashboard /> },
      { path: "questions", element: <TeacherQuestionBank /> },
      { path: "questions/create", element: <TeacherCreateQuestion /> },
      { path: "questions/edit/:id", element: <TeacherCreateQuestion /> },
      { path: "modules", element: <TeacherModules /> },
      { path: "assessments", element: <TeacherAssessments /> },
      { path: "assessments/create", element: <TeacherCreateAssessment /> },
      { path: "assessments/edit/:id", element: <TeacherCreateAssessment /> },
      { path: "assessments/:id/submissions", element: <TeacherSubmissions /> },
      { path: "grading/:submissionId", element: <TeacherGrading /> },
      { path: "analytics", element: <TeacherAnalytics /> },
      {
        path: "results-visibility",
        element: (
          <Suspense fallback={<div>Loading...</div>}>
            <ResultsSettings />
          </Suspense>
        ),
      },
      { path: "profile", element: <Profile /> },
    ],
  },
  {
    path: "/student",
    element: <StudentLayout />,
    children: [
      { index: true, element: <StudentDashboard /> },
      { path: "assessments", element: <StudentAssessments /> },
      {
        path: "assessments/:id/instructions",
        element: <StudentExamInstructions />,
      },
      { path: "assessments/:id/take", element: <StudentTakeExam /> },
      { path: "assessments/:id/results", element: <StudentResults /> },
      { path: "history", element: <StudentHistory /> },
      { path: "profile", element: <Profile /> },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);
