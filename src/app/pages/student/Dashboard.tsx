import { useNavigate } from "react-router";
import { Clock, Calendar, CheckCircle, AlertCircle } from "lucide-react";
import { StatCard } from "../../components/StatCard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Progress } from "../../components/ui/progress";
import { StatusBadge } from "../../components/StatusBadge";
import {
  assessments,
  submissions,
  studentEnrollments,
  modules,
  getCurrentUser,
} from "../../mockData";
import { Badge } from "../../components/ui/badge";

export default function StudentDashboard() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  // Get student's enrolled modules
  const myEnrollments = studentEnrollments.filter(
    (e) => e.studentId === currentUser.id,
  );
  const myModuleIds = myEnrollments.map((e) => e.moduleId);

  // Get assessments for enrolled modules
  const availableAssessments = assessments.filter((a) =>
    myModuleIds.includes(a.moduleId),
  );

  // Get my submissions
  const mySubmissions = submissions.filter(
    (s) => s.studentId === currentUser.id,
  );

  const upcomingAssessments = availableAssessments.filter(
    (a) => a.status === "Scheduled" || a.status === "Active",
  );

  const completedAssessments = mySubmissions.filter(
    (s) => s.status === "Graded" || s.status === "Submitted",
  );

  // Use published/finalized equivalent in current demo data: graded results only.
  const publishedResults = mySubmissions.filter(
    (s) => s.status === "Graded" && s.score !== undefined,
  );

  const averageScore =
    publishedResults.length > 0
      ? Math.round(
          publishedResults.reduce(
            (sum, s) => sum + (s.score! / s.maxScore) * 100,
            0,
          ) / publishedResults.length,
        )
      : 0;

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <Badge variant="outline" className="mb-2 bg-white">
          Learning Overview
        </Badge>
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
          Student Dashboard
        </h1>
        <p className="text-gray-500 mt-1">Welcome back, {currentUser.name}!</p>
      </div>

      <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Button
          variant="outline"
          className="transition-all duration-200 ease-out hover:shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
          onClick={() => navigate("/student/assessments")}
        >
          Go to Assessments
        </Button>
        <Button
          variant="outline"
          className="transition-all duration-200 ease-out hover:shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
          onClick={() => navigate("/student/history")}
        >
          View History
        </Button>
        <Button
          variant="outline"
          className="transition-all duration-200 ease-out hover:shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
          onClick={() => navigate("/student/profile")}
        >
          Open Profile
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <StatCard
          title="Upcoming Assessments"
          value={upcomingAssessments.length}
          icon={Clock}
          description="Scheduled or active"
        />
        <StatCard
          title="Completed"
          value={completedAssessments.length}
          icon={CheckCircle}
          description="Submitted or graded"
        />
        <StatCard
          title="Average Score"
          value={`${averageScore}%`}
          icon={AlertCircle}
          description="Overall performance"
        />
        <StatCard
          title="Enrolled Modules"
          value={myEnrollments.length}
          icon={Calendar}
          description="Active courses"
        />
      </div>

      <Card className="mb-6 shadow-sm border-gray-200">
        <CardHeader>
          <CardTitle>Performance Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
            <p className="text-sm text-gray-600">Current average score</p>
            <p className="text-sm font-semibold text-gray-900">
              {averageScore}%
            </p>
          </div>
          <Progress value={averageScore} className="h-2" />
          <p className="text-xs text-gray-500 mt-2">
            Based on graded assessments only.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Upcoming Assessments */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader>
            <CardTitle>Upcoming Assessments</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingAssessments.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                No upcoming assessments
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingAssessments.slice(0, 5).map((assessment) => {
                  const module = modules.find(
                    (m) => m.id === assessment.moduleId,
                  );
                  const mySubmission = mySubmissions.find(
                    (s) => s.assessmentId === assessment.id,
                  );
                  const canStart = assessment.status === "Active";

                  return (
                    <div
                      key={assessment.id}
                      className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-all duration-200 ease-out hover:border-gray-300"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {assessment.title}
                        </p>
                        <p className="text-sm text-gray-600 mt-0.5">
                          {module?.code} - {module?.name}
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          Available:{" "}
                          {new Date(assessment.startTime).toLocaleDateString()}{" "}
                          {new Date(assessment.startTime).toLocaleTimeString(
                            [],
                            { hour: "2-digit", minute: "2-digit" },
                          )}{" "}
                          • {assessment.duration} min
                        </p>
                        <div className="mt-2">
                          <StatusBadge status={assessment.status} />
                        </div>
                      </div>
                      {canStart && !mySubmission && (
                        <Button
                          className="w-full sm:w-auto"
                          size="sm"
                          onClick={() =>
                            navigate(
                              `/student/assessments/${assessment.id}/instructions`,
                            )
                          }
                        >
                          Start
                        </Button>
                      )}
                      {mySubmission && (
                        <Button
                          className="w-full sm:w-auto"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            navigate(
                              `/student/assessments/${assessment.id}/results`,
                            )
                          }
                        >
                          View
                        </Button>
                      )}
                    </div>
                  );
                })}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/student/assessments")}
                >
                  View All Assessments
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Results */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader>
            <CardTitle>Recent Results</CardTitle>
          </CardHeader>
          <CardContent>
            {completedAssessments.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                No results available yet
              </p>
            ) : (
              <div className="space-y-3">
                {completedAssessments.slice(0, 5).map((submission) => {
                  const assessment = assessments.find(
                    (a) => a.id === submission.assessmentId,
                  );
                  const module = modules.find(
                    (m) => m.id === assessment?.moduleId,
                  );

                  return (
                    <div
                      key={submission.id}
                      className="bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      <button
                        type="button"
                        className="w-full text-left flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                        onClick={() =>
                          navigate(
                            `/student/assessments/${assessment?.id}/results`,
                          )
                        }
                        aria-label={`Open results for ${assessment?.title ?? "assessment"}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {assessment?.title}
                          </p>
                          <p className="text-sm text-gray-600">
                            {module?.code}
                          </p>
                        </div>
                        {submission.score !== undefined ? (
                          <div className="text-left sm:text-right">
                            <p className="text-lg font-bold text-gray-900">
                              {Math.round(
                                (submission.score / submission.maxScore) * 100,
                              )}
                              %
                            </p>
                            <p className="text-xs text-gray-500">
                              {submission.score}/{submission.maxScore}
                            </p>
                          </div>
                        ) : (
                          <StatusBadge status={submission.status} />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 shadow-sm border-gray-200">
        <CardHeader>
          <CardTitle>Enrolled Modules</CardTitle>
        </CardHeader>
        <CardContent>
          {myEnrollments.length === 0 ? (
            <p className="text-center text-gray-500 py-6">
              No enrolled modules found.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {myEnrollments.map((enrollment) => {
                const module = modules.find(
                  (m) => m.id === enrollment.moduleId,
                );
                return (
                  <div
                    key={enrollment.id}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                  >
                    <p className="font-medium text-gray-900">
                      {module?.code} - {module?.name}
                    </p>
                    {enrollment.group && (
                      <p className="text-sm text-gray-600 mt-1">
                        Group {enrollment.group}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
