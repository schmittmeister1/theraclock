# Android build (Trusted Web Activity)

This folder holds `twa-manifest.json`, the recipe for TheraClock's Android app.
The app is a Trusted Web Activity: a thin native shell that runs the live site
(https://schmittmeister1.github.io/theraclock/) full-screen, verified by the
site's `/.well-known/assetlinks.json`.

Builds run automatically in GitHub Actions (`.github/workflows/android-build.yml`)
whenever files in this folder change, or on demand from the Actions tab
("Build Android app" → Run workflow). Each successful build publishes
`app-release-bundle.aab` — the file Google Play Console asks for — on the
repository's Releases page.

Signing uses the `upload.keystore` stored in the repo secrets
`ANDROID_KEYSTORE_B64` + `KEYSTORE_PASSWORD` (never committed).

To ship an app update after changing the web app: bump `appVersionCode` (+1)
and `appVersionName` in `twa-manifest.json`, let the build run, and upload the
new `.aab` to Play Console. Pure web changes don't need a new build at all —
the app shows the live site.

Build logs: every run (pass or fail) publishes its build.log on the Releases page.
Log channel: build.log is mirrored to the ci-logs branch each run.
