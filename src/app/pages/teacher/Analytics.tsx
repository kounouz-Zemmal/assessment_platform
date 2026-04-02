import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { useMinimumSkeletonTime } from "../../hooks/useMinimumSkeletonTime";
import { StatCard } from "../../components/StatCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { getCurrentUser } from "../../mockData";
import {
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  AlertTriangle,
} from "lucide-react";
import { apiGet } from "../../apiClient";

const PASSING_PERCENTAGE = 50;

type QuestionDifficultyMetric = {
  questionId: string;
  label: string;
  attemptCount: number;
  averageScore: number;
  successRate: number;
  correctCount: number;
  maxPoints: number;
  difficulty: "Easy" | "Medium" | "Hard";
};

export default function TeacherAnalytics() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [analyticsData, setAnalyticsData] = useState<null | {
    authorizedAssessments: Array<{
      id: string;
      title: string;
      moduleId: string;
      moduleCode: string;
      status: string;
    }>;
    selectedAssessmentId: string | null;
    summary: {
      totalSubmissions: number;
      passedStudents: number;
      failedStudents: number;
      averageScore: number;
      passRate: number;
    };
    scoreDistribution: Array<{ range: string; count: number }>;
    questionMetrics: QuestionDifficultyMetric[];
    difficultyBreakdown: Array<{ name: string; value: number; color: string }>;
    selectedAssessment?: {
      id: string;
      title: string;
      moduleCode: string;
      moduleName: string;
      status: string;
      duration: number;
      startTime: string | null;
      endTime: string | null;
    };
  }>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const showLoadingSkeleton = useMinimumSkeletonTime(loading);

  const authorizedAssessments = analyticsData?.authorizedAssessments ?? [];

  const [selectedAssessmentId, setSelectedAssessmentId] = useState(
    authorizedAssessments[0]?.id ?? "",
  );

  useEffect(() => {
    if (currentUser.role !== "teacher") {
      setLoading(false);
      return;
    }

    const params: Record<string, string> = { teacher_id: currentUser.id };
    if (selectedAssessmentId) {
      params.assessment_id = selectedAssessmentId;
    }

    setLoading(true);
    setLoadError(null);
    apiGet<NonNullable<typeof analyticsData>>("teacher/analytics", params)
      .then((data) => {
        setAnalyticsData(data);
        if (
          data.selectedAssessmentId &&
          data.selectedAssessmentId !== selectedAssessmentId
        ) {
          setSelectedAssessmentId(data.selectedAssessmentId);
        }
      })
      .catch(() => {
        setAnalyticsData(null);
        setLoadError("Could not load analytics from backend.");
      })
      .finally(() => setLoading(false));
  }, [currentUser.id, currentUser.role, selectedAssessmentId]);

  const selectedAssessment = analyticsData?.selectedAssessment;

  if (currentUser.role !== "teacher") {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-gray-700 font-medium">
              Only teachers can access analytics.
            </p>
            <p className="text-gray-500 text-sm mt-1">
              Your account does not have access to this section.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showLoadingSkeleton) {
    return (
      <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-9 w-72" />
            <Skeleton className="h-5 w-96" />
          </div>
          <div className="w-full lg:w-[360px] space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 mb-6">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>

        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-gray-700 font-medium">
              Analytics data not available.
            </p>
            {loadError && (
              <p className="text-sm text-gray-500 mt-1">{loadError}</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (authorizedAssessments.length === 0) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Assessment Analytics
          </h1>
          <p className="text-gray-500 mt-1">
            Performance insights for your assessments
          </p>
        </div>
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-gray-700 font-medium">
              No authorized assessments found.
            </p>
            <p className="text-gray-500 text-sm mt-1">
              Analytics is available only for assessments you own or are
              assigned to manage.
            </p>
            <Button
              className="mt-4"
              onClick={() => navigate("/teacher/assessments")}
            >
              Go to Assessments
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!selectedAssessment) {
    return null;
  }

  const totalSubmissions = analyticsData.summary.totalSubmissions;
  const passedStudents = analyticsData.summary.passedStudents;
  const failedStudents = analyticsData.summary.failedStudents;
  const averageScore = analyticsData.summary.averageScore;
  const passRate = analyticsData.summary.passRate;

  const scoreDistribution = analyticsData.scoreDistribution;
  const questionMetrics: QuestionDifficultyMetric[] =
    analyticsData.questionMetrics;
  const difficultyBreakdown = analyticsData.difficultyBreakdown;

  const getDifficultyBadgeClass = (difficulty: "Easy" | "Medium" | "Hard") => {
    if (difficulty === "Easy") return "bg-green-100 text-green-700";
    if (difficulty === "Medium") return "bg-amber-100 text-amber-700";
    return "bg-red-100 text-red-700";
  };

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge variant="outline" className="mb-2 bg-white">
            Live Insights
          </Badge>
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
            Assessment Analytics
          </h1>
          <p className="text-gray-500 mt-1">
            Track score distribution, pass rate, and question difficulty by
            assessment.
          </p>
        </div>
        <div className="w-full lg:w-[360px]">
          <p className="text-sm text-gray-600 mb-2">Select Assessment</p>
          <Select
            value={selectedAssessmentId}
            onValueChange={setSelectedAssessmentId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose assessment" />
            </SelectTrigger>
            <SelectContent>
              {authorizedAssessments.map((assessment) => (
                <SelectItem key={assessment.id} value={assessment.id}>
                  {assessment.title} ({assessment.moduleCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="mb-6 shadow-sm border-gray-200">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">
                Assessment
              </p>
              <p className="font-medium text-gray-900 mt-1">
                {selectedAssessment?.title ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">
                Module
              </p>
              <p className="font-medium text-gray-900 mt-1">
                {selectedAssessment
                  ? `${selectedAssessment.moduleCode} - ${selectedAssessment.moduleName}`
                  : "Unknown module"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">
                Status
              </p>
              <p className="font-medium text-gray-900 mt-1">
                {selectedAssessment?.status ?? "-"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <Button
                className="w-full sm:w-auto"
                variant="outline"
                onClick={() => navigate("/teacher/assessments")}
              >
                Manage Assessment
              </Button>
              <Button
                className="w-full sm:w-auto"
                onClick={() =>
                  navigate(
                    `/teacher/assessments/${selectedAssessment.id}/submissions`,
                  )
                }
              >
                View Submissions
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {totalSubmissions === 0 && (
        <Card className="mb-6 border-dashed border-gray-300 bg-gray-50/40">
          <CardContent className="py-6">
            <p className="text-sm font-medium text-gray-800">
              No finalized submissions yet
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Analytics will populate once students submit or you finish
              grading.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 mb-6">
        <StatCard
          title="Total Submissions"
          value={totalSubmissions}
          icon={ClipboardCheck}
          description="Submitted or graded attempts"
        />
        <StatCard
          title="Passed Students"
          value={passedStudents}
          icon={CheckCircle2}
          description={`Threshold: ${PASSING_PERCENTAGE}%`}
        />
        <StatCard
          title="Failed Students"
          value={failedStudents}
          icon={AlertTriangle}
          description={`Threshold: below ${PASSING_PERCENTAGE}%`}
        />
        <StatCard
          title="Average Score"
          value={`${averageScore.toFixed(1)}%`}
          icon={BarChart3}
          description={`Pass rate: ${passRate.toFixed(1)}%`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="shadow-sm border-gray-200">
          <CardHeader>
            <CardTitle>Score Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] sm:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    fill="#2563eb"
                    name="Students"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-gray-200">
          <CardHeader>
            <CardTitle>Question Difficulty Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {questionMetrics.length === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">
                No questions linked to this assessment.
              </p>
            ) : (
              <div>
                <div className="h-[220px] sm:h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={difficultyBreakdown}
                        cx="50%"
                        cy="50%"
                        outerRadius={95}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, value }) =>
                          typeof value === "number" && value > 0
                            ? `${name}: ${value}`
                            : ""
                        }
                        labelLine={false}
                      >
                        {difficultyBreakdown.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {difficultyBreakdown.map((item) => (
                    <Badge
                      key={item.name}
                      variant="outline"
                      className="bg-white"
                    >
                      {item.name}: {item.value}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-gray-200">
        <CardHeader>
          <CardTitle>Question Difficulty Indicators</CardTitle>
        </CardHeader>
        <CardContent>
          {questionMetrics.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              Add questions to this assessment to view per-question analytics.
            </p>
          ) : (
            <div className="space-y-3">
              {questionMetrics.map((metric) => {
                return (
                  <div
                    key={metric.questionId}
                    className="p-3 sm:p-4 rounded-lg border border-gray-200 bg-gray-50 transition-all duration-200 ease-out hover:border-gray-300 hover:shadow-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <Badge variant="outline">{metric.label}</Badge>
                      <Badge
                        className={getDifficultyBadgeClass(metric.difficulty)}
                      >
                        {metric.difficulty}
                      </Badge>
                      {metric.attemptCount === 0 && (
                        <Badge variant="secondary">No attempts yet</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="bg-white rounded-md p-3 border border-gray-200">
                        <p className="text-gray-500">Attempts</p>
                        <p className="font-semibold text-gray-900">
                          {metric.attemptCount}
                        </p>
                      </div>
                      <div className="bg-white rounded-md p-3 border border-gray-200">
                        <p className="text-gray-500">Average Score</p>
                        <p className="font-semibold text-gray-900">
                          {metric.averageScore.toFixed(2)} / {metric.maxPoints}
                        </p>
                      </div>
                      <div className="bg-white rounded-md p-3 border border-gray-200">
                        <p className="text-gray-500">Success Rate</p>
                        <p className="font-semibold text-gray-900">
                          {metric.successRate.toFixed(1)}%
                        </p>
                      </div>
                      <div className="bg-white rounded-md p-3 border border-gray-200">
                        <p className="text-gray-500">Correct Answers</p>
                        <p className="font-semibold text-gray-900">
                          {metric.correctCount}
                        </p>
                      </div>
                    </div>
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
