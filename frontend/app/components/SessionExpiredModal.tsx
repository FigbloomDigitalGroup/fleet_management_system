"use client";

import { useEffect, useState } from "react";
import { FiLock } from "react-icons/fi";
import { onSessionExpired } from "../lib/sessionEvents";
import NoticeModal from "./NoticeModal";
import { useAuth } from "../context/AuthContext";

export default function SessionExpiredModal() {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();

  useEffect(() => onSessionExpired(() => setOpen(true)), []);

  if (!open) return null;

  return (
    <NoticeModal
      icon={FiLock}
      title="Session timed out"
      description="You've been signed out for your security. Sign in again to pick up where you left off."
      primaryLabel="Go to login"
      onPrimary={() => {
        setOpen(false);
        logout();
      }}
    />
  );
}
