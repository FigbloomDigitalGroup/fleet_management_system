"use client";

import ExpensesList from "../../components/ExpensesList";
import { usePageHeader } from "../../components/DashboardShell";

export default function CompanyExpensesPage() {
  usePageHeader("Expenses", "Fuel, tolls, parking and repairs: logged by drivers or added by the office");

  return (
    <div>
      <ExpensesList />
    </div>
  );
}
