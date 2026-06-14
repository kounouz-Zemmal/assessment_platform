import { User, TeachingRole } from "./types";
import { teacherAssignments } from "./mockData";

export function getTeachingRoleForModule(
  teacherId: string,
  moduleId: string
): TeachingRole | null {
  const assignment = teacherAssignments.find(
    (a) => a.teacherId === teacherId && a.moduleId === moduleId
  );
  return assignment ? assignment.teachingRole : null;
}

export function canPublishAssessment(user: User, moduleId: string): boolean {
  if (user.role !== "teacher") return false;
  const role = getTeachingRoleForModule(user.id, moduleId);
  return role === "Lecturer";
}

export function canFinalizeGrades(user: User, moduleId: string): boolean {
  if (user.role !== "teacher") return false;
  const role = getTeachingRoleForModule(user.id, moduleId);
  return role === "Lecturer";
}

export function canEditAssessmentQuestions(user: User, moduleId: string): boolean {
  if (user.role !== "teacher") return false;
  const role = getTeachingRoleForModule(user.id, moduleId);
  return role === "Lecturer" || role === "Lab Instructor";
}

export function canGradeSubmissions(user: User, moduleId: string): boolean {
  if (user.role !== "teacher") return false;
  const role = getTeachingRoleForModule(user.id, moduleId);
  return role === "Lecturer" || role === "Lab Instructor" || role === "Tutorial Instructor";
}

