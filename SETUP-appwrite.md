# Sip — Cross-device sync setup (Appwrite)

This is a **one-time** setup to turn on the optional "log in & sync across devices"
feature. It uses **Appwrite Cloud's free tier** — no cost. You only do this once.

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

## 5. Create the database + collection
1. Left sidebar → **Databases** → **Create database**.
   - Name: `sip` — and set the **Database ID** to exactly **`sip`**.
2. Inside it, **Create collection**.
   - Name: `userData` — set the **Collection ID** to exactly **`userData`**.

## 6. Add the two attributes (the shape of each saved record)
In the `userData` collection → **Attributes** tab → **Create attribute**:
1. **String** attribute
   - Key: `payload`
   - Size: `1000000`
   - Required: **off**
2. **Integer** attribute
   - Key: `updatedAt`
   - Required: **off**

## 7. Lock it down so each person only sees their own data
1. In the `userData` collection → **Settings** tab.
2. Turn **Document Security** **ON**.
3. Under **Permissions**, add **one** row:
   - Role: **Users** (all signed-in users)
   - Check **Create** only. (Leave Read/Update/Delete unchecked here.)
   - Why: this lets a logged-in person create *their own* record. Reading and editing are
     restricted per-record to the owner automatically (the app sets that when it saves).

---

## Done!
Once Claude puts your Project ID + Endpoint into `cloud.js`, the **Sign up / Log in**
buttons in Settings become live. Sign up on one device, log in on another, and your water
history follows you. Guest mode keeps working exactly as before for anyone who doesn't
log in.
