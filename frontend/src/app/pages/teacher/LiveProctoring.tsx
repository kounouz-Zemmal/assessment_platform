import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { apiGet } from "../../apiClient";

type LiveRow = {
  attemptId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  participationPhase: "active" | "submitted";
  statusColor: "green" | "red" | "blue";
  isSuspicious: boolean;
  outsideDurationSeconds: number;
  staleSeconds: number;
  visibilityState: string;
  currentQuestionIndex: number;
  lastSeenAt: string | null;
  submittedAt: string | null;
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
  submittedStudentsCount?: number;
  rows: LiveRow[];
};

function shortLabel(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 8);
  return `${parts[0][0]}. ${parts[parts.length - 1].slice(0, 10)}`;
}

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

  const rows = payload?.rows ?? [];

  const submittedCount =
    payload?.submittedStudentsCount ?? rows.filter((r) => r.participationPhase === "submitted").length;

  return (
    <div className="p-6 sm:p-8 space-y-6 bg-white min-h-screen">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Live Proctoring</h1>
        <p className="text-gray-500 mt-1 text-sm sm:text-base">
          Live session for the assessment in its scheduled window. Suspicious students appear first; submitted
          attempts stay visible in blue.
        </p>
      </div>

      {loading ? (
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="py-12 text-center text-gray-500">Loading live session…</CardContent>
        </Card>
      ) : !payload?.assessment ? (
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="py-12 text-center text-gray-500">
            No live assessment is currently running.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-lg">
                <span className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-red-600 shrink-0" />
                  {payload.assessment.title}
                </span>
                <span className="text-sm font-normal text-gray-500">
                  {payload.activeStudentsCount} in progress · {submittedCount} submitted · threshold{" "}
                  {payload.thresholdSeconds}s
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 space-y-1 pt-0">
              <p>
                {payload.assessment.moduleCode} — {payload.assessment.moduleName}
              </p>
              <p>
                {payload.assessment.startTime
                  ? `Start: ${new Date(payload.assessment.startTime).toLocaleString()}`
                  : "Start: —"}{" "}
                ·{" "}
                {payload.assessment.endTime
                  ? `End: ${new Date(payload.assessment.endTime).toLocaleString()}`
                  : "End: —"}
              </p>
            </CardContent>
          </Card>

          <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 sm:p-6 shadow-sm">
            <p className="text-xs text-gray-500 mb-4 text-center sm:text-left">
              <span className="inline-block w-3 h-3 rounded-sm bg-green-500 align-middle mr-1.5" />
              Active (on exam tab)
              <span className="mx-3">·</span>
              <span className="inline-block w-3 h-3 rounded-sm bg-blue-600 align-middle mr-1.5" />
              Submitted
              <span className="mx-3">·</span>
              <span className="inline-block w-3 h-3 rounded-sm bg-red-500 align-middle mr-1.5 animate-pulse" />
              Suspicious (tab away ≥ threshold)
            </p>

            {rows.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No students to show yet.</p>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:gap-4 max-w-[420px] mx-auto sm:max-w-2xl sm:mx-auto md:max-w-3xl">
                {rows.map((row, index) => {
                  const n = index + 1;
                  const submitted = row.participationPhase === "submitted";
                  const suspicious = row.participationPhase === "active" && row.isSuspicious;
                  const titleSubmitted =
                    row.submittedAt != null
                      ? `Submitted: ${new Date(row.submittedAt).toLocaleString()}`
                      : "Submitted";
                  const title =
                    submitted || row.statusColor === "blue"
                      ? `${row.studentName}\n${row.studentEmail}\n${titleSubmitted}`
                      : `${row.studentName}\n${row.studentEmail}\nOutside tab: ${row.outsideDurationSeconds}s · Q${row.currentQuestionIndex + 1}`;
                  const tileClasses = suspicious
                    ? "bg-red-500 border-red-700 text-white animate-pulse"
                    : submitted || row.statusColor === "blue"
                      ? "bg-blue-600 border-blue-800 text-white"
                      : "bg-green-500 border-green-700 text-gray-900";

                  return (
                    <div
                      key={`${row.studentId}-${row.attemptId}`}
                      title={title}
                      className={[
                        "aspect-square rounded-2xl flex flex-col items-center justify-center",
                        "shadow-md select-none cursor-default",
                        "border-2 transition-transform hover:scale-[1.02]",
                        tileClasses,
                      ].join(" ")}
                    >
                      <span
                        className={`text-3xl sm:text-4xl font-bold tabular-nums leading-none ${
                          suspicious || submitted ? "text-white" : "text-gray-900"
                        }`}
                      >
                        {n}
                      </span>
                      <span
                        className={`mt-2 px-1 text-center text-[10px] sm:text-xs font-semibold leading-tight line-clamp-2 max-w-full ${
                          suspicious || submitted ? "text-white/95" : "text-gray-900/90"
                        }`}
                      >
                        {shortLabel(row.studentName)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
