"use client";

import { useEffect, useState, FormEvent } from "react";
import { FiMail, FiUserPlus } from "react-icons/fi";
import { apiRequest, errorMessage } from "../lib/api";
import { AdminRecord, InvitationRecord } from "../types/auth";
import { useAuth } from "../context/AuthContext";
import { TEAM_ROLE_OPTIONS, TeamRoleChoice, canManageTeam, teamRoleBody, teamRoleChoice } from "../lib/staffRoles";
import Skeleton from "./Skeleton";
import { usePageHeader } from "./DashboardShell";
import Avatar from "./Avatar";
import EmptyState from "./EmptyState";

const INPUT = "w-full px-3 py-2 rounded text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600";

// Team (FLEET_HR_CONTRACT.md section 0, FLEET_MEMBERSHIPS_CONTRACT.md section
// 3): the owner and full admins invite the people who help run the fleet by
// email, each with a role (full / dispatcher / view-only admin, operator,
// accountant, mechanic, supervisor, or driver); see who hasn't accepted yet
// (send again, cancel); change roles; and switch someone off in this fleet or
// back on. Figbloom staff in a support view see the lists only.

type InviteChoice = TeamRoleChoice | "DRIVER";
const INVITE_OPTIONS: { value: InviteChoice; label: string; description: string }[] = [
  ...TEAM_ROLE_OPTIONS,
  {
    value: "DRIVER",
    label: "Driver",
    description: "Drives and uses the FIGBLOOM FLEET app on their phone. Drivers without an email address: add them on the Drivers page instead.",
  },
];
const inviteBody = (choice: InviteChoice) => (choice === "DRIVER" ? { role: "DRIVER" } : teamRoleBody(choice));

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
export default function TeamManager() {
  const { user } = useAuth();
  const canEdit = canManageTeam(user);
  const [team, setTeam] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [choice, setChoice] = useState<InviteChoice>("ADMIN:full");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<InvitationRecord[]>([]);
  const [inviteBusy, setInviteBusy] = useState<string | null>(null);

  async function loadInvitations() {
    try {
      setInvitations(await apiRequest<InvitationRecord[]>("/api/invitations", { notifyErrors: false }));
    } catch {
      // the team list still works without it
    }
  }

  useEffect(() => {
    let cancelled = false;
    apiRequest<AdminRecord[]>("/api/users/team")
      .then((list) => !cancelled && setTeam(list))
      .catch((err) => !cancelled && setError(errorMessage(err, "Failed to load the team")))
      .finally(() => !cancelled && setLoading(false));
    apiRequest<InvitationRecord[]>("/api/invitations", { notifyErrors: false })
      .then((list) => !cancelled && setInvitations(list))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function changeRole(member: AdminRecord, next: TeamRoleChoice) {
    setRowError(null);
    setBusyId(member._id);
    try {
      const updated = await apiRequest<AdminRecord>(`/api/users/team/${member._id}`, {
        method: "PATCH",
        body: JSON.stringify(teamRoleBody(next)),
        successMessage: "Role updated.",
      });
      setTeam((list) => list.map((m) => (m._id === member._id ? { ...m, role: updated.role, adminAccess: updated.adminAccess } : m)));
    } catch (err) {
      setRowError(errorMessage(err, "Failed to change the role"));
    } finally {
      setBusyId(null);
    }
  }

  async function setActive(member: AdminRecord, active: boolean) {
    const question = `Switch off ${member.fullName} in this fleet? They are signed out of this fleet straight away and can't open it until you switch them back on. Any other fleets they belong to are not affected.`;
    if (!active && !window.confirm(question)) return;
    setRowError(null);
    setBusyId(member._id);
    try {
      await apiRequest(`/api/users/${member._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: active ? "active" : "inactive" }),
        successMessage: active ? `${member.fullName} is switched back on.` : `${member.fullName} is switched off in this fleet.`,
      });
      setTeam((list) => list.map((m) => (m._id === member._id ? { ...m, status: active ? "active" : "inactive" } : m)));
    } catch (err) {
      setRowError(errorMessage(err, "Failed to update the account"));
    } finally {
      setBusyId(null);
    }
  }

  async function sendInvite(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSentTo(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setFormError("Enter their email address, like name@example.com.");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await apiRequest<{ emailed: boolean; message: string }>("/api/invitations", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), ...inviteBody(choice) }),
        successMessage: false,
        notifyErrors: false,
      });
      if (res.emailed) setSentTo(email.trim().toLowerCase());
      else setFormError(res.message);
      setEmail("");
      await loadInvitations();
    } catch (err) {
      setFormError(errorMessage(err, "The invitation couldn't be sent. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function invitationAction(inv: InvitationRecord, action: "resend" | "revoke") {
    if (action === "revoke" && !window.confirm(`Cancel the invitation to ${inv.email}? The link in their email will stop working.`)) return;
    setInviteBusy(inv.id);
    try {
      await apiRequest(`/api/invitations/${inv.id}/${action}`, { method: "POST" });
      await loadInvitations();
    } catch {
      // the popup says what went wrong
    } finally {
      setInviteBusy(null);
    }
  }

  usePageHeader("Team", "The people who help you run your fleet, and what each can do");

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 bg-white rounded-lg shadow-sm ring-1 ring-black/5 overflow-hidden">
        {loading && <Skeleton rows={5} rowClassName="h-12" className="p-5" />}
        {error && <p className="text-sm text-red-600 p-5">{error}</p>}
        {!loading && !error && (
          <div className="table-scroll">
            <table className="table-cards w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Name</th>
                  <th className="text-left px-5 py-3 font-medium">Role</th>
                  <th className="text-left px-5 py-3 font-medium">Account</th>
                </tr>
              </thead>
              <tbody>
                {team.length === 0 ? (
                  <tr>
                    <td colSpan={3}>
                      <EmptyState
                        icon={FiUserPlus}
                        title="No team members yet"
                        text="You can run your fleet yourself, so a team is optional. Invite people who should help: an operator for the day's work, an accountant, a mechanic or a supervisor."
                        action={canEdit ? { label: "Invite your first team member", href: "#add-member" } : undefined}
                      />
                    </td>
                  </tr>
                ) : (
                  team.map((m) => {
                    const current = teamRoleChoice(m.role, m.adminAccess);
                    const self = m._id === user?.id;
                    const active = m.status === "active";
                    return (
                      <tr key={m._id} className={`border-t border-gray-100 ${active ? "" : "opacity-60"}`}>
                        <td className="card-title px-5 py-3">
                          <span className="inline-flex min-w-0 items-center gap-2.5">
                            <Avatar src={m.avatarUrl} name={m.fullName} size="sm" />
                            <span className="min-w-0">
                              <span className="block font-medium text-gray-900">{m.fullName}</span>
                              <span className="block break-all text-xs text-gray-500">{m.email}</span>
                            </span>
                          </span>
                        </td>
                        <td data-label="Role" className="px-5 py-3">
                          <select
                            value={current}
                            disabled={!canEdit || self || busyId === m._id}
                            onChange={(e) => changeRole(m, e.target.value as TeamRoleChoice)}
                            title={TEAM_ROLE_OPTIONS.find((o) => o.value === current)?.description}
                            aria-label={`${m.fullName}'s role`}
                            className="min-h-9 text-sm border border-gray-300 rounded px-2 py-1 outline-none focus:border-teal-600 disabled:opacity-50"
                          >
                            {TEAM_ROLE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td data-label="Account" className="px-5 py-3">
                          <span className="inline-flex flex-wrap items-center justify-end gap-2">
                            <span
                              className={`text-xs px-2 py-1 rounded-full border ${
                                active ? "bg-teal-50 text-teal-600 border-teal-200" : "bg-gray-50 text-gray-500 border-gray-200"
                              }`}
                            >
                              {active ? "Active" : "Switched off here"}
                            </span>
                            {canEdit && !self && (
                              <button
                                type="button"
                                onClick={() => setActive(m, !active)}
                                disabled={busyId === m._id}
                                className="min-h-9 px-1 text-xs font-medium text-gray-600 underline-offset-2 hover:underline disabled:opacity-50"
                              >
                                {active ? "Switch off" : "Switch on"}
                              </button>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        {rowError && <p className="text-xs text-red-600 px-5 pb-4">{rowError}</p>}
        {!loading && !error && (
          <p className="text-[11px] text-gray-500 px-5 py-3 border-t border-gray-100">
            Role changes apply to the person&apos;s next action; they don&apos;t need to sign in again. Switching someone off signs them out of this fleet
            straight away; any other fleets they belong to are not affected.
          </p>
        )}
        {invitations.length > 0 && (
          <div className="border-t border-gray-100">
            <h3 className="px-5 pt-4 text-sm font-medium text-gray-700">Waiting to accept</h3>
            <p className="px-5 text-[11px] text-gray-500">Invitations sent by email that haven&apos;t been accepted yet. A link works for 7 days and only once.</p>
            <ul className="divide-y divide-gray-100 px-5 py-2">
              {invitations.map((inv) => {
                const expired = inv.state === "expired";
                const choiceOf = inv.role === "ADMIN" ? `ADMIN:${inv.adminAccess || "full"}` : inv.role;
                return (
                  <li key={inv.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                    <FiMail size={14} className="shrink-0 text-gray-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-gray-900">{inv.email}</span>
                      <span className="block text-[11px] text-gray-500">
                        {INVITE_OPTIONS.find((o) => o.value === choiceOf)?.label ?? inv.roleTitle}
                        {" · "}
                        {expired ? (
                          <span className="text-red-600">expired, send it again</span>
                        ) : (
                          `sent ${shortDate(inv.lastSentAt)}, works until ${shortDate(inv.expiresAt)}`
                        )}
                      </span>
                    </span>
                    {canEdit && (
                      <span className="flex shrink-0 gap-3 max-sm:w-full max-sm:justify-end">
                        <button
                          type="button"
                          disabled={inviteBusy === inv.id}
                          onClick={() => invitationAction(inv, "resend")}
                          className="min-h-9 text-xs font-medium text-teal-700 hover:underline disabled:opacity-50"
                        >
                          Send again
                        </button>
                        <button
                          type="button"
                          disabled={inviteBusy === inv.id}
                          onClick={() => invitationAction(inv, "revoke")}
                          className="min-h-9 text-xs font-medium text-gray-600 hover:underline disabled:opacity-50"
                        >
                          Cancel invitation
                        </button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {canEdit && (
        <div id="add-member" className="scroll-mt-4 bg-white rounded-lg shadow-sm ring-1 ring-black/5 p-5 h-fit">
          <h3 className="text-sm font-medium text-gray-700">Invite someone</h3>
          <p className="text-xs text-teal-600 mt-0.5 mb-4">
            We email them a link. They choose their own password (or use the FIGBLOOM FLEET account they already have) and see only what their role can use.
          </p>
          <form onSubmit={sendInvite} className="space-y-4">
            <div>
              <label htmlFor="team-email" className="block text-xs font-medium text-gray-600 mb-1">Their email</label>
              <input
                id="team-email"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSentTo(null);
                }}
                className={INPUT}
              />
            </div>
            <fieldset>
              <legend className="block text-xs font-medium text-gray-600 mb-1">Their role</legend>
              <div className="space-y-2">
                {INVITE_OPTIONS.map((o) => (
                  <label
                    key={o.value}
                    className={`flex cursor-pointer items-start gap-2 rounded border px-3 py-2 ${choice === o.value ? "border-teal-600 bg-teal-50" : "border-gray-200"}`}
                  >
                    <input
                      type="radio"
                      name="teamRole"
                      value={o.value}
                      checked={choice === o.value}
                      onChange={() => setChoice(o.value)}
                      className="mt-0.5 accent-teal-600"
                    />
                    <span>
                      <span className="block text-sm font-medium text-gray-900">{o.label}</span>
                      <span className="block text-[11px] text-gray-500">{o.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            {formError && <p className="text-xs text-red-600">{formError}</p>}
            {sentTo && (
              <p className="rounded bg-teal-50 px-3 py-2 text-xs text-teal-800">
                Invitation sent to {sentTo}. They&apos;ll appear in your team once they accept.
              </p>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 rounded text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
            >
              {isSubmitting ? "Sending…" : "Send invitation"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
