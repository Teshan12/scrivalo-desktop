# Scrivalo for desktop (Windows and Mac)

A real installed app: its own window, taskbar or Dock icon, menu and notifications, and it stays signed in. It opens the live
workspace at `https://app.scrivalo.com`, so every web update reaches the desktop app straight away, with nothing to
reinstall. Offline use works the same way as the installed web app.

## Build the installers

```
cd desktop
npm install
npm run dist:win      # Windows installer  -> dist/Scrivalo-1.0.0-win-x64.exe   (run on Windows)
npm run dist:mac      # Mac disk image     -> dist/Scrivalo-1.0.0-mac-universal.dmg   (run on a Mac)
```

A Windows PC cannot build the Mac app (Apple's tools only run on a Mac). The easy way to get both is the GitHub workflow in
`.github/workflows/desktop.yml`: push a tag such as `v1.0.0` and GitHub builds the Windows and Mac installers on its own
machines and attaches them to a Release.

Try it without installing: `npm start` (set `SCRIVALO_URL=http://localhost:8082/index.html.html` to point it at a local copy).

## Putting the download buttons live

1. Push this project to a GitHub repository and push a tag such as `v1.0.0`. The workflow puts
   `Scrivalo-Setup-x64.exe` and `Scrivalo-mac-universal.dmg` on a Release.
2. Put the repository name (e.g. `scrivalo/scrivalo-desktop`) in `DESKTOP_REPO` in `download/index.html` and in
   `SCRIV_DESKTOP_REPO` in `app/main.js`. The buttons link to the newest Release, so later versions need no change.
3. Deploy the site. The Download page then offers the right installer for the visitor's computer, and the in-app
   "Install the app" button on Windows and Mac sends people to it.

## Before you hand it to many people

- **Windows warning:** an unsigned installer shows Microsoft's blue "Windows protected your PC" box (More info, then Run
  anyway). A code-signing certificate removes it. Set `CSC_LINK` and `CSC_KEY_PASSWORD` when building.
- **Mac warning:** an unsigned app needs a right-click, Open the first time. Removing that needs an Apple Developer account
  ($99 a year) for signing and notarising: set `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and
  `APPLE_TEAM_ID` as GitHub secrets and uncomment the lines marked in the workflow.
- **Icon:** `build/icon.png` is the 512 px app icon. A 1024 px version gives the sharpest Mac Dock icon.

## What the app allows

Links to Scrivalo, Google sign-in, PayPal and Supabase open inside the app; every other link opens in the normal browser.
The page is only given the microphone (voice input), notifications and clipboard. It runs sandboxed with no Node access.
