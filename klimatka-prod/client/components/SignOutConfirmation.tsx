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
import { appLogout } from "../lib/demo-api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logoutHref: string;
};

export default function SignOutConfirmation({ open, onOpenChange, logoutHref }: Props) {
  function confirmSignOut() {
    void appLogout().finally(() => window.location.assign(logoutHref));
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sign-out-confirmation">
        <AlertDialogHeader>
          <AlertDialogTitle>¿Quieres cerrar sesión?</AlertDialogTitle>
          <AlertDialogDescription>
            Tendrás que iniciar sesión de nuevo para volver a entrar a Klimatka.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Seguir aquí</AlertDialogCancel>
          <AlertDialogAction className="sign-out-confirmation-action" onClick={confirmSignOut}>
            Sí, cerrar sesión
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
