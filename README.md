# Family Yahtzee Live v2

A mobile-first, real-time Yahtzee scorecard for GitHub Pages + Firebase Realtime Database.

## Features
- Create a 6-character room code
- Join from multiple phones
- Shareable room links (`?room=ABC234`)
- Anonymous Firebase Authentication — no family accounts/passwords
- Live score synchronization
- Each player edits their own column; host can correct anyone
- Host can reset all scores
- Automatic upper subtotal, 35-point bonus, lower total, and grand total
- Yahtzee bonus support
- PWA home-screen/offline shell caching

## Setup

### 1. Create a Firebase project
Open Firebase Console and create a project.

### 2. Add a Web App
Project settings → Your apps → Add app → Web (`</>`).

Firebase shows a `firebaseConfig` object. Copy those values into `firebase-config.js`.

### 3. Enable anonymous sign-in
Firebase Console → Authentication → Sign-in method → Anonymous → Enable.

Under Authentication → Settings → Authorized domains, add your GitHub Pages host if needed:

`YOUR-USERNAME.github.io`

### 4. Create Realtime Database
Firebase Console → Realtime Database → Create Database. Start in locked mode.

### 5. Publish the included rules
Realtime Database → Rules → replace the editor contents with `database.rules.json` → Publish.

### 6. Deploy to GitHub Pages
Replace/upload these files in the root of your existing Pages repository:

- `index.html`
- `styles.css`
- `app.js`
- `firebase-config.js`
- `manifest.webmanifest`
- `sw.js`

You may also keep `database.rules.json` and `README.md` in the repository.

GitHub repository → Settings → Pages → Deploy from branch → `main` → `/ (root)`.

## Firebase web config is not a password
The Firebase Web config object is intended to be in client-side code. Access control is enforced by Authentication and Realtime Database Security Rules.

## Room behavior
The creator is the host. Players can edit their own scores; the host can edit any score and reset the board. A non-host leaving removes their player row. A host leaving does not delete the room, which makes accidental navigation recoverable on that browser.

Old rooms are not automatically deleted in this version; they can be removed from Realtime Database in Firebase Console.
