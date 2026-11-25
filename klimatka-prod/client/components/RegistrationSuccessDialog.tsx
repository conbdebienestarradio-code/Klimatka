import { Check } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  open: boolean;
  title: string;
  description: string;
  onOpenChange: (open: boolean) => void;
};

export default function RegistrationSuccessDialog({ open, title, description, onOpenChange }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="registration-success-dialog">
        <AlertDialogHeader className="registration-success-header">
          <span className="registration-success-icon" aria-hidden="true"><Check size={24} strokeWidth={2.5} /></span>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="registration-success-description">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="registration-success-footer">
          <AlertDialogAction className="registration-success-action">Entendido</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
