import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { createMyExpense, listMyExpenses, listExpenses } from "../controllers/expenseController.js";

const router = express.Router();
router.use(authenticate);

router.get("/mine", authorize("DRIVER"), listMyExpenses);
router.post("/mine", authorize("DRIVER"), createMyExpense);
router.get("/", authorize("ADMIN", "COMPANY_OWNER", "PLATFORM_ADMIN"), listExpenses);

export default router;
