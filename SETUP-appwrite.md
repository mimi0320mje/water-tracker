# Sip — Cross-device sync setup (Appwrite)

> ✅ **Already configured (2026-06-22).** This project is live and synced. The values are
> filled into `cloud.js` (`CONFIG`): endpoint `https://fra.cloud.appwrite.io/v1`, project
> `6a396f2a002d8d6bb834`, database `6a39703b0030c8e040d6`, table `userdata`. This guide is
> kept as a reference in case you ever need to rebuild the backend.

This is a **one-time** setup to turn on the optional "log in & sync across devices"
feature. It uses **Appwrite Cloud's free tier** — no cost. You only do this once.

> **Note on naming:** newer Appwrite calls the pieces **Tables / Columns / Rows** (older
> docs say **Collections / Attributes / Documents**). They're the same thing — the steps
> below use the Tables wording.

Everything here is done in the Appwrite Console (a website) — no commands, no passwords
shared with anyone. At the end you'll copy **two public values** into `cloud.js`.

---

## 1. Create a free account + project
1. Go to **https://cloud.appwrite.io** and sign up (free).
2. Click **Create project**. Name it `sip`. Pick the region closest to you.
3. After it's created, you'll land on the project's overview.

## 2. Get your two public values
1. In the left sidebar, open **Settings** (the gear, project settings).
2. Copy the **Project ID** and the **API Endpoint** (looks like
   `https://<region>.cloud.appwrite.io/v1`).
3. Tell Claude these two values — they go into `cloud.js`. (These are safe to share /
   commit; they're public client values.)

## 3. Register your app's web addresses (so the browser is allowed to connect)
1. On the project overview, find **Add a platform → Web app** (or **Settings → Platforms**).
2. Add a platform with hostname: **`localhost`**  (for local testing)
3. Add another platform with hostname: **`mimi0320mje.github.io`**  (the live site)
   - Name can be anything (e.g. "Sip local", "Sip live").

## 4. Turn on Email/Password sign-in
1. Left sidebar → **Auth**.
2. Open the **Settings** tab of Auth and make sure **Email/Password** is **enabled**
   (it usually is by default).

## 5. Create the database + table
1. Left sidebar → **Databases** → **Create database**. Name it `sip`.
   - Appwrite assigns it an **ID** automatically (e.g. `6a39703b0030c8e040d6`). Copy that ID
     into `cloud.js` → `CONFIG.databaseId`.
2. Inside it, **Create table**. Name it `userData`.
   - Copy its **ID** (e.g. `userdata`) into `cloud.js` → `CONFIG.collectionId`.

## 6. Add the two columns (the shape of each saved record)
In the `userData` table → **Columns** tab → **Create column**:
1. **String** column
   - Key: `payload`
   - Size: `1000000`
   - Required: **off**
2. **Integer** column
   - Key: `updatedAt`
   - Required: **off**

## 7. Lock it down so each person only sees their own data
1. In the `userData` table → **Settings** tab.
2. Under **Permissions**, add **one** role:
   - Role: **All users** (all signed-in users)
   - Check **Create** only. (Leave Read/Update/Delete unchecked.) Click **Update**.
   - Why: this lets a logged-in person create *their own* record. Reading and editing are
     restricted per-record to the owner automatically (the app sets that when it saves).
3. Turn **Row Security** **ON** and click **Update**.

---

## Done!
Once Claude puts your Project ID + Endpoint into `cloud.js`, the **Sign up / Log in**
buttons in Settings become live. Sign up on one device, log in on another, and your water
history follows you. Guest mode keeps working exactly as before for anyone who doesn't
log in.
