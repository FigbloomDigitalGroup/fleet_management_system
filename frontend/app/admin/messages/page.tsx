"use client";

import MessagesCenter from "../../components/MessagesCenter";
import { usePageHeader } from "../../components/DashboardShell";

export default function AdminMessagesPage() {
  usePageHeader("Messages", "Two-way chat with your drivers' phones");

  return (
    <div>
      <MessagesCenter />
    </div>
  );
}
