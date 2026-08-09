import { nhost } from "./nhost";

const isLiveBackend = () =>
  Boolean(
    (process.env.NEXT_PUBLIC_GRAPHQL_URL || "").trim() ||
      (process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || "").trim()
  );

export async function loginWithEmailPassword(email: string, password: string) {
  if (!isLiveBackend()) {
    return {
      user: {
        id: `user-local-${Date.now()}`,
        email,
        displayName: email.split("@")[0],
      },
    };
  }

  try {
    // If an existing session is present, sign out first so a new user can sign in
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
    return {
      user: {
        id: `user-local-${Date.now()}`,
        email,
        displayName: displayName || email.split("@")[0],
      },
    };
  }

  try {
    // If an existing session is present, sign out first so a new user can register
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
  if (!isLiveBackend()) return;

  try {
    await nhost.auth.signOut();
  } catch (err: any) {
    // Ignore signout errors
  }
}

export function getCurrentUser() {
  if (!isLiveBackend()) {
    return {
      id: "user-owner-a",
      email: "sahil@vocalflow.ai",
      displayName: "Sahil Kumar",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    };
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
