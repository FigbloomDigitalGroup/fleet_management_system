import mongoose from "mongoose";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { tenantScope } from "../middleware/auth.js";

const MAX_BODY = 2000;

// ADMIN/COMPANY_OWNER — one row per driver who has any messages: the latest
// message and how many of theirs are unread by dispatch.
export async function listThreads(req, res) {
  try {
    const scope = tenantScope(req);
    const match = scope.companyId ? { companyId: new mongoose.Types.ObjectId(String(scope.companyId)) } : {};
    const rows = await Message.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$driverId",
          lastMessage: { $first: "$$ROOT" },
          unread: { $sum: { $cond: [{ $and: ["$fromDriver", { $eq: ["$readAt", null] }] }, 1, 0] } },
        },
      },
      { $sort: { "lastMessage.createdAt": -1 } },
    ]);
    const drivers = await User.find({ _id: { $in: rows.map((r) => r._id) } }).select("fullName email");
    const byId = new Map(drivers.map((d) => [String(d._id), d]));
    return res.json(
      rows
        .filter((r) => byId.has(String(r._id)))
        .map((r) => ({
          driverId: r._id,
          driverName: byId.get(String(r._id)).fullName,
          lastMessage: { body: r.lastMessage.body, fromDriver: r.lastMessage.fromDriver, createdAt: r.lastMessage.createdAt },
          unread: r.unread,
        }))
    );
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch conversations" });
  }
}

async function threadFor(driverId, markReadFromDriver) {
  const messages = await Message.find({ driverId }).sort({ createdAt: -1 }).limit(200);
  // Opening a thread marks the other side's messages as read.
  await Message.updateMany(
    { driverId, fromDriver: markReadFromDriver, readAt: null },
    { $set: { readAt: new Date() } }
  );
  return messages.reverse();
}

// ADMIN/COMPANY_OWNER — one driver's conversation (?driverId=)
export async function getThread(req, res) {
  try {
    const driver = await User.findOne({ _id: req.query.driverId, role: "DRIVER", ...tenantScope(req) }).select("_id");
    if (!driver) return res.status(404).json({ error: "Driver not found" });
    return res.json(await threadFor(driver._id, true));
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
    const count = await Message.countDocuments({ driverId: req.user.id, fromDriver: false, readAt: null });
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
      const driver = await User.findOne({ _id: req.body.driverId, role: "DRIVER", ...tenantScope(req) }).select("companyId");
      if (!driver) return res.status(404).json({ error: "Driver not found" });
      driverId = driver._id;
      companyId = driver.companyId;
    }
    if (!companyId) return res.status(400).json({ error: "Your account isn't linked to a company" });

    const message = await Message.create({
      companyId,
      driverId,
      senderId: req.user.id,
      fromDriver: req.user.role === "DRIVER",
      body,
    });
    return res.status(201).json(message);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to send message" });
  }
}
