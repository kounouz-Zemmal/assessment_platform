import { useEffect, useState } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Clock } from "lucide-react";

interface ExamTimerProps {
  durationMinutes: number;
  onTimeUp: () => void;
  startTime?: Date;
}

export function ExamTimer({ durationMinutes, onTimeUp, startTime = new Date() }: ExamTimerProps) {
  const [timeLeft, setTimeLeft] = useState(durationMinutes * 60);

  useEffect(() => {
    if (timeLeft <= 0) {
      onTimeUp();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onTimeUp]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const isLowTime = timeLeft < 300; // Less than 5 minutes

  return (
    <Card className={`${isLowTime ? "border-red-500 bg-red-50" : ""}`}>
      <CardContent className="flex items-center gap-2 py-3">
        <Clock className={`h-5 w-5 ${isLowTime ? "text-red-600" : "text-muted-foreground"}`} />
        <div className={`text-lg font-mono font-semibold ${isLowTime ? "text-red-600" : ""}`}>
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </div>
        {isLowTime && (
          <span className="text-xs text-red-600 ml-2">Time running out!</span>
        )}
      </CardContent>
    </Card>
  );
}
