import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  createMyExpense,
  listMyExpenses,
  listExpenses,
  exportExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  reviewExpense,
} from "../controllers/expenseController.js";

const router = express.Router();
router.use(authenticate);

// Drivers, from the app: their own vehicle's expenses.
router.get("/mine", authorize("DRIVER"), listMyExpenses);
router.post("/mine", authorize("DRIVER"), createMyExpense);

// The office. Staff roles count as ADMIN in authorize(); authenticate has
// already narrowed them (lib/staffRoles.js: accountants write, supervisors
// read) and restricted admins (dispatcher/viewer: read only).
const officeRead = authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN");
const officeWrite = authorize("ADMIN", "COMPANY_OWNER");

router.get("/", officeRead, listExpenses);
router.get("/export.xlsx", officeRead, exportExpenses);
router.post("/", officeWrite, createExpense);
router.patch("/:id/review", officeWrite, reviewExpense);
router.patch("/:id", officeWrite, updateExpense);
router.delete("/:id", officeWrite, deleteExpense);

export default router;
