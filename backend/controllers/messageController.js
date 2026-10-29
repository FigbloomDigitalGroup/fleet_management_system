import prisma from "../lib/prisma.js";
import { toApi } from "../lib/serialize.js";
import { tenantScope } from "../middleware/auth.js";

const MAX_BODY = 2000;

// ADMIN/COMPANY_OWNER — one row per driver who has any messages: the latest
// message and how many of theirs are unread by dispatch.
export async function listThreads(req, res) {
  try {
    const scope = tenantScope(req);
    const companyId = scope.companyId ? String(scope.companyId) : null;
    // Latest message per driver, newest conversation first.
    const latest = await prisma.$queryRaw`
      SELECT DISTINCT ON ("driverId") "driverId", body, "fromDriver", "createdAt"
      FROM "Message"
      WHERE ${companyId}::text IS NULL OR "companyId" = ${companyId}
      ORDER BY "driverId", "createdAt" DESC`;
    latest.sort((a, b) => b.createdAt - a.createdAt);
    const unreadRows = await prisma.message.groupBy({
      by: ["driverId"],
      where: { ...scope, fromDriver: true, readAt: null },
      _count: { _all: true },
    });
    const unread = new Map(unreadRows.map((r) => [r.driverId, r._count._all]));
    const drivers = await prisma.user.findMany({
      where: { id: { in: latest.map((r) => r.driverId) } },
      select: { id: true, fullName: true },
    });
    const byId = new Map(drivers.map((d) => [d.id, d]));
    return res.json(
      latest
        .filter((r) => byId.has(r.driverId))
        .map((r) => ({
          driverId: r.driverId,
          driverName: byId.get(r.driverId).fullName,
          lastMessage: { body: r.body, fromDriver: r.fromDriver, createdAt: r.createdAt },
          unread: unread.get(r.driverId) ?? 0,
        }))
    );
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch conversations" });
  }
}

async function threadFor(driverId, markReadFromDriver) {
  // The driver's own view leaves out messages they deleted.
  const where = markReadFromDriver ? { driverId } : { driverId, hiddenForDriverAt: null };
  const messages = await prisma.message.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
  // Opening a thread marks the other side's messages as read.
  await prisma.message.updateMany({
    where: { driverId, fromDriver: markReadFromDriver, readAt: null },
    data: { readAt: new Date() },
  });
  return toApi(messages.reverse());
}

// ADMIN/COMPANY_OWNER — one driver's conversation (?driverId=)
export async function getThread(req, res) {
  try {
    const driver = await prisma.user.findFirst({
      where: { id: String(req.query.driverId ?? ""), role: "DRIVER", ...tenantScope(req) },
      select: { id: true },
    });
    if (!driver) return res.status(404).json({ error: "Driver not found" });
    return res.json(await threadFor(driver.id, true));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch messages" });
  }
}

// DRIVER — their conversation with dispatch
export async function getMyThread(req, res) {
  try {
    return res.json(await threadFor(req.user.id, false));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch messages" });
  }
}

// DRIVER — unread messages from dispatch (for the app's badge)
export async function getMyUnreadCount(req, res) {
  try {
    const count = await prisma.message.count({
      where: { driverId: req.user.id, fromDriver: false, readAt: null, hiddenForDriverAt: null },
    });
    return res.json({ count });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to count messages" });
  }
}

// Either side sends. Dispatch must name the driver; a driver always
// writes into their own thread.
export async function sendMessage(req, res) {
  try {
    const body = String(req.body.body || "").trim();
    if (!body) return res.status(400).json({ error: "Message can't be empty" });
    if (body.length > MAX_BODY) return res.status(400).json({ error: `Messages are limited to ${MAX_BODY} characters` });

    let driverId;
    let companyId;
    if (req.user.role === "DRIVER") {
      driverId = req.user.id;
      companyId = req.user.companyId;
    } else {
      const driver = await prisma.user.findFirst({
        where: { id: String(req.body.driverId ?? ""), role: "DRIVER", ...tenantScope(req) },
        select: { id: true, companyId: true },
      });
      if (!driver) return res.status(404).json({ error: "Driver not found" });
      driverId = driver.id;
      companyId = driver.companyId;
    }
    if (!companyId) return res.status(400).json({ error: "Your account isn't linked to a company" });

    const message = await prisma.message.create({
      data: { companyId, driverId, senderId: req.user.id, fromDriver: req.user.role === "DRIVER", body },
    });
    return res.status(201).json(toApi(message));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to send message" });
  }
}

// DRIVER — delete a message from their own view of the conversation (body:
// none). Dispatch keeps the full history.
export async function hideMyMessage(req, res) {
  try {
    const { count } = await prisma.message.updateMany({
      where: { id: req.params.id, driverId: req.user.id },
      data: { hiddenForDriverAt: new Date() },
    });
    if (!count) return res.status(404).json({ error: "Message not found" });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to delete message" });
  }
}
