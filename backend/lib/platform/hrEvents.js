// Applying Figbloom HR's events to Fleet (FLEET_HR_CONTRACT.md section 3).
// Each runs in one transaction that first records the delivery id
// (PlatformEventDelivery): a repeat is "duplicate" and changes nothing; if
// anything later fails the record rolls back with it, so the platform's retry
// applies it.
//
// hr.employee.left  {employee_number, external_id (User.id), left_on}
//   -> the person's Fleet account is deactivated (signed out at their next
//      request, refresh tokens revoked). Not sent back to HR as
//      fleet.staff.left. The company owner is never deactivated this way:
//      logged and acknowledged ("owner_ignored").
// hr.leave.approved / hr.leave.cancelled  {application_id, external_id,
//   employee_number, leave_type, start_date, end_date, half_day, days, status}
//   -> DriverUnavailability for that application: approved dates, or
//      cancelled. event.occurred_at orders events of one application (an
//      older one is "stale"). A date change arrives as cancelled (old) +
//      approved (new) with the same application id, in either order: a
//      cancel for other dates than the ones recorded is "other_dates" and
//      leaves the newer dates alone.
// Outcomes that are acknowledged (2xx) and ignored: unknown_tenant (no such
// company in Fleet) and not_found (no such person: e.g. a Schools person).
// Outcomes that answer 4xx: tenant_mismatch
// (the person is in another company), person_mismatch (the application is
// recorded for someone else).

function isUniqueViolation(err) {
  return err?.code === "P2002" || err?.cause?.code === "23505" || /unique constraint/i.test(err?.message ?? "");
}

async function once(db, delivery, fn) {
  try {
    return await db.$transaction(async (tx) => {
      await tx.platformEventDelivery.create({
        data: {
          deliveryId: delivery.deliveryId,
          eventId: delivery.eventId ?? null,
          type: delivery.type,
          companyId: delivery.companyId ?? null,
          personId: delivery.personId ?? null,
          outcome: "received",
        },
      });
      const result = await fn(tx);
      await tx.platformEventDelivery.update({ where: { deliveryId: delivery.deliveryId }, data: { outcome: result.outcome } });
      return result;
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { outcome: "duplicate" };
    throw err;
  }
}

async function personOf(tx, companyId, personId) {
  // The relay also carries HR events about other products' people (Schools)
  // and companies Fleet doesn't have: those are "unknown_tenant" /
  // "not_found", acknowledged and ignored by the webhook.
  const company = await tx.company.findUnique({ where: { id: String(companyId) }, select: { id: true } });
  if (!company) return { refused: "unknown_tenant" };
  const user = await tx.user.findUnique({
    where: { id: String(personId) },
    select: { id: true, companyId: true, role: true, status: true, fullName: true },
  });
  if (!user || user.role === "PLATFORM_ADMIN") return { refused: "not_found" };
  if (user.companyId !== companyId) return { refused: "tenant_mismatch" };
  return { user };
}

/** input: { deliveryId, eventId?, companyId, personId, employeeNumber?, leftOn? } */
export async function applyEmployeeLeft(db, input) {
  return once(db, { ...input, type: "hr.employee.left" }, async (tx) => {
    const { user, refused } = await personOf(tx, input.companyId, input.personId);
    if (refused) return { outcome: refused };
    if (user.role === "COMPANY_OWNER") return { outcome: "owner_ignored" };
    // HR knows they left: nothing to tell it back (a queued change for them is skipped)
    await tx.platformLink.deleteMany({ where: { kind: "staff", localId: user.id } });
    if (user.status !== "active") return { outcome: "already_inactive" };
    await tx.user.update({ where: { id: user.id }, data: { status: "inactive" } });
    await tx.refreshToken.updateMany({ where: { userId: user.id, revoked: false }, data: { revoked: true } });
    return { outcome: "deactivated", role: user.role };
  });
}

/**
 * input: { deliveryId, eventId?, type: "hr.leave.approved"|"hr.leave.cancelled", companyId, personId,
 *          applicationId, leaveType?, startDate, endDate, halfDay, occurredAt (Date) }
 */
export async function applyLeaveEvent(db, input) {
  const approved = input.type === "hr.leave.approved";
  return once(db, input, async (tx) => {
    const { user, refused } = await personOf(tx, input.companyId, input.personId);
    if (refused) return { outcome: refused };
    const key = { companyId_source_applicationId: { companyId: input.companyId, source: "hr", applicationId: input.applicationId } };
    const row = await tx.driverUnavailability.findUnique({ where: key });
    const fields = {
      leaveType: input.leaveType ?? null,
      startDate: input.startDate,
      endDate: input.endDate,
      halfDay: !!input.halfDay,
      lastEventAt: input.occurredAt,
    };

    if (!row) {
      await tx.driverUnavailability.create({
        data: { companyId: input.companyId, userId: user.id, source: "hr", applicationId: input.applicationId, status: approved ? "approved" : "cancelled", ...fields },
      });
      return { outcome: approved ? "approved" : "cancelled_unseen" };
    }
    if (row.userId !== user.id) return { outcome: "person_mismatch" };
    if (row.lastEventAt && input.occurredAt < row.lastEventAt) return { outcome: "stale" };
    const sameDates = row.startDate === input.startDate && row.endDate === input.endDate;

    if (approved) {
      if (row.status === "approved" && sameDates && row.halfDay === !!input.halfDay) {
        await tx.driverUnavailability.update({ where: { id: row.id }, data: { lastEventAt: input.occurredAt } });
        return { outcome: "already_approved" };
      }
      await tx.driverUnavailability.update({ where: { id: row.id }, data: { status: "approved", ...fields } });
      return { outcome: row.status === "approved" ? "updated" : "approved" };
    }
    if (row.status === "cancelled") return { outcome: "already_cancelled" };
    if (!sameDates) return { outcome: "other_dates" }; // the old range of a date change
    await tx.driverUnavailability.update({ where: { id: row.id }, data: { status: "cancelled", lastEventAt: input.occurredAt } });
    return { outcome: "cancelled" };
  });
}

// ---- dispatch: who is away on a day

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// Approved leave overlapping [from, to] (YYYY-MM-DD, inclusive) for the
// given people (all of the company's when userIds is omitted).
export async function unavailabilityBetween(db, companyId, from, to, userIds) {
  if (!DAY.test(from) || !DAY.test(to)) return [];
  return db.driverUnavailability.findMany({
    where: {
      companyId: String(companyId),
      status: "approved",
      startDate: { lte: to },
      endDate: { gte: from },
      ...(userIds ? { userId: { in: userIds.map(String) } } : {}),
    },
    select: { userId: true, startDate: true, endDate: true, halfDay: true, leaveType: true },
    orderBy: { startDate: "asc" },
  });
}

// The warning dispatch shows when a job (or a vehicle) goes to someone on
// leave, or null. Never blocks: HR may know more than Fleet.
export async function leaveWarning(db, { companyId, userId, date }) {
  if (!userId || !companyId || !DAY.test(String(date))) return null;
  const [leave] = await unavailabilityBetween(db, companyId, date, date, [userId]);
  if (!leave) return null;
  const what = leave.leaveType ? `${leave.leaveType}` : "leave";
  const span = leave.startDate === leave.endDate ? `on ${leave.startDate}` : `from ${leave.startDate} to ${leave.endDate}`;
  return { code: "driver_on_leave", message: `This driver is on ${what}${leave.halfDay ? " (half day)" : ""} ${span}, approved in Figbloom HR.`, leave };
}
