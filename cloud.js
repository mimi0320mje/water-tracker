/* ===== Sip — optional cross-device sync =====
 * This whole file is the ONLY place that talks to the cloud. The rest of the
 * app (app.js) never imports Appwrite directly — it just calls window.SipCloud.
 * Keeping it isolated means sync can be reasoned about and replaced on its own.
 *
 * The values in CONFIG below are PUBLIC client values (safe to commit to a
 * public repo). Security is enforced by Appwrite's per-document permissions —
 * each signed-in user can only read and write their own document — not by
 * hiding these IDs.
 */
import {
  Client, Account, Databases, ID, Permission, Role,
} from "https://cdn.jsdelivr.net/npm/appwrite@18/+esm";

const CONFIG = {
  // ↓↓↓ FILL THESE IN after creating your free Appwrite project ↓↓↓
  endpoint: "https://nyc.cloud.appwrite.io/v1", // your project's API endpoint
  projectId: "PASTE_PROJECT_ID",                // your project ID
  // These two are created by the setup step; leave as-is unless you renamed them.
  databaseId: "sip",
  collectionId: "userData",
};

const configured = !CONFIG.projectId.startsWith("PASTE_");

const client = new Client().setEndpoint(CONFIG.endpoint).setProject(CONFIG.projectId);
const account = new Account(client);
const databases = new Databases(client);

let currentUser = null;

function emitAuthChanged() {
  window.dispatchEvent(new CustomEvent("sip-auth-changed", { detail: { user: currentUser } }));
}

const SipCloud = {
  isConfigured: () => configured,
  getUser: () => currentUser,

  // Re-read the current session (if any) and announce the result.
  async refreshUser() {
    if (!configured) { currentUser = null; return null; }
    try {
      currentUser = await account.get();
    } catch (_) {
      currentUser = null; // no active session — that's fine, stay a guest
    }
    emitAuthChanged();
    return currentUser;
  },

  async signUp(email, password) {
    await account.create({ userId: ID.unique(), email, password });
    return SipCloud.logIn(email, password); // log straight in after sign-up
  },

  async logIn(email, password) {
    await account.createEmailPasswordSession({ email, password });
    return SipCloud.refreshUser();
  },

  async logOut() {
    try { await account.deleteSession({ sessionId: "current" }); } catch (_) {}
    currentUser = null;
    emitAuthChanged();
  },

  // Fetch this user's saved Sip data. Returns the parsed payload object,
  // or null if they have no cloud document yet (first time on this account).
  async pull() {
    if (!currentUser) return null;
    try {
      const doc = await databases.getDocument({
        databaseId: CONFIG.databaseId,
        collectionId: CONFIG.collectionId,
        documentId: currentUser.$id,
      });
      return doc.payload ? JSON.parse(doc.payload) : null;
    } catch (e) {
      if (e && e.code === 404) return null; // no document yet
      throw e;
    }
  },

  // Save this user's Sip data, creating the document on first write.
  async push(payload) {
    if (!currentUser) return;
    const uid = currentUser.$id;
    await databases.upsertDocument({
      databaseId: CONFIG.databaseId,
      collectionId: CONFIG.collectionId,
      documentId: uid,
      data: { payload: JSON.stringify(payload), updatedAt: Date.now() },
      permissions: [
        Permission.read(Role.user(uid)),
        Permission.update(Role.user(uid)),
        Permission.delete(Role.user(uid)),
      ],
    });
  },
};

window.SipCloud = SipCloud;

// Check for an existing session as soon as the module loads. This is async, so
// app.js (a classic script that runs first) has already registered its
// "sip-auth-changed" listener by the time this resolves.
SipCloud.refreshUser();
