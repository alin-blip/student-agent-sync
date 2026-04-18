import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE_MS = 5 * 60 * 1000; // Show warning 5 min before

export function IdleTimeoutDialog() {
  const { user, signOut } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSec, setRemainingSec] = useState(300);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAllTimers = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
  }, []);

  const resetTimers = useCallback(() => {
    if (!user) return;
    clearAllTimers();
    setShowWarning(false);

    // Warning at 25 min
    warningTimer.current = setTimeout(() => {
      setShowWarning(true);
      setRemainingSec(Math.floor(WARNING_BEFORE_MS / 1000));
      countdownInterval.current = setInterval(() => {
        setRemainingSec((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS);

    // Logout at 30 min
    idleTimer.current = setTimeout(() => {
      signOut();
    }, IDLE_TIMEOUT_MS);
  }, [user, signOut, clearAllTimers]);

  useEffect(() => {
    if (!user) return;

    const events = ["mousedown", "keydown", "touchstart", "scroll", "mousemove"];
    
    let throttled = false;
    const handleActivity = () => {
      if (throttled) return;
      throttled = true;
      setTimeout(() => { throttled = false; }, 5000);
      resetTimers();
    };

    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));
    resetTimers();

    return () => {
      events.forEach((e) => window.removeEventListener(e, handleActivity));
      clearAllTimers();
    };
  }, [user, resetTimers, clearAllTimers]);

  const handleStayActive = () => {
    resetTimers();
  };

  if (!user) return null;

  const minutes = Math.floor(remainingSec / 60);
  const seconds = remainingSec % 60;

  return (
    <AlertDialog open={showWarning}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Session Expiring</AlertDialogTitle>
          <AlertDialogDescription>
            You've been inactive. Your session will expire in{" "}
            <strong>{minutes}:{seconds.toString().padStart(2, "0")}</strong> for security purposes.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={handleStayActive}>Stay Logged In</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
