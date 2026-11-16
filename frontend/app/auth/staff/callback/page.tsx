import { Suspense } from "react";
import FigbloomCallback from "../../FigbloomCallback";

// Back from Figbloom staff sign-in (the staff pool).
export default function FigbloomStaffCallbackPage() {
  return (
    <Suspense fallback={null}>
      <FigbloomCallback pool="staff" />
    </Suspense>
  );
}
