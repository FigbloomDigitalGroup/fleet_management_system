import { Suspense } from "react";
import FigbloomCallback from "../FigbloomCallback";

// Back from Figbloom's sign-in page (customers: owners, admins, team).
export default function FigbloomCallbackPage() {
  return (
    <Suspense fallback={null}>
      <FigbloomCallback pool="customers" />
    </Suspense>
  );
}
