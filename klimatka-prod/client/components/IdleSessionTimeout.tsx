import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  appLogout,
  isDemoMode,
  subscribeToPendingWrites,
} from "../lib/demo-api";
import { supabase } from "../lib/supabase";

const warningAfterMs = 150_000;
const signOutAfterMs = 180_000;

export default function IdleSessionTimeout() {
  const navigate = useNavigate();
  const demoMode = isDemoMode();
  const [authenticated, setAuthenticated] = useState(false);
  const [warningOpen, setWarningOpen] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(30);
  const [pendingWriteCount, setPendingWriteCount] = useState(0);
  const lastActivityAt = useRef(0);
  const warningOpenRef = useRef(false);
  const pendingWriteCountRef = useRef(0);
  const signOutStarted = useRef(false);

  useEffect(
    () =>
      subscribeToPendingWrites((count) => {
        pendingWriteCountRef.current = count;
        setPendingWriteCount(count);
      }),
    [],
  );

  useEffect(() => {
    if (!supabase || demoMode) return;
    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const hasSession = Boolean(session);
      setAuthenticated(hasSession);
      if (hasSession && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        lastActivityAt.current = Date.now();
        signOutStarted.current = false;
        warningOpenRef.current = false;
        setWarningOpen(false);
      } else if (!hasSession) {
        warningOpenRef.current = false;
        setWarningOpen(false);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const hasSession = Boolean(data.session);
      setAuthenticated(hasSession);
      if (hasSession) lastActivityAt.current = Date.now();
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [demoMode]);

  useEffect(() => {
    if (!authenticated || demoMode) return;

    const recordActivity = () => {
      if (!warningOpenRef.current) lastActivityAt.current = Date.now();
    };
    const events: (keyof WindowEventMap)[] = [
      "pointerdown",
      "keydown",
      "mousemove",
      "scroll",
      "touchstart",
    ];
    events.forEach((event) =>
      window.addEventListener(event, recordActivity, { passive: true }),
    );

    const timer = window.setInterval(() => {
      const idleFor = Date.now() - lastActivityAt.current;
      const shouldWarn = idleFor >= warningAfterMs;
      if (shouldWarn !== warningOpenRef.current) {
        warningOpenRef.current = shouldWarn;
        setWarningOpen(shouldWarn);
      }
      setSecondsRemaining(
        Math.max(0, Math.ceil((signOutAfterMs - idleFor) / 1000)),
      );

      if (
        idleFor >= signOutAfterMs &&
        pendingWriteCountRef.current === 0 &&
        !signOutStarted.current
      ) {
        signOutStarted.current = true;
        void appLogout().then(() => navigate("/login", { replace: true }));
      }
    }, 1000);

    return () => {
      window.clearInterval(timer);
      events.forEach((event) =>
        window.removeEventListener(event, recordActivity),
      );
    };
  }, [authenticated, demoMode, navigate]);

  const keepSessionOpen = () => {
    lastActivityAt.current = Date.now();
    warningOpenRef.current = false;
    setWarningOpen(false);
    setSecondsRemaining(30);
  };

  const signOut = async () => {
    if (pendingWriteCountRef.current > 0 || signOutStarted.current) return;
    signOutStarted.current = true;
    await appLogout();
    navigate("/login", { replace: true });
  };

  if (!authenticated || demoMode) return null;

  return (
    <AlertDialog open={warningOpen} onOpenChange={setWarningOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Mantener la sesión abierta?</AlertDialogTitle>
          <AlertDialogDescription>
            {pendingWriteCount > 0 && secondsRemaining === 0
              ? "Hay un guardado en curso. La sesión se cerrará cuando termine."
              : `Detectamos inactividad. Guarda tus cambios pendientes o mantén la sesión abierta. Cerraremos tu sesión en ${secondsRemaining} segundos si no confirmas.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={pendingWriteCount > 0}
            onClick={signOut}
          >
            Cerrar sesión
          </AlertDialogCancel>
          <AlertDialogAction onClick={keepSessionOpen}>
            Mantener sesión abierta
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}