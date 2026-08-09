import { nhost } from "./nhost";

export async function loginWithEmailPassword(email: string, password: string) {
  try {
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

export async function logoutUser() {
  try {
    await nhost.auth.signOut();
  } catch (err: any) {
    // Ignore signout errors in offline demo mode
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
