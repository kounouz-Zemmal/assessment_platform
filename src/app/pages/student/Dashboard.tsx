import { useEffect, useState } from "react";
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
import { Skeleton } from "../../components/ui/skeleton";
import { useMinimumSkeletonTime } from "../../hooks/useMinimumSkeletonTime";
import { getCurrentUser } from "../../mockData";
import { Badge } from "../../components/ui/badge";
import { apiGet } from "../../apiClient";

type DashboardApiResponse = {
  studentName: string;
  stats: {
    upcomingCount: number;
    completedCount: number;
    averageScore: number;
    enrolledModulesCount: number;
  };
  upcomingAssessments: Array<{
    id: string;
    title: string;
    moduleCode: string;
    moduleName: string;
    startTime: string | null;
    duration: number;
    status: string;
    hasSubmission: boolean;
  }>;
  recentResults: Array<{
    assessmentId: string;
    title: string;
    moduleCode: string;
    status: string;
    score: number | null;
    maxScore: number;
  }>;
  enrolledModules: Array<{
    id: string;
    code: string;
    name: string;
    group: string;
  }>;
};

export default function StudentDashboard() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [dashboardData, setDashboardData] =
    useState<DashboardApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const showLoadingSkeleton = useMinimumSkeletonTime(loading);

  useEffect(() => {
    if (currentUser.role !== "student") {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    apiGet<DashboardApiResponse>("student/dashboard", {
      student_id: currentUser.id,
    })
      .then((data) => setDashboardData(data))
      .catch(() => {
        setDashboardData(null);
        setLoadError("Could not load dashboard data.");
      })
      .finally(() => setLoading(false));
  }, [currentUser.id, currentUser.role]);

  const uiStats = {
    upcoming: dashboardData?.stats.upcomingCount ?? 0,
    completed: dashboardData?.stats.completedCount ?? 0,
    average: dashboardData?.stats.averageScore ?? 0,
    modules: dashboardData?.stats.enrolledModulesCount ?? 0,
  };

  const uiUpcoming = dashboardData?.upcomingAssessments ?? [];
  const uiRecent =
    dashboardData?.recentResults.map((item) => ({
      id: `${item.assessmentId}-${item.title}`,
      assessmentId: item.assessmentId,
      title: item.title,
      moduleCode: item.moduleCode,
      score: item.score,
      maxScore: item.maxScore,
      status: item.status,
    })) ?? [];
  const uiModules = dashboardData?.enrolledModules ?? [];

  if (showLoadingSkeleton) {
    return (
      <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="mb-8 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-5 w-64" />
        </div>

        <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6 space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-2 w-full" />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-gray-700 font-medium">
              Dashboard data not available.
            </p>
            {loadError && (
              <p className="text-sm text-gray-500 mt-1">{loadError}</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <Badge variant="outline" className="mb-2 bg-white">
          Learning Overview
        </Badge>
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
          Student Dashboard
        </h1>
        <p className="text-gray-500 mt-1">
          Welcome back, {dashboardData?.studentName ?? currentUser.name}!
        </p>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <StatCard
          title="Upcoming Assessments"
          value={uiStats.upcoming}
          icon={Clock}
          description="Scheduled or active"
        />
        <StatCard
          title="Completed"
          value={uiStats.completed}
          icon={CheckCircle}
          description="Submitted or graded"
        />
        <StatCard
          title="Average Score"
          value={`${uiStats.average}%`}
          icon={AlertCircle}
          description="Overall performance"
        />
        <StatCard
          title="Enrolled Modules"
          value={uiStats.modules}
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
              {uiStats.average}%
            </p>
          </div>
          <Progress value={uiStats.average} className="h-2" />
          <p className="text-xs text-gray-500 mt-2">
            Based on graded assessments only.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="shadow-sm border-gray-200">
          <CardHeader>
            <CardTitle>Upcoming Assessments</CardTitle>
          </CardHeader>
          <CardContent>
            {uiUpcoming.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                No upcoming assessments
              </p>
            ) : (
              <div className="space-y-3">
                {uiUpcoming.slice(0, 5).map((assessment) => {
                  const canStart = assessment.status === "Active";
                  const when = assessment.startTime ?? new Date().toISOString();

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
                          {assessment.moduleCode} - {assessment.moduleName}
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          Available: {new Date(when).toLocaleDateString()}{" "}
                          {new Date(when).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          • {assessment.duration} min
                        </p>
                        <div className="mt-2">
                          <StatusBadge status={assessment.status as never} />
                        </div>
                      </div>
                      {canStart && !assessment.hasSubmission && (
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
                      {assessment.hasSubmission && (
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

        <Card className="shadow-sm border-gray-200">
          <CardHeader>
            <CardTitle>Recent Results</CardTitle>
          </CardHeader>
          <CardContent>
            {uiRecent.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                No results available yet
              </p>
            ) : (
              <div className="space-y-3">
                {uiRecent.map((submission) => (
                  <div
                    key={submission.id}
                    className="bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    <button
                      type="button"
                      className="w-full text-left flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                      onClick={() =>
                        navigate(
                          `/student/assessments/${submission.assessmentId}/results`,
                        )
                      }
                      aria-label={`Open results for ${submission.title || "assessment"}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {submission.title}
                        </p>
                        <p className="text-sm text-gray-600">
                          {submission.moduleCode}
                        </p>
                      </div>
                      {submission.score !== undefined &&
                      submission.score !== null ? (
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
                        <StatusBadge status={submission.status as never} />
                      )}
                    </button>
                  </div>
                ))}
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
          {uiModules.length === 0 ? (
            <p className="text-center text-gray-500 py-6">
              No enrolled modules found.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {uiModules.map((enrollment) => (
                <div
                  key={enrollment.id}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                >
                  <p className="font-medium text-gray-900">
                    {enrollment.code} - {enrollment.name}
                  </p>
                  {enrollment.group && (
                    <p className="text-sm text-gray-600 mt-1">
                      Group {enrollment.group}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
