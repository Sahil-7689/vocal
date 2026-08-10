import { nhost } from "./nhost";

/**
 * Real Nhost Authentication Helper Module
 * Strictly enforces real Nhost Auth for login, signup, session tokens, and signout.
 */

export async function loginWithEmailPassword(email: string, password: string) {
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
  try {
    await nhost.auth.signOut();
  } catch (err: any) {
    // Ignore signout errors
  }
}

export function getCurrentUser() {
  try {
    return nhost.auth.getUser();
  } catch (err) {
    return null;
  }
}

export function getAccessToken() {
  try {
    return nhost.auth.getAccessToken();
  } catch (err) {
    return null;
  }
}
