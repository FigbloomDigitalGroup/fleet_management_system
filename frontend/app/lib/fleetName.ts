// "Amina Wanjiru" → "Amina's Fleet": a ready-made fleet name for sign-up, so
// someone with a few vehicles and no registered business doesn't have to
// invent a company name. Empty until a name is typed.
export function defaultFleetName(fullName: string) {
  const first = fullName.trim().split(/\s+/)[0];
  return first ? `${first}'s Fleet` : "";
}
