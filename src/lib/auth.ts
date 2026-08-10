import { nhost } from "./nhost";

const isLiveBackend = () =>
  Boolean(
    (process.env.NEXT_PUBLIC_GRAPHQL_URL || "").trim() ||
      (process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || "").trim()
  );

let activeLocalUser: any = null;

function resolvePreseededUserId(email: string): string {
  const e = (email || "").toLowerCase().trim();
  if (e.includes("owner.a") || e.includes("sahil@vocalflow.ai")) return "user-owner-1";
  if (e.includes("editor.a") || e.includes("editor@vocalflow.ai")) return "user-editor-1";
  if (e.includes("viewer.a") || e.includes("viewer@vocalflow.ai")) return "user-viewer-1";
  if (e.includes("owner.b") || e.includes("cyberdyne@orgb.ai")) return "user-orgb-1";
  return `user-local-${Date.now()}`;
}

export async function loginWithEmailPassword(email: string, password: string) {
  if (!isLiveBackend()) {
    const userId = resolvePreseededUserId(email);
    const user = {
      id: userId,
      email,
      displayName: email.split("@")[0],
    };
    activeLocalUser = user;
    if (typeof window !== "undefined") {
      localStorage.setItem("vocalflow_local_user", JSON.stringify(user));
    }
    return { user };
  }

  try {
    if (nhost.auth.isAuthenticated()) {
      await nhost.auth.signOut();
    }

    const res = await nhost.auth.signIn({
      email,
      password,
    });
    if (res.error) {
      throw new Error(res.error.message);
    }
    return res.session;
  } catch (err: any) {
    throw new Error(err.message || "Failed to log in");
  }
}

export async function signUpWithEmailPassword(email: string, password: string, displayName?: string) {
  if (!isLiveBackend()) {
    const userId = resolvePreseededUserId(email);
    const user = {
      id: userId,
      email,
      displayName: displayName || email.split("@")[0],
    };
    activeLocalUser = user;
    if (typeof window !== "undefined") {
      localStorage.setItem("vocalflow_local_user", JSON.stringify(user));
    }
    return { user, session: { user } };
  }

  try {
    if (nhost.auth.isAuthenticated()) {
      await nhost.auth.signOut();
    }

    const res = await nhost.auth.signUp({
      email,
      password,
      options: {
        displayName: displayName || email,
      },
    });

    if (res.error) {
      if (
        res.error.message.toLowerCase().includes("already signed in") ||
        res.error.message.toLowerCase().includes("already authenticated")
      ) {
        await nhost.auth.signOut();
        const retryRes = await nhost.auth.signUp({
          email,
          password,
          options: {
            displayName: displayName || email,
          },
        });
        if (retryRes.error) {
          throw new Error(retryRes.error.message);
        }
        return { session: retryRes.session, user: retryRes.session?.user || null };
      }
      throw new Error(res.error.message);
    }
    return { session: res.session, user: res.session?.user || null };
  } catch (err: any) {
    throw new Error(err.message || "Failed to sign up");
  }
}

export async function logoutUser() {
  activeLocalUser = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem("vocalflow_local_user");
    sessionStorage.removeItem("vocalflow_local_user");
  }
  if (!isLiveBackend()) return;

  try {
    await nhost.auth.signOut();
  } catch (err: any) {
    // Ignore signout errors
  }
}

export function getCurrentUser() {
  if (!isLiveBackend()) {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("vocalflow_local_user") || sessionStorage.getItem("vocalflow_local_user");
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {}
      }
    }
    return activeLocalUser;
  }

  try {
    return nhost.auth.getUser();
  } catch (err) {
    return null;
  }
}

export function getAccessToken() {
  if (!isLiveBackend()) return null;

  try {
    return nhost.auth.getAccessToken();
  } catch (err) {
    return null;
  }
}
