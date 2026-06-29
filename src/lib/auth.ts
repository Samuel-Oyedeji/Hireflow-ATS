const KEY = "hireflow_auth";

export function isAuthed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) === "1";
}

export function login() {
  if (typeof window !== "undefined") window.localStorage.setItem(KEY, "1");
}

export function logout() {
  if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
}