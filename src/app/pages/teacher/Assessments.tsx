import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Plus, Calendar, Clock, Search } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { StatusBadge } from "../../components/StatusBadge";
import { Badge } from "../../components/ui/badge";
import { useAuth } from "../../contexts/AuthContext";
import { apiGet, apiPatch } from "../../apiClient";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";

function getAssessmentEndMs(assessment: {
  startTime: string | null;
  endTime?: string | null;
  resolvedEndTime?: string | null;
  duration: number;
}): number | null {
  if (assessment.resolvedEndTime) {
    const t = new Date(assessment.resolvedEndTime).getTime();
    return Number.isNaN(t) ? null : t;
  }
  if (assessment.endTime) {
    const t = new Date(assessment.endTime).getTime();
    return Number.isNaN(t) ? null : t;
  }
  if (assessment.startTime && Number.isFinite(assessment.duration) && assessment.duration > 0) {
    const start = new Date(assessment.startTime).getTime();
    if (Number.isNaN(start)) return null;
    return start + assessment.duration * 60 * 1000;
  }
  return null;
}

function getDisplayAssessmentStatus(
  assessment: {
    status: "Draft" | "Scheduled" | "Active" | "Closed" | "Published";
    startTime: string | null;
    endTime?: string | null;
    resolvedEndTime?: string | null;
    duration: number;
  },
  nowMs: number,
): "Draft" | "Scheduled" | "Active" | "Closed" | "Published" {
  const endMs = getAssessmentEndMs(assessment);
  if (endMs !== null && nowMs >= endMs && assessment.status !== "Published") {
    return "Closed";
  }
  const startMs = assessment.startTime ? new Date(assessment.startTime).getTime() : NaN;
  if (!Number.isNaN(startMs) && nowMs >= startMs && assessment.status === "Scheduled") {
    return "Active";
  }
  return assessment.status;
}

export default function TeacherAssessments() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingAssessments, setIsLoadingAssessments] = useState(true);
  const [pendingPublishAssessment, setPendingPublishAssessment] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [assessmentList, setAssessmentList] = useState<
    Array<{
      id: string;
      title: string;
      moduleId: string;
      moduleCode?: string;
      duration: number;
      startTime: string | null;
      endTime?: string | null;
      resolvedEndTime?: string | null;
      status: "Draft" | "Scheduled" | "Active" | "Closed" | "Published";
      questions: string[];
      canModifyStatus?: boolean;
    }>
  >([]);
  const fetchAssessments = async (showLoading = false) => {
    if (!user) return;
    if (showLoading) setIsLoadingAssessments(true);
    try {
      const data = await apiGet<{
        assessments: Array<{
          id: string;
          title: string;
          moduleId: string;
          moduleCode?: string;
          duration: number;
          startTime: string | null;
          endTime?: string | null;
          resolvedEndTime?: string | null;
          status: "Draft" | "Scheduled" | "Active" | "Closed" | "Published";
          questions: string[];
          canModifyStatus?: boolean;
        }>;
      }>("teacher/assessments");
      setAssessmentList(data.assessments || []);
    } catch (error) {
      if (showLoading) {
        toast.error(error instanceof Error ? error.message : "Failed to load assessments");
      }
      setAssessmentList([]);
    } finally {
      if (showLoading) setIsLoadingAssessments(false);
    }
  };

  /** Recompute upcoming vs passed as real time advances (no page refresh). */
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const filteredAssessments = useMemo(
    () =>
      assessmentList.filter((assessment) =>
        assessment.title.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [assessmentList, searchQuery],
  );

  const upcomingAssessments = useMemo(
    () =>
      filteredAssessments
        .filter((assessment) => {
          const endMs = getAssessmentEndMs(assessment);
          if (endMs === null) return true;
          return endMs >= nowMs;
        })
        .sort((a, b) => {
          const aTime = a.startTime ? new Date(a.startTime).getTime() : 0;
          const bTime = b.startTime ? new Date(b.startTime).getTime() : 0;
          return aTime - bTime;
        }),
    [filteredAssessments, nowMs],
  );

  const passedAssessments = useMemo(
    () =>
      filteredAssessments
        .filter((assessment) => {
          const endMs = getAssessmentEndMs(assessment);
          if (endMs === null) return false;
          return endMs < nowMs;
        })
        .sort((a, b) => {
          const aEnd = getAssessmentEndMs(a) ?? 0;
          const bEnd = getAssessmentEndMs(b) ?? 0;
          return bEnd - aEnd;
        }),
    [filteredAssessments, nowMs],
  );

  useEffect(() => {
    if (!user) return;
    void fetchAssessments(true);

    const intervalId = window.setInterval(() => {
      void fetchAssessments(false);
    }, 8000);
    const handleFocus = () => {
      void fetchAssessments(false);
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [user]);

  if (!user) {
    return <div className="p-8">Loading...</div>;
  }

  const handleStatusChange = async (
    assessmentId: string,
    status: "Draft" | "Scheduled" | "Active" | "Closed" | "Published"
  ) => {
    try {
      const response = await apiPatch<{
        assessment: {
          id: string;
          status: "Draft" | "Scheduled" | "Active" | "Closed" | "Published";
          canModifyStatus?: boolean;
        };
      }>(`teacher/assessments/${assessmentId}/status`, { status });

      setAssessmentList((prev) =>
        prev.map((assessment) =>
          assessment.id === assessmentId
            ? {
                ...assessment,
                status: response.assessment.status,
                canModifyStatus: response.assessment.canModifyStatus,
              }
            : assessment
        )
      );
      toast.success(`Assessment status set to ${status}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update assessment status");
    }
  };

  const renderAssessmentCard = (assessment: {
    id: string;
    title: string;
    moduleId: string;
    moduleCode?: string;
    duration: number;
    startTime: string | null;
    endTime?: string | null;
    resolvedEndTime?: string | null;
    status: "Draft" | "Scheduled" | "Active" | "Closed" | "Published";
    questions: string[];
    canModifyStatus?: boolean;
  }) => {
    const displayStatus = getDisplayAssessmentStatus(assessment, nowMs);
    return (
    <Card
      key={assessment.id}
      className="hover:shadow-md transition-shadow"
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg mb-2">{assessment.title}</CardTitle>
            <Badge variant="outline">{assessment.moduleCode || assessment.moduleId}</Badge>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={displayStatus} />
            {assessment.canModifyStatus && (
              <div onClick={(e) => e.stopPropagation()}>
                <Select
                  value={assessment.status}
                  onValueChange={(value) => {
                    const nextStatus = value as
                      | "Draft"
                      | "Scheduled"
                      | "Active"
                      | "Closed"
                      | "Published";
                    if (nextStatus === "Published") {
                      setPendingPublishAssessment({
                        id: assessment.id,
                        title: assessment.title,
                      });
                      return;
                    }
                    handleStatusChange(assessment.id, nextStatus);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Scheduled">Scheduled</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Closed">Closed</SelectItem>
                    <SelectItem value="Published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar className="h-4 w-4" />
            <span>
              {assessment.startTime
                ? `${new Date(assessment.startTime).toLocaleDateString()} • ${new Date(
                    assessment.startTime,
                  ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : "Not scheduled"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Clock className="h-4 w-4" />
            <span>{assessment.duration} minutes</span>
          </div>
          {(assessment.endTime || assessment.startTime) && (
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="h-4 w-4" />
              <span>
                {assessment.endTime
                  ? `Ends: ${new Date(assessment.endTime).toLocaleDateString()} • ${new Date(
                      assessment.endTime,
                    ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                  : assessment.startTime
                    ? `Ends (by duration): ${new Date(
                        new Date(assessment.startTime).getTime() + assessment.duration * 60 * 1000,
                      ).toLocaleDateString()} • ${new Date(
                        new Date(assessment.startTime).getTime() + assessment.duration * 60 * 1000,
                      ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                    : null}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 text-gray-600 mt-3 pt-3 border-t">
            <span className="font-medium">
              {assessment.questions.length} {assessment.questions.length === 1 ? "question" : "questions"}
            </span>
            <span className="text-gray-400">•</span>
            <span className="font-medium">Track submissions</span>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/teacher/assessments/edit/${assessment.id}`);
              }}
            >
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/teacher/assessments/${assessment.id}/submissions`);
              }}
            >
              View Submissions
            </Button>
          </div>
          <div className="flex flex-col items-start gap-1">
            {!assessment.canModifyStatus && (
              <p className="text-xs text-gray-500">
                Only the module Lecturer can modify assessment status.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
    );
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Assessments</h1>
          <p className="text-gray-500 mt-1">Manage your assessments and exams</p>
        </div>
        <Button onClick={() => navigate("/teacher/assessments/create")}>
          <Plus className="h-4 w-4 mr-2" />
          Create Assessment
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search assessments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs defaultValue="upcoming" className="space-y-6">
        <TabsList>
          <TabsTrigger value="upcoming">
            Upcoming ({upcomingAssessments.length})
          </TabsTrigger>
          <TabsTrigger value="passed">
            Passed ({passedAssessments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-6">
          {upcomingAssessments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500">No upcoming assessments</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {upcomingAssessments.map(renderAssessmentCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="passed" className="space-y-6">
          {passedAssessments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500">No passed assessments</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {passedAssessments.map(renderAssessmentCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {isLoadingAssessments && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">Loading assessments...</p>
          </CardContent>
        </Card>
      )}

      {!isLoadingAssessments && filteredAssessments.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 mb-4">No assessments found</p>
            <Button onClick={() => navigate("/teacher/assessments/create")}>
              Create Your First Assessment
            </Button>
          </CardContent>
        </Card>
      )}

      <AlertDialog
        open={!!pendingPublishAssessment}
        onOpenChange={(open) => {
          if (!open) setPendingPublishAssessment(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish assessment?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to publish{" "}
              <span className="font-medium">{pendingPublishAssessment?.title}</span>. This is a
              critical action and students may immediately see results based on your settings.
              Continue only if this assessment is ready.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingPublishAssessment) return;
                handleStatusChange(pendingPublishAssessment.id, "Published");
                setPendingPublishAssessment(null);
              }}
            >
              Yes, publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
