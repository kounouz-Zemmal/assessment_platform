import { useMemo, useState } from "react";
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
import {
  assessments,
  submissions,
  questions,
  modules,
  teacherAssignments,
  getCurrentUser,
} from "../../mockData";
import { Submission, Question } from "../../types";
import {
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  AlertTriangle,
} from "lucide-react";

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

function normalizeToArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function getAnswerScore(submission: Submission, question: Question): number {
  const answer = submission.answers.find(
    (item) => item.questionId === question.id,
  );
  if (!answer) return 0;

  if (typeof answer.autoScore === "number") {
    return Math.max(0, Math.min(answer.autoScore, question.points));
  }

  const expectedAnswers = normalizeToArray(question.correctAnswer).map((item) =>
    item.trim().toLowerCase(),
  );
  const studentAnswers = normalizeToArray(answer.answer).map((item) =>
    item.trim().toLowerCase(),
  );

  if (expectedAnswers.length === 0) {
    return 0;
  }

  const allMatch =
    studentAnswers.length === expectedAnswers.length &&
    expectedAnswers.every((expected) => studentAnswers.includes(expected));

  return allMatch ? question.points : 0;
}

function getDifficultyFromSuccessRate(
  successRate: number,
): "Easy" | "Medium" | "Hard" {
  if (successRate >= 70) return "Easy";
  if (successRate >= 40) return "Medium";
  return "Hard";
}

export default function TeacherAnalytics() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  const authorizedAssessments = useMemo(() => {
    const assignedModuleIds = new Set(
      teacherAssignments
        .filter((assignment) => assignment.teacherId === currentUser.id)
        .map((assignment) => assignment.moduleId),
    );

    return assessments.filter(
      (assessment) =>
        assessment.createdBy === currentUser.id ||
        assignedModuleIds.has(assessment.moduleId),
    );
  }, [currentUser.id]);

  const [selectedAssessmentId, setSelectedAssessmentId] = useState(
    authorizedAssessments[0]?.id ?? "",
  );

  const selectedAssessment = authorizedAssessments.find(
    (assessment) => assessment.id === selectedAssessmentId,
  );
  const selectedModule = modules.find(
    (module) => module.id === selectedAssessment?.moduleId,
  );

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

  const selectedAssessmentSubmissions = submissions.filter(
    (submission) => submission.assessmentId === selectedAssessment.id,
  );

  const finalizedSubmissions = selectedAssessmentSubmissions.filter(
    (submission) =>
      submission.status === "Graded" || submission.status === "Submitted",
  );

  const scoredSubmissions = finalizedSubmissions.map((submission) => {
    const calculatedScore =
      typeof submission.score === "number"
        ? submission.score
        : submission.answers.reduce((sum, answer) => {
            const question = questions.find(
              (item) => item.id === answer.questionId,
            );
            return sum + (question ? getAnswerScore(submission, question) : 0);
          }, 0);

    const maxScore = submission.maxScore || 1;
    const percentage = (calculatedScore / maxScore) * 100;

    return {
      submission,
      score: calculatedScore,
      maxScore,
      percentage,
      passed: percentage >= PASSING_PERCENTAGE,
    };
  });

  const totalSubmissions = finalizedSubmissions.length;
  const passedStudents = scoredSubmissions.filter((item) => item.passed).length;
  const failedStudents = Math.max(0, totalSubmissions - passedStudents);
  const averageScore =
    scoredSubmissions.length === 0
      ? 0
      : scoredSubmissions.reduce((sum, item) => sum + item.percentage, 0) /
        scoredSubmissions.length;
  const passRate =
    totalSubmissions === 0 ? 0 : (passedStudents / totalSubmissions) * 100;

  const scoreDistribution = [
    { range: "0-20", min: 0, max: 20 },
    { range: "21-40", min: 21, max: 40 },
    { range: "41-60", min: 41, max: 60 },
    { range: "61-80", min: 61, max: 80 },
    { range: "81-100", min: 81, max: 100 },
  ].map((bucket) => ({
    range: bucket.range,
    count: scoredSubmissions.filter(
      (item) => item.percentage >= bucket.min && item.percentage <= bucket.max,
    ).length,
  }));

  const selectedQuestions = questions.filter((question) =>
    selectedAssessment.questions.includes(question.id),
  );

  const questionMetrics: QuestionDifficultyMetric[] = selectedQuestions.map(
    (question) => {
      const submissionsWithAnswer = finalizedSubmissions.filter((submission) =>
        submission.answers.some((answer) => answer.questionId === question.id),
      );

      const attemptCount = submissionsWithAnswer.length;

      const scores = submissionsWithAnswer.map((submission) =>
        getAnswerScore(submission, question),
      );
      const correctCount = scores.filter(
        (score) => score >= question.points * 0.6,
      ).length;
      const averageQuestionScore =
        attemptCount === 0
          ? 0
          : scores.reduce((sum, score) => sum + score, 0) / attemptCount;
      const successRate =
        attemptCount === 0 ? 0 : (correctCount / attemptCount) * 100;

      return {
        questionId: question.id,
        label: `Q${selectedAssessment.questions.indexOf(question.id) + 1}`,
        attemptCount,
        averageScore: averageQuestionScore,
        successRate,
        correctCount,
        maxPoints: question.points,
        difficulty: getDifficultyFromSuccessRate(successRate),
      };
    },
  );

  const difficultyBreakdown = [
    {
      name: "Easy",
      value: questionMetrics.filter((metric) => metric.difficulty === "Easy")
        .length,
      color: "#10b981",
    },
    {
      name: "Medium",
      value: questionMetrics.filter((metric) => metric.difficulty === "Medium")
        .length,
      color: "#f59e0b",
    },
    {
      name: "Hard",
      value: questionMetrics.filter((metric) => metric.difficulty === "Hard")
        .length,
      color: "#ef4444",
    },
  ];

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
              {authorizedAssessments.map((assessment) => {
                const module = modules.find(
                  (item) => item.id === assessment.moduleId,
                );
                return (
                  <SelectItem key={assessment.id} value={assessment.id}>
                    {assessment.title} {module ? `(${module.code})` : ""}
                  </SelectItem>
                );
              })}
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
                {selectedAssessment.title}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">
                Module
              </p>
              <p className="font-medium text-gray-900 mt-1">
                {selectedModule
                  ? `${selectedModule.code} - ${selectedModule.name}`
                  : "Unknown module"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">
                Status
              </p>
              <p className="font-medium text-gray-900 mt-1">
                {selectedAssessment.status}
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
                const question = questions.find(
                  (item) => item.id === metric.questionId,
                );
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
                      <p className="text-sm text-gray-600">{question?.type}</p>
                      {metric.attemptCount === 0 && (
                        <Badge variant="secondary">No attempts yet</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-900 mb-3 line-clamp-2">
                      {question?.text}
                    </p>
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
