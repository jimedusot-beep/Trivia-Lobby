import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";

interface TimerBarProps {
  durationMs: number;
  serverStartTs: number;
  onExpire?: () => void;
}

export function TimerBar({ durationMs, serverStartTs, onExpire }: TimerBarProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!serverStartTs || !durationMs) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - serverStartTs;
      const remaining = Math.max(0, durationMs - elapsed);
      const percentage = (remaining / durationMs) * 100;

      setProgress(percentage);

      if (remaining <= 0) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [serverStartTs, durationMs, onExpire]);

  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-muted-foreground">
        <span>Time Remaining</span>
      </div>
      <Progress value={progress} className="h-4 rounded-full bg-slate-200" />
    </div>
  );
}
