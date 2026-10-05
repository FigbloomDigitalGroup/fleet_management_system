"use client";

import ExpensesList from "../../components/ExpensesList";
import { usePageHeader } from "../../components/DashboardShell";

export default function AdminExpensesPage() {
  usePageHeader("Expenses", "Fuel and other costs logged by drivers");

  return (
    <div>
      <ExpensesList />
    </div>
  );
}
