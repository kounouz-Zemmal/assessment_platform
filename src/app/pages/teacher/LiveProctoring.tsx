import { useEffect, useState } from "react";
import { Circle, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { apiGet } from "../../apiClient";

type LiveRow = {
  attemptId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  statusColor: "green" | "red";
  isSuspicious: boolean;
  outsideDurationSeconds: number;
  staleSeconds: number;
  visibilityState: string;
  currentQuestionIndex: number;
  lastSeenAt: string | null;
};

type LivePayload = {
  assessment: {
    id: string;
    title: string;
    moduleCode: string;
    moduleName: string;
    status: string;
    startTime: string | null;
    endTime: string | null;
  } | null;
  thresholdSeconds: number;
  activeStudentsCount: number;
  rows: LiveRow[];
};

export default function TeacherLiveProctoring() {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<LivePayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await apiGet<LivePayload>("teacher/live-proctoring");
        if (!cancelled) setPayload(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const rows = (payload?.rows ?? []).slice().sort((a, b) => {
    if (a.isSuspicious !== b.isSuspicious) return a.isSuspicious ? -1 : 1;
    if (a.outsideDurationSeconds !== b.outsideDurationSeconds) {
      return b.outsideDurationSeconds - a.outsideDurationSeconds;
    }
    return (a.studentName || "").localeCompare(b.studentName || "");
  });

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Live Proctoring</h1>
        <p className="text-gray-500 mt-1">
          Showing only the assessment that is live right now by date and time.
        </p>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-500">Loading live session...</CardContent>
        </Card>
      ) : !payload?.assessment ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-500">
            No live assessment is currently running.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{payload.assessment.title}</span>
                <span className="text-sm font-normal text-gray-500">
                  {payload.activeStudentsCount} students in progress
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600">
              <p>
                {payload.assessment.moduleCode} - {payload.assessment.moduleName}
              </p>
              <p>
                {payload.assessment.startTime
                  ? `Start: ${new Date(payload.assessment.startTime).toLocaleString()}`
                  : "Start: N/A"}{" "}
                |{" "}
                {payload.assessment.endTime
                  ? `End: ${new Date(payload.assessment.endTime).toLocaleString()}`
                  : "End: N/A"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-red-600" />
                Students Taking Assessment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {rows.length === 0 ? (
                <p className="text-sm text-gray-500">No student is currently taking this assessment.</p>
              ) : (
                rows.map((row) => (
                  <div
                    key={row.studentId}
                    className={`rounded-lg border p-3 flex items-center justify-between gap-3 ${
                      row.isSuspicious
                        ? "bg-red-50 border-red-300 animate-pulse"
                        : "bg-green-50 border-green-200"
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-gray-900">{row.studentName}</p>
                      <p className="text-xs text-gray-600">{row.studentEmail}</p>
                    </div>
                    <div className="text-xs text-gray-700 flex items-center gap-3">
                      <span className="inline-flex items-center gap-1">
                        <Circle
                          className="h-3 w-3"
                          fill={row.statusColor === "red" ? "#dc2626" : "#16a34a"}
                          color={row.statusColor === "red" ? "#dc2626" : "#16a34a"}
                        />
                        {row.statusColor === "red" ? "Suspicious" : "Normal"}
                      </span>
                      <span>Outside: {row.outsideDurationSeconds}s</span>
                      <span>Q{Math.max(1, row.currentQuestionIndex + 1)}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
