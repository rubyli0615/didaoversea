/** Presentation only: authentication retains the canonical, case-insensitive identity. */
export function formatLoginAccount(value: string) {
  const account = value.trim().toLowerCase();
  return account ? account[0].toUpperCase() + account.slice(1) : "";
}
