import { Suspense } from "react";
import ConfirmEmail from "./ConfirmEmail";

// /confirm-email?token=...: the link in the welcome email after signing up.
export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmEmail />
    </Suspense>
  );
}
