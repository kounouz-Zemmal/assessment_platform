import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Search, Calendar, Clock } from "lucide-react";
import { Input } from "../../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { StatusBadge } from "../../components/StatusBadge";
import { Badge } from "../../components/ui/badge";
import { apiGet, apiPost } from "../../apiClient";
import { listOutbox, removeOutboxItem, clearDraft, clearSessionState } from "../../services/examPersistence";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "sonner";

export default function StudentAssessments() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const seenNotificationKeysRef = useRef<Set<string>>(new Set());

  const fetchAssessments = async (showLoading = false) => {
    if (!user || user.role !== "student") return;
    if (showLoading) setLoading(true);
    try {
      const data = await apiGet<{ assessments: any[]; notifications?: any[] }>("student/assessments");
      setItems(data.assessments || []);
      let refetchAfterOutbox = false;
      try {
        const ob = await listOutbox();
        for (const row of ob) {
          if (row.kind !== "timed_out") continue;
          try {
            await apiPost(`student/assessments/${row.assessmentId}/attempt/timed-out`, { answers: row.answers });
            await removeOutboxItem(row.key);
            clearDraft(row.assessmentId);
            await clearSessionState(row.assessmentId);
            refetchAfterOutbox = true;
          } catch {
            // Retry on next refresh
          }
        }
      } catch {
        // IndexedDB unavailable — skip
      }
      if (refetchAfterOutbox) {
        const again = await apiGet<{ assessments: any[]; notifications?: any[] }>("student/assessments");
        setItems(again.assessments || []);
      }
      const nextNotifications = data.notifications || [];
      // Show availability notifications only on first visible load,
      // not on every background poll/focus refresh.
      if (showLoading) {
        setNotifications(nextNotifications);
        nextNotifications.forEach((n, idx) => {
          if (!n?.message) return;
          const key = String(n.id ?? `${n.message}-${idx}`);
          if (seenNotificationKeysRef.current.has(key)) return;
          seenNotificationKeysRef.current.add(key);
          toast.info(n.message);
        });
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== "student") return;
    void fetchAssessments(true);

    // Background refresh so newly published assessments appear automatically.
    const intervalId = window.setInterval(() => {
      void fetchAssessments(false);
    }, 10000);

    const handleFocus = () => {
      void fetchAssessments(false);
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [user]);

  const filteredAssessments = useMemo(
    () =>
      items.filter((assessment) =>
        assessment.title.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [items, searchQuery],
  );

  const nowMs = Date.now();
  const timedOutAssessments = filteredAssessments.filter((assessment) => assessment.timedOutWithoutSubmission);

  const missingAssessments = filteredAssessments
    .filter((assessment) => {
      if (assessment.timedOutWithoutSubmission) return false;
      if (assessment.hasSubmission) return false;
      if (!assessment.endTime) return false;
      const endMs = new Date(assessment.endTime).getTime();
      if (Number.isNaN(endMs)) return false;
      return endMs < nowMs;
    })
    .sort((a, b) => {
      const aTime = a.endTime ? new Date(a.endTime).getTime() : 0;
      const bTime = b.endTime ? new Date(b.endTime).getTime() : 0;
      return bTime - aTime;
    });

  const upcomingAssessments = filteredAssessments
    .filter((assessment) => {
      if (assessment.timedOutWithoutSubmission) return false;
      if (assessment.hasSubmission) return false;
      if (!assessment.endTime) return true;
      const endMs = new Date(assessment.endTime).getTime();
      if (Number.isNaN(endMs)) return true;
      return endMs >= nowMs;
    })
    .sort((a, b) => {
      const aTime = a.startTime ? new Date(a.startTime).getTime() : 0;
      const bTime = b.startTime ? new Date(b.startTime).getTime() : 0;
      return aTime - bTime;
    });

  const completedAssessments = filteredAssessments
    .filter((assessment) => assessment.hasSubmission && !assessment.timedOutWithoutSubmission)
    .sort((a, b) => {
      const aTime = a.startTime ? new Date(a.startTime).getTime() : 0;
      const bTime = b.startTime ? new Date(b.startTime).getTime() : 0;
      return bTime - aTime;
    });

  const renderAssessmentCard = (assessment: any) => {
    const canStart = Boolean(assessment.canStart);
    const timedOut = Boolean(assessment.timedOutWithoutSubmission);

    return (
      <Card key={assessment.id} className="hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg mb-2">{assessment.title}</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{assessment.moduleCode}</Badge>
                <StatusBadge status={assessment.status} />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm mb-4">
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="h-4 w-4" />
              <span>
                {assessment.startTime
                  ? `${new Date(assessment.startTime).toLocaleDateString()} • ${new Date(
                      assessment.startTime,
                    ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                  : "Start time not set"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="h-4 w-4" />
              <span>{assessment.duration} minutes</span>
            </div>
            {assessment.endTime && (
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="h-4 w-4" />
                <span>
                  Ends: {new Date(assessment.endTime).toLocaleDateString()} •{" "}
                  {new Date(assessment.endTime).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}
          </div>

          {timedOut && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-950">
                Status: <StatusBadge status="Not submitted" /> — time ended; your instructor did not enable auto-submit,
                so this is not an “in progress” attempt.
              </p>
            </div>
          )}

          {assessment.hasSubmission && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-700">
                Status: <StatusBadge status="Submitted" />
              </p>
            </div>
          )}

          <div className="flex gap-2">
            {canStart && (
              <Button
                className="flex-1"
                onClick={() => navigate(`/student/assessments/${assessment.id}/instructions`)}
              >
                Start Assessment
              </Button>
            )}
            {assessment.hasSubmission && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => navigate(`/student/assessments/${assessment.id}/results`)}
              >
                View Results
              </Button>
            )}
            {!canStart && !assessment.hasSubmission && !timedOut && (
              <Button variant="outline" className="flex-1" disabled>
                Coming
              </Button>
            )}
            {timedOut && (
              <Button variant="outline" className="flex-1" disabled>
                Attempt closed
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Assessments</h1>
        <p className="text-gray-500 mt-1">View and take your assessments</p>
      </div>

      <div className="mb-6">
        {notifications.length > 0 && (
          <Card className="mb-4 border-blue-200 bg-blue-50">
            <CardContent className="py-3 text-sm text-blue-900">
              {notifications[0]?.message || "One or more assessments are now available."}
            </CardContent>
          </Card>
        )}
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

      {loading ? (
        <p className="text-sm text-gray-500">Loading assessments...</p>
      ) : (
      <Tabs defaultValue="upcoming" className="space-y-6">
        <TabsList>
          <TabsTrigger value="upcoming">
            Upcoming ({upcomingAssessments.length})
          </TabsTrigger>
          <TabsTrigger value="notSubmitted">
            Not submitted ({timedOutAssessments.length})
          </TabsTrigger>
          <TabsTrigger value="missing">
            Missing ({missingAssessments.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedAssessments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notSubmitted" className="space-y-6">
          {timedOutAssessments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500">No timed-out attempts without submission</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {timedOutAssessments.map(renderAssessmentCard)}
            </div>
          )}
        </TabsContent>

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

        <TabsContent value="missing" className="space-y-6">
          {missingAssessments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500">No missing assessments</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {missingAssessments.map(renderAssessmentCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-6">
          {completedAssessments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500">No completed assessments</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {completedAssessments.map(renderAssessmentCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>
      )}
    </div>
  );
}
