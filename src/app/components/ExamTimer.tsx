import { useEffect, useState } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Clock } from "lucide-react";

interface ExamTimerProps {
  remainingSeconds: number | null;
  totalSeconds?: number | null;
  onTimeUp: () => void;
  paused?: boolean;
}

export function ExamTimer({ remainingSeconds, totalSeconds = null, onTimeUp, paused = false }: ExamTimerProps) {
  useEffect(() => {
    if (remainingSeconds === null) return;
    if (!paused && remainingSeconds <= 0) {
      onTimeUp();
    }
  }, [paused, remainingSeconds, onTimeUp]);

  const boundedSeconds =
    remainingSeconds === null ? null : Math.max(0, Number(remainingSeconds || 0));
  const minutes = boundedSeconds === null ? 0 : Math.floor(boundedSeconds / 60);
  const seconds = boundedSeconds === null ? 0 : boundedSeconds % 60;

  // Show warning only after 80% of allotted exam time has passed (last 20% remaining).
  const lowTimeThresholdSeconds =
    totalSeconds && totalSeconds > 0 ? Math.floor(totalSeconds * 0.2) : null;
  const isLowTime =
    boundedSeconds !== null &&
    lowTimeThresholdSeconds !== null &&
    boundedSeconds <= lowTimeThresholdSeconds;

  return (
    <Card className={`${isLowTime ? "border-red-500 bg-red-50" : ""}`}>
      <CardContent className="flex items-center gap-2 py-3">
        <Clock className={`h-5 w-5 ${isLowTime ? "text-red-600" : "text-muted-foreground"}`} />
        <div className={`text-lg font-mono font-semibold ${isLowTime ? "text-red-600" : ""}`}>
          {boundedSeconds === null
            ? "--:--"
            : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`}
        </div>
        {isLowTime && (
          <span className="text-xs text-red-600 ml-2">Time running out!</span>
        )}
      </CardContent>
    </Card>
  );
}
