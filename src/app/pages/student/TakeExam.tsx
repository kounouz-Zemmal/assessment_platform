import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { AlertCircle } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { ExamTimer } from "../../components/ExamTimer";
import { toast } from "sonner";
import { apiGet, apiPatch, apiPost } from "../../apiClient";
import {
  clearDraft,
  clearSessionState,
  enqueueOutbox,
  listOutbox,
  readDraft,
  readSessionState,
  removeOutboxItem,
  saveSessionState,
  saveDraft,
} from "../../services/examPersistence";

export default function StudentTakeExam() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [payload, setPayload] = useState<any | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [lastSaved, setLastSaved] = useState(new Date());
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [examClock, setExamClock] = useState<{ startedAtMs: number; durationSeconds: number } | null>(null);
  const [tabWarningShown, setTabWarningShown] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [questionRemainingSeconds, setQuestionRemainingSeconds] = useState<number | null>(null);
  const [questionClockStartedAtMs, setQuestionClockStartedAtMs] = useState<number | null>(null);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing">("idle");
  const [recovering, setRecovering] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const hiddenStartedAtRef = useRef<number | null>(null);
  const assessment = payload?.assessment;
  const assessmentQuestions = payload?.questions || [];
  const configuredDurationSeconds = Number(assessment?.duration ?? 0) * 60;

  const sendProctoringEvent = async (
    event: "heartbeat" | "tab_hidden" | "tab_visible",
    overrides?: Partial<{ outsideDurationSeconds: number; visibilityState: string }>,
  ) => {
    if (!id || !navigator.onLine) return;
    try {
      await apiPost(`student/assessments/${id}/attempt/proctoring`, {
        event,
        currentQuestionIndex,
        outsideDurationSeconds: overrides?.outsideDurationSeconds ?? 0,
        visibilityState: overrides?.visibilityState ?? (document.hidden ? "hidden" : "visible"),
      });
    } catch {
      // Keep exam flow uninterrupted if proctoring telemetry fails.
    }
  };

  const refreshAttemptFromServer = async (preserveQuestionIndex = true) => {
    if (!id || !navigator.onLine) return;
    const data = await apiGet<any>(`student/assessments/${id}/attempt`).catch(async () =>
      apiPost<any>(`student/assessments/${id}/attempt/start`, {}),
    );
    setPayload(data);

    const serverAnswers = (data?.questions || []).reduce((acc: Record<string, string>, q: any) => {
      acc[q.id] = q.answer || "";
      return acc;
    }, {});
    const cached = (await readSessionState(id).catch(() => null)) || readDraft<any>(id);
    // Keep local in-memory/cache answers authoritative on reconnect.
    const mergedAnswers = { ...serverAnswers, ...(cached?.answers || {}), ...answers };
    setAnswers(mergedAnswers);

    const fallbackDurationSeconds = Number(cached?.durationSeconds || Number(data?.assessment?.duration ?? 0) * 60);
    const serverRemainingSeconds = Number(data?.attempt?.remainingSeconds);
    // Trust backend remainingSeconds directly (already capped by assessment end window).
    // This avoids client-side drift for late joiners.
    const durationSeconds = Number.isFinite(serverRemainingSeconds)
      ? Math.max(0, Math.floor(serverRemainingSeconds))
      : fallbackDurationSeconds;
    const startedAtMs =
      Number.isFinite(serverRemainingSeconds)
        ? Date.now()
        : data?.attempt?.startTime
          ? new Date(data.attempt.startTime).getTime()
          : Number(cached?.startedAtMs || Date.now());
    setExamClock({ startedAtMs, durationSeconds });

    const restoredIndex = preserveQuestionIndex
      ? Number(currentQuestionIndex ?? cached?.currentQuestionIndex ?? 0)
      : Number(cached?.currentQuestionIndex ?? 0);
    setCurrentQuestionIndex(Math.max(0, restoredIndex));

    const questionStart = Number(cached?.questionStartedAtMs || Date.now());
    const questionLimit = Number(data?.questions?.[Math.max(0, restoredIndex)]?.questionTimeLimitSeconds ?? 0);
    setQuestionClockStartedAtMs(questionStart);
    await persistExamSnapshot(mergedAnswers, Math.max(0, restoredIndex), data, questionStart, questionLimit || null);
  };

  const persistExamSnapshot = async (
    nextAnswers: Record<string, string>,
    questionIndex: number,
    payloadData: any,
    questionStartedAtMs?: number | null,
    questionTimeLimitSeconds?: number | null,
  ) => {
    if (!id) return;
    const startedAtMs = examClock?.startedAtMs
      ?? (payloadData?.attempt?.startTime
        ? new Date(payloadData.attempt.startTime).getTime()
        : Date.now());
    const durationSeconds = examClock?.durationSeconds ?? (Number(payloadData?.assessment?.duration ?? 0) * 60);
    const snapshot = {
      answers: nextAnswers,
      currentQuestionIndex: questionIndex,
      examSnapshot: payloadData,
      startedAtMs,
      durationSeconds,
      questionStartedAtMs: questionStartedAtMs ?? undefined,
      questionTimeLimitSeconds: questionTimeLimitSeconds ?? undefined,
      updatedAt: new Date().toISOString(),
    };
    saveDraft(id, snapshot);
    await saveSessionState({
      assessmentId: id,
      answers: nextAnswers,
      currentQuestionIndex: questionIndex,
      startedAtMs,
      durationSeconds,
      questionStartedAtMs: snapshot.questionStartedAtMs,
      questionTimeLimitSeconds: snapshot.questionTimeLimitSeconds,
      examSnapshot: payloadData,
      updatedAt: snapshot.updatedAt,
    });
  };

  const syncOutbox = async () => {
    if (!navigator.onLine || !id) return;
    setSyncStatus("syncing");
    let submitSynced = false;
    const items = await listOutbox();
    for (const item of items.filter((row) => row.assessmentId === id)) {
      try {
        if (item.kind === "submit") {
          await apiPost(`student/assessments/${id}/attempt/submit`, {
            answers: item.answers,
            autoSubmitted: item.autoSubmitted,
          });
          clearDraft(id);
          await clearSessionState(id);
          submitSynced = true;
        } else {
          await apiPatch(`student/assessments/${id}/attempt/save`, { answers: item.answers });
        }
        await removeOutboxItem(item.key);
      } catch {
        setSyncStatus("idle");
        return;
      }
    }
    setSyncStatus("idle");
    if (submitSynced) {
      toast.success("Assessment submitted automatically after reconnection.");
      navigate(`/student/assessments/${id}/results`, { replace: true });
    }
  };

  useEffect(() => {
    if (!id) return;
    const restoreLocalSession = async () => {
      const session = await readSessionState(id).catch(() => null);
      return session || readDraft<any>(id);
    };
    let cached: any = null;
    let hasCachedSession = false;
    void restoreLocalSession().then((local) => {
      cached = local;
      if (cached?.examSnapshot) {
        hasCachedSession = true;
        setPayload(cached.examSnapshot);
        setAnswers(cached.answers || {});
        setCurrentQuestionIndex(Number(cached.currentQuestionIndex || 0));
        if (cached.startedAtMs && cached.durationSeconds) {
          setExamClock({
            startedAtMs: Number(cached.startedAtMs),
            durationSeconds: Number(cached.durationSeconds),
          });
        }
        if (cached.questionStartedAtMs) {
          setQuestionClockStartedAtMs(Number(cached.questionStartedAtMs));
        }
      }

      if (!navigator.onLine && hasCachedSession) {
        setIsInitialLoading(false);
        return;
      }

      refreshAttemptFromServer(false)
        .then(async () => {
          await syncOutbox();
          setIsInitialLoading(false);
        })
        .catch((error) => {
          setIsInitialLoading(false);
          if (hasCachedSession) return;
          const message = error instanceof Error ? error.message : "Assessment load failed";
          toast.error(message);
        });
    });
  }, [id]);

  useEffect(() => {
    const attemptStatus = String(payload?.attempt?.status || "").toUpperCase();
    if (!attemptStatus) return;
    // Backend may return either enum-style (IN_PROGRESS) or label-style (In Progress).
    if (attemptStatus === "IN_PROGRESS" || attemptStatus === "IN PROGRESS") return;
    if (attemptStatus === "SUBMITTED" || attemptStatus === "AUTO_GRADED" || attemptStatus === "MANUALLY_GRADED" || attemptStatus === "FINALIZED" || attemptStatus === "GRADED") {
      navigate(`/student/assessments/${id}/results`, { replace: true });
      return;
    }
  }, [payload?.attempt?.status, navigate]);

  useEffect(() => {
    if (!examClock) return;
    const updateRemaining = () => {
      const elapsedSeconds = Math.floor((Date.now() - examClock.startedAtMs) / 1000);
      setRemainingSeconds(Math.max(0, examClock.durationSeconds - elapsedSeconds));
    };
    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [examClock]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (recovering) return;
      setRecovering(true);
      void (async () => {
        try {
          // First flush pending offline writes; do not disrupt current UI state.
          await syncOutbox();
          // Only refresh from server when payload is missing.
          if (!payload) {
            await refreshAttemptFromServer(true);
          } else if (id) {
            // Persist current state again after reconnect to avoid stale cache overwrite.
            await persistExamSnapshot(
              answers,
              currentQuestionIndex,
              payload,
              questionClockStartedAtMs ?? Date.now(),
              Number(assessmentQuestions?.[currentQuestionIndex]?.questionTimeLimitSeconds ?? 0) || null,
            );
          }
        } finally {
          setRecovering(false);
        }
      })();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [id, recovering, payload, answers, currentQuestionIndex, questionClockStartedAtMs, assessmentQuestions]);

  const currentQuestion = assessmentQuestions[currentQuestionIndex];
  const shuffledOptionsByQuestionId = useMemo(() => {
    if (!assessment?.shuffleAnswers) return {};
    const map: Record<string, string[]> = {};
    assessmentQuestions.forEach((q: any) => {
      if (Array.isArray(q.options)) {
        map[q.id] = [...q.options];
      }
    });
    return map;
  }, [assessment, assessmentQuestions]);

  useEffect(() => {
    const markAway = () => {
      if (hiddenStartedAtRef.current === null) {
        hiddenStartedAtRef.current = Date.now();
      }
      void sendProctoringEvent("tab_hidden", { visibilityState: "hidden" });
    };

    const markBack = () => {
      const awaySeconds = hiddenStartedAtRef.current
        ? Math.floor((Date.now() - hiddenStartedAtRef.current) / 1000)
        : 0;
      hiddenStartedAtRef.current = null;
      void sendProctoringEvent("tab_visible", {
        outsideDurationSeconds: Math.max(0, awaySeconds),
        visibilityState: "visible",
      });
    };

    const handleVisibilityChange = () => {
      if (assessment?.tabSwitchWarning && document.hidden && !tabWarningShown) {
        setTabWarningShown(true);
        toast.warning("Tab switch detected. Please stay on the exam page to avoid issues.", {
          duration: 4000,
        });
      }
      if (document.hidden) {
        markAway();
      } else {
        markBack();
      }
    };

    // Extra listeners ensure detection is captured for same-browser tab/app switches.
    const handleBlur = () => markAway();
    const handleFocus = () => markBack();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, [assessment?.tabSwitchWarning, tabWarningShown]);

  useEffect(() => {
    if (!id) return;
    void sendProctoringEvent("heartbeat");
    const interval = setInterval(() => {
      const outsideSeconds = hiddenStartedAtRef.current
        ? Math.floor((Date.now() - hiddenStartedAtRef.current) / 1000)
        : 0;
      void sendProctoringEvent("heartbeat", {
        outsideDurationSeconds: Math.max(0, outsideSeconds),
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [id, currentQuestionIndex]);

  useEffect(() => {
    const limit = Number(currentQuestion?.questionTimeLimitSeconds ?? 0);
    if (!assessment?.perQuestionTimerEnabled || !limit || isLocked) {
      setQuestionRemainingSeconds(null);
      return;
    }
    const startedAt = questionClockStartedAtMs ?? Date.now();
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    setQuestionRemainingSeconds(Math.max(0, limit - elapsed));
  }, [
    assessment?.perQuestionTimerEnabled,
    currentQuestion?.questionTimeLimitSeconds,
    currentQuestionIndex,
    questionClockStartedAtMs,
    isLocked,
  ]);

  useEffect(() => {
    if (!assessment?.perQuestionTimerEnabled || questionRemainingSeconds === null || isLocked) return;
    if (questionRemainingSeconds <= 0) {
      if (assessment?.perQuestionTimeoutBehavior === "lock") {
        setIsLocked(true);
        toast.error("Question timer expired. Exam is locked.");
        return;
      }
      if (currentQuestionIndex < assessmentQuestions.length - 1) {
        const nextIndex = currentQuestionIndex + 1;
        const nextQuestionLimit = Number(assessmentQuestions[nextIndex]?.questionTimeLimitSeconds ?? 0);
        const nextQuestionStartedAtMs = Date.now();
        setCurrentQuestionIndex(nextIndex);
        setQuestionClockStartedAtMs(nextQuestionStartedAtMs);
        void persistExamSnapshot(
          answers,
          nextIndex,
          payload,
          nextQuestionStartedAtMs,
          nextQuestionLimit || null,
        );
        toast.warning("Question timer expired. Moved to next question.");
      }
      return;
    }
    const timer = setInterval(() => {
      setQuestionRemainingSeconds((prev) => (prev === null ? prev : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [
    answers,
    assessment?.perQuestionTimerEnabled,
    assessment?.perQuestionTimeoutBehavior,
    assessmentQuestions.length,
    currentQuestionIndex,
    isLocked,
    payload,
    questionRemainingSeconds,
  ]);

  if (isInitialLoading || !payload) {
    return <div className="p-8 text-gray-500">Loading assessment...</div>;
  }
  if (!assessment) {
    return <div className="p-8 text-gray-500">Unable to load assessment right now.</div>;
  }
  if (assessmentQuestions.length === 0) {
    return <div className="p-8">This assessment has no questions configured yet.</div>;
  }

  const handleAnswerChange = async (questionId: string, answer: string) => {
    const next = { ...answers, [questionId]: answer };
    setAnswers(next);
    setLastSaved(new Date());
    if (!id) return;
    await persistExamSnapshot(
      next,
      currentQuestionIndex,
      payload,
      questionClockStartedAtMs ?? Date.now(),
      Number(currentQuestion?.questionTimeLimitSeconds ?? 0) || null,
    );
    if (!navigator.onLine) {
      await enqueueOutbox({ assessmentId: id, kind: "save", answers: next });
      return;
    }
    try {
      await apiPatch(`student/assessments/${id}/attempt/save`, { answers: next });
    } catch {
      await enqueueOutbox({ assessmentId: id, kind: "save", answers: next });
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < assessmentQuestions.length - 1) {
      const nextIndex = currentQuestionIndex + 1;
      const nextQuestionLimit = Number(assessmentQuestions[nextIndex]?.questionTimeLimitSeconds ?? 0);
      const nextQuestionStartedAtMs = Date.now();
      setCurrentQuestionIndex(nextIndex);
      setQuestionClockStartedAtMs(nextQuestionStartedAtMs);
      void persistExamSnapshot(
        answers,
        nextIndex,
        payload,
        nextQuestionStartedAtMs,
        nextQuestionLimit || null,
      );
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      const nextIndex = currentQuestionIndex - 1;
      const nextQuestionLimit = Number(assessmentQuestions[nextIndex]?.questionTimeLimitSeconds ?? 0);
      const nextQuestionStartedAtMs = Date.now();
      setCurrentQuestionIndex(nextIndex);
      setQuestionClockStartedAtMs(nextQuestionStartedAtMs);
      void persistExamSnapshot(
        answers,
        nextIndex,
        payload,
        nextQuestionStartedAtMs,
        nextQuestionLimit || null,
      );
    }
  };

  const handleSubmit = async (autoSubmitted = false) => {
    if (!id || submitting) return;
    if (isTimedOut) {
      toast.error("Time is over. Exam not submitted.");
      return;
    }
    setSubmitting(true);
    try {
      if (!navigator.onLine) {
        await enqueueOutbox({ assessmentId: id, kind: "submit", answers, autoSubmitted });
        toast.info("Submission queued locally. It will auto-sync when connection is restored.");
        setSubmitting(false);
        return;
      } else {
        await apiPost(`student/assessments/${id}/attempt/submit`, { answers, autoSubmitted });
        clearDraft(id);
        await clearSessionState(id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Submission failed";
      const networkLikeError =
        !navigator.onLine ||
        message.toLowerCase().includes("failed to fetch") ||
        message.toLowerCase().includes("network");
      if (networkLikeError) {
        await enqueueOutbox({ assessmentId: id, kind: "submit", answers, autoSubmitted });
        toast.info("Submission queued due to connectivity issue. You can continue on this page.");
      } else {
        toast.error(message);
      }
      setSubmitting(false);
      return;
    }
    toast.success("Assessment submitted successfully!");
    setSubmitting(false);
    navigate(`/student/assessments/${id}/results`, { replace: true });
  };

  const handleTimeUp = () => {
    setIsLocked(true);
    setIsTimedOut(true);
    toast.error("Time's up! Exam not submitted.");
    navigate("/student/assessments", { replace: true });
  };

  const answeredCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fixed Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{assessment.title}</h1>
            <p className="text-sm text-gray-500">{assessment.moduleCode}</p>
            <p className={`text-xs mt-1 ${isOnline ? "text-green-600" : "text-amber-600"}`}>
              {isOnline
                ? (syncStatus === "syncing" ? "Connection restored. Syncing..." : "Online")
                : "You are offline. Your progress is stored locally."}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500">
              Last saved: {lastSaved.toLocaleTimeString()}
            </div>
            <ExamTimer
              remainingSeconds={remainingSeconds}
              totalSeconds={configuredDurationSeconds > 0 ? configuredDurationSeconds : null}
              paused={isLocked}
              onTimeUp={handleTimeUp}
            />
            {assessment?.perQuestionTimerEnabled &&
              questionRemainingSeconds !== null && (
                <div className="rounded border px-3 py-2 text-sm text-gray-700">
                  Q Timer: {Math.max(0, questionRemainingSeconds)}s
                </div>
              )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Question Navigator */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="text-base">Questions</CardTitle>
                <p className="text-sm text-gray-500">
                  {answeredCount} of {assessmentQuestions.length} answered
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 lg:grid-cols-4 gap-2">
                  {assessmentQuestions.map((q, index) => (
                    <button
                      key={q.id}
                      onClick={() => {
                        const clickedQuestionLimit = Number(assessmentQuestions[index]?.questionTimeLimitSeconds ?? 0);
                        const clickedQuestionStartedAtMs = Date.now();
                        setCurrentQuestionIndex(index);
                        setQuestionClockStartedAtMs(clickedQuestionStartedAtMs);
                        void persistExamSnapshot(
                          answers,
                          index,
                          payload,
                          clickedQuestionStartedAtMs,
                          clickedQuestionLimit || null,
                        );
                      }}
                      className={`aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${
                        index === currentQuestionIndex
                          ? "bg-blue-600 text-white"
                          : answers[q.id]
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Question Display */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline">
                        Question {currentQuestionIndex + 1} of {assessmentQuestions.length}
                      </Badge>
                      <Badge variant="outline">{currentQuestion.type}</Badge>
                      <Badge variant="secondary">{currentQuestion.points} points</Badge>
                    </div>
                    <CardTitle className="text-lg">{currentQuestion.text}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Answer Input */}
                {(currentQuestion.type === "MCQ" || currentQuestion.type === "SCQ") && (
                  <RadioGroup
                    value={answers[currentQuestion.id] || ""}
                    onValueChange={(value) => void handleAnswerChange(currentQuestion.id, value)}
                    disabled={isLocked}
                  >
                    <div className="space-y-3">
                      {(shuffledOptionsByQuestionId[currentQuestion.id] || currentQuestion.options || []).map((option, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50"
                        >
                          <RadioGroupItem value={option} id={`${currentQuestion.id}-${index}`} />
                          <Label
                            htmlFor={`${currentQuestion.id}-${index}`}
                            className="flex-1 cursor-pointer"
                          >
                            {option}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                )}

                {(currentQuestion.type === "True/False" || currentQuestion.type === "TRUE_FALSE") && (
                  <RadioGroup
                    value={answers[currentQuestion.id] || ""}
                    onValueChange={(value) => void handleAnswerChange(currentQuestion.id, value)}
                    disabled={isLocked}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50">
                        <RadioGroupItem value="True" id={`${currentQuestion.id}-true`} />
                        <Label
                          htmlFor={`${currentQuestion.id}-true`}
                          className="flex-1 cursor-pointer"
                        >
                          True
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50">
                        <RadioGroupItem value="False" id={`${currentQuestion.id}-false`} />
                        <Label
                          htmlFor={`${currentQuestion.id}-false`}
                          className="flex-1 cursor-pointer"
                        >
                          False
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>
                )}

                {(currentQuestion.type === "Descriptive" || currentQuestion.type === "DESCRIPTIVE") && (
                  <div className="space-y-2">
                    <Label htmlFor="answer">Your Answer</Label>
                    <Textarea
                      id="answer"
                      value={answers[currentQuestion.id] || ""}
                      onChange={(e) => void handleAnswerChange(currentQuestion.id, e.target.value)}
                      placeholder="Type your answer here..."
                      rows={10}
                      className="resize-none"
                      disabled={isLocked}
                    />
                    <p className="text-sm text-gray-500">
                      Write a detailed answer. Your response will be evaluated based on key concepts.
                    </p>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between pt-6 border-t">
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={currentQuestionIndex === 0}
                  >
                    Previous
                  </Button>

                  {currentQuestionIndex < assessmentQuestions.length - 1 ? (
                    <Button onClick={handleNext}>
                      Next Question
                    </Button>
                  ) : (
                    <>
                      <Button onClick={() => setShowSubmitDialog(true)}>
                        Submit Assessment
                      </Button>

                      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Submit Assessment?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {answeredCount < assessmentQuestions.length && (
                                <div className="flex items-start gap-2 mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                                  <div>
                                    <p className="text-sm text-yellow-800">
                                      You have answered {answeredCount} out of {assessmentQuestions.length} questions.
                                    </p>
                                  </div>
                                </div>
                              )}
                              Are you sure you want to submit your assessment? You will not be able to change your answers after submission.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Review Answers</AlertDialogCancel>
                            <AlertDialogAction onClick={() => void handleSubmit(false)} disabled={submitting || isTimedOut}>
                              Yes, Submit
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
