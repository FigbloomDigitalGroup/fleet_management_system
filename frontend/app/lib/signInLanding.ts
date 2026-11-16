// Where someone lands after signing in, and the welcome they see: the same
// for Fleet's own sign-in form and for Figbloom sign-in (/auth/callback).
import { isSafeReturnPath } from "../context/AuthContext";
import { redirectPathForRole, roleLabel } from "./roleRedirect";
import { notifySuccess } from "./notify";
import { Role, User } from "../types/auth";

// After a session timeout (or a link opened while signed out) the sign-in
// carries next=<page>; go back there if it's in this person's area.
// Starting a new fleet and invitation links work for everyone.
export function returnPathFor(role: Role | null, next: string | null): string | null {
  if (!isSafeReturnPath(next)) return null;
  if (next.startsWith("/new-fleet") || next.startsWith("/invite/")) return next;
  if (!role) return null;
  const area = redirectPathForRole(role).split("/")[1];
  return next === `/${area}` || next.startsWith(`/${area}/`) || next.startsWith("/help") ? next : null;
}

// "Welcome" the first time someone signs in on this browser, "Welcome back"
// after that.
function firstSignInHere(userId: string) {
  try {
    const key = `fleet:signed-in-before:${userId}`;
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, "1");
    return true;
  } catch {
    return false;
  }
}

// Shows the welcome; -> the page to go to.
export function landAfterSignIn(user: User, next: string | null): string {
  const signedInAs = roleLabel(user.role, user.adminAccess);
  const firstName = user.fullName?.split(" ")[0];
  const greeting = firstSignInHere(user.id) ? "Welcome" : "Welcome back";
  const welcome = firstName ? `${greeting}, ${firstName}.` : `${greeting}.`;
  const staffNote = "This is a Figbloom staff account: you see every customer fleet and can open any of them read-only.";
  const where = user.companyName ? ` in ${user.companyName}` : "";
  if (user.role) notifySuccess(user.role === "PLATFORM_ADMIN" ? `${welcome} ${staffNote}` : welcome, `Signed in as ${signedInAs}${where}`);
  return returnPathFor(user.role, next) ?? redirectPathForRole(user.role);
}
