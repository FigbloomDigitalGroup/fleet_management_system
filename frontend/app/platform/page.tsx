import { redirect } from "next/navigation";

// /platform on its own is the staff home.
export default function PlatformIndex() {
  redirect("/platform/dashboard");
}
