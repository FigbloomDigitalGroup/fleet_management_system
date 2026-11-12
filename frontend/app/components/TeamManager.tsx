"use client";

import { useEffect, useState, FormEvent } from "react";
import { FiUserPlus } from "react-icons/fi";
import { apiRequest, errorMessage } from "../lib/api";
import { AdminRecord } from "../types/auth";
import { useAuth } from "../context/AuthContext";
import { TEAM_ROLE_OPTIONS, TeamRoleChoice, canManageTeam, teamRoleBody, teamRoleChoice } from "../lib/staffRoles";
import Skeleton from "./Skeleton";
import PasswordInput from "./PasswordInput";
import { usePageHeader } from "./DashboardShell";
import Avatar from "./Avatar";
import EmptyState from "./EmptyState";

const INPUT = "w-full px-3 py-2 rounded text-sm border border-gray-300 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600";

// Team (FLEET_HR_CONTRACT.md section 0): the owner and full admins add the
// people who help run the fleet, each with a role (full / dispatcher /
// view-only admin, operator, accountant, mechanic, supervisor), change it,
// and switch an account off or on again. Figbloom staff in a support view
// see the list only.
export default function TeamManager() {
  const { user } = useAuth();
  const canEdit = canManageTeam(user);
  const [team, setTeam] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [choice, setChoice] = useState<TeamRoleChoice>("ADMIN:full");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadTeam() {
    try {
      setTeam(await apiRequest<AdminRecord[]>("/api/users/team"));
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Failed to load the team"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    apiRequest<AdminRecord[]>("/api/users/team")
      .then((list) => !cancelled && setTeam(list))
      .catch((err) => !cancelled && setError(errorMessage(err, "Failed to load the team")))
      .finally(() => !cancelled && setLoading(false));
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
    if (!active && !window.confirm(`Switch off ${member.fullName}'s account? They are signed out straight away and can't sign in until you switch it back on.`)) return;
    setRowError(null);
    setBusyId(member._id);
    try {
      await apiRequest(`/api/users/${member._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: active ? "active" : "inactive" }),
        successMessage: active ? "Account switched on." : "Account switched off.",
      });
      setTeam((list) => list.map((m) => (m._id === member._id ? { ...m, status: active ? "active" : "inactive" } : m)));
    } catch (err) {
      setRowError(errorMessage(err, "Failed to update the account"));
    } finally {
      setBusyId(null);
    }
  }

  async function addMember(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      await apiRequest("/api/auth/users", {
        method: "POST",
        body: JSON.stringify({ email, password, fullName, ...teamRoleBody(choice) }),
        successMessage: "Team member added.",
        notifyErrors: false,
      });
      setFullName("");
      setEmail("");
      setPassword("");
      setChoice("ADMIN:full");
      await loadTeam();
    } catch (err) {
      setFormError(errorMessage(err, "Failed to add the team member"));
    } finally {
      setIsSubmitting(false);
    }
  }

  usePageHeader("Team", "The people who help you run your fleet, and what each can do");

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 bg-white rounded-lg shadow-sm ring-1 ring-black/5 overflow-hidden">
        {loading && <Skeleton rows={5} rowClassName="h-12" className="p-5" />}
        {error && <p className="text-sm text-red-600 p-5">{error}</p>}
        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
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
                        text="You can run your fleet yourself, so a team is optional. Add people who should help: an operator for the day's work, an accountant, a mechanic or a supervisor."
                        action={canEdit ? { label: "Add your first team member", href: "#add-member" } : undefined}
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
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-2.5">
                            <Avatar src={m.avatarUrl} name={m.fullName} size="sm" />
                            <span>
                              <span className="block font-medium text-gray-900">{m.fullName}</span>
                              <span className="block text-xs text-gray-500">{m.email}</span>
                            </span>
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <select
                            value={current}
                            disabled={!canEdit || self || busyId === m._id}
                            onChange={(e) => changeRole(m, e.target.value as TeamRoleChoice)}
                            title={TEAM_ROLE_OPTIONS.find((o) => o.value === current)?.description}
                            aria-label={`${m.fullName}'s role`}
                            className="text-sm border border-gray-300 rounded px-2 py-1 outline-none focus:border-teal-600 disabled:opacity-50"
                          >
                            {TEAM_ROLE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className={`text-xs px-2 py-1 rounded-full border ${
                                active ? "bg-teal-50 text-teal-600 border-teal-200" : "bg-gray-50 text-gray-500 border-gray-200"
                              }`}
                            >
                              {active ? "Active" : "Switched off"}
                            </span>
                            {canEdit && !self && (
                              <button
                                type="button"
                                onClick={() => setActive(m, !active)}
                                disabled={busyId === m._id}
                                className="text-xs font-medium text-gray-600 underline-offset-2 hover:underline disabled:opacity-50"
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
            Role changes apply to the person&apos;s next action; they don&apos;t need to sign in again. A switched-off account is signed out straight away.
          </p>
        )}
      </div>

      {canEdit && (
        <div id="add-member" className="scroll-mt-4 bg-white rounded-lg shadow-sm ring-1 ring-black/5 p-5 h-fit">
          <h3 className="text-sm font-medium text-gray-700">Add a team member</h3>
          <p className="text-xs text-teal-600 mt-0.5 mb-4">
            They sign in on the web with the email and password you set here, and see only what their role can use.
          </p>
          <form onSubmit={addMember} className="space-y-4">
            <div>
              <label htmlFor="team-name" className="block text-xs font-medium text-gray-600 mb-1">Full name</label>
              <input id="team-name" type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label htmlFor="team-email" className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input id="team-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
              <PasswordInput required value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} />
            </div>
            <fieldset>
              <legend className="block text-xs font-medium text-gray-600 mb-1">Role</legend>
              <div className="space-y-2">
                {TEAM_ROLE_OPTIONS.map((o) => (
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
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 rounded text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
            >
              {isSubmitting ? "Adding…" : "Add team member"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
