"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { API_URL, ApiError, apiRequest } from "../../lib/api";
import { redirectPathForRole, roleLabel } from "../../lib/roleRedirect";
import { notifySuccess } from "../../lib/notify";
import { AdminAccess, LoginResponse, Role } from "../../types/auth";
import CenteredCard from "../../components/CenteredCard";
import PasswordInput from "../../components/PasswordInput";
import DriverAppBadge from "../../components/DriverAppBadge";

const INPUT = "w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600";
const BUTTON = "w-full rounded bg-orange-500 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60";

interface Invitation {
  state: "open";
  email: string;
  companyName: string;
  role: Role;
  roleTitle: string;
  adminAccess: AdminAccess | null;
  invitedByName: string | null;
  expiresAt: string;
  accountExists: boolean;
}

type Dead = { state: "invalid" | "expired" | "revoked" | "used"; companyName?: string | null; error: string };

const DEAD_TITLES: Record<Dead["state"], string> = {
  invalid: "This link doesn't work",
  expired: "This invitation has expired",
  revoked: "This invitation was cancelled",
  used: "This invitation has already been used",
};

// /invite/<token>: the link in an invitation email (FLEET_MEMBERSHIPS_CONTRACT.md
// section 3). Whoever opens it sees which fleet and role it's for, then:
// - signed in as that email: one button to join;
// - signed in as someone else: told so, with a sign-out button;
// - not signed in, with an account already: their password, to sign in and join;
// - new to FIGBLOOM FLEET: name, phone and a password of their own.
// Expired, cancelled and used links say so plainly.
export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { user, loading, adoptSession, logout } = useAuth();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [dead, setDead] = useState<Dead | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinedNote, setJoinedNote] = useState<{ title: string; message: string; driver: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    // a plain fetch: this page works signed in or not, and shouldn't refresh tokens
    fetch(`${API_URL}/api/invitations/token/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) setInvitation(data as Invitation);
        else setDead({ state: data.state ?? "invalid", companyName: data.companyName, error: data.error ?? "This invitation link isn't valid." });
      })
      .catch(() => !cancelled && setDead({ state: "invalid", error: "We couldn't reach FIGBLOOM FLEET. Check your internet connection and reload the page." }));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const signedInAs = user && !user.support ? user.email : null;
  const sameAccount = !!signedInAs && !!invitation && signedInAs.toLowerCase() === invitation.email;

  async function accept(e?: FormEvent) {
    e?.preventDefault();
    if (!invitation) return;
    setError(null);
    if (!sameAccount) {
      if (!invitation.accountExists && !fullName.trim()) return setError("Please enter your name.");
      if (!invitation.accountExists && password.length < 8) return setError(`Your password needs at least 8 characters (you've typed ${password.length}).`);
      if (invitation.accountExists && !password) return setError("Please enter your password.");
    }
    setBusy(true);
    try {
      const body = sameAccount ? {} : invitation.accountExists ? { password } : { fullName, phone, password };
      const data = await apiRequest<Partial<LoginResponse> & { joined: true; companyName: string; role: Role; message?: string }>(
        `/api/invitations/token/${encodeURIComponent(token)}/accept`,
        { method: "POST", body: JSON.stringify(body), notifyErrors: false, successMessage: false, headers: sameAccount ? {} : { Authorization: "" } }
      );
      if (data.accessToken && data.refreshToken && data.user) {
        adoptSession(data as LoginResponse);
        notifySuccess(`You're now in ${data.companyName} as ${roleLabel(data.user.role, data.user.adminAccess)}.`, "Welcome aboard");
        router.push(redirectPathForRole(data.user.role));
        return;
      }
      setJoinedNote({
        title: `You've joined ${data.companyName}`,
        message: data.message ?? "You can sign in now.",
        driver: data.role === "DRIVER",
      });
    } catch (err) {
      const apiErr = err as ApiError;
      const state = apiErr.data?.state as Dead["state"] | undefined;
      if (state && state in DEAD_TITLES) setDead({ state, companyName: apiErr.data?.companyName as string, error: apiErr.message });
      else setError(apiErr.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (dead) {
    return (
      <CenteredCard title={DEAD_TITLES[dead.state]}>
        <p className="text-sm text-gray-700">{dead.error}</p>
        {dead.companyName && dead.state !== "used" && (
          <p className="mt-2 text-sm text-gray-700">Ask someone at {dead.companyName} to invite you again from their Team page.</p>
        )}
        <Link href="/login" className="mt-5 block rounded border border-gray-300 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50">
          Go to sign in
        </Link>
      </CenteredCard>
    );
  }

  if (joinedNote) {
    return (
      <CenteredCard title={joinedNote.title}>
        <p className="text-sm text-gray-700">{joinedNote.message}</p>
        {joinedNote.driver && (
          <div className="mt-4">
            <DriverAppBadge />
          </div>
        )}
        <Link href="/login" className="mt-5 block rounded border border-gray-300 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50">
          Go to sign in
        </Link>
      </CenteredCard>
    );
  }

  if (!invitation || loading) {
    return (
      <CenteredCard title="Opening your invitation…">
        <p className="text-sm text-gray-500">One moment.</p>
      </CenteredCard>
    );
  }

  const roleName = roleLabel(invitation.role, invitation.adminAccess);
  const intro = (
    <div className="mb-5 rounded border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-900">
      {invitation.invitedByName ? `${invitation.invitedByName} invited you` : "You've been invited"} to join <strong>{invitation.companyName}</strong> as{" "}
      <strong>{roleName.toLowerCase()}</strong>.
      <span className="mt-1 block text-xs text-teal-700">This invitation is for {invitation.email}.</span>
    </div>
  );

  // signed in as someone else
  if (signedInAs && !sameAccount) {
    return (
      <CenteredCard title={`Join ${invitation.companyName}`}>
        {intro}
        <p className="text-sm text-gray-700">
          You&apos;re signed in as <strong>{signedInAs}</strong>, but this invitation is for <strong>{invitation.email}</strong>. Sign out, then open the
          link in the email again.
        </p>
        <button type="button" onClick={() => logout({ returnTo: `/invite/${token}` })} className={`${BUTTON} mt-5`}>
          Sign out
        </button>
      </CenteredCard>
    );
  }

  // signed in as the invited email
  if (sameAccount) {
    return (
      <CenteredCard title={`Join ${invitation.companyName}`}>
        {intro}
        <p className="text-sm text-gray-700">You&apos;ll keep your other fleets. You can move between them with the fleet menu at the top of the page.</p>
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        <button type="button" onClick={() => accept()} disabled={busy} className={`${BUTTON} mt-5`}>
          {busy ? "Joining…" : `Join ${invitation.companyName} as ${roleName.toLowerCase()}`}
        </button>
      </CenteredCard>
    );
  }

  // not signed in
  return (
    <CenteredCard title={`Join ${invitation.companyName}`}>
      {intro}
      <form onSubmit={accept} className="space-y-4">
        {invitation.accountExists ? (
          <>
            <p className="text-sm text-gray-700">
              You already use FIGBLOOM FLEET with this email. Enter your password to join; your other fleets stay as they are.
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Your password</label>
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} autoComplete="current-password" />
            </div>
            <p className="text-xs text-gray-500">
              Forgot it?{" "}
              <Link href={`/forgot-password`} className="text-teal-700 underline">
                Reset your password
              </Link>
              , then open this link again.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-700">Set up your account: you&apos;ll sign in with {invitation.email} and the password you choose here.</p>
            <div>
              <label htmlFor="invite-name" className="mb-1 block text-xs font-medium text-gray-600">Your name</label>
              <input id="invite-name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={INPUT} autoComplete="name" />
            </div>
            <div>
              <label htmlFor="invite-phone" className="mb-1 block text-xs font-medium text-gray-600">
                Phone number <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input id="invite-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={INPUT} autoComplete="tel" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Choose a password (at least 8 characters)</label>
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} autoComplete="new-password" />
            </div>
          </>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className={BUTTON}>
          {busy ? "Joining…" : invitation.accountExists ? "Sign in and join" : "Create my account and join"}
        </button>
      </form>
    </CenteredCard>
  );
}
