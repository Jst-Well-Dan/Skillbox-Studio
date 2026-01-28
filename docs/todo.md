# Project Status & Todo

## 2026-01-27 Preparation for Release

- [x] **Codebase Cleanup**: Validated code, fixed linting (mostly), and pushed current state to GitHub.
- [x] **Updater Plugin**: Added `tauri-plugin-updater` to `Cargo.toml`.
- [x] **Updater Setup**: Initialized updater in `lib.rs` and added configuration to `tauri.conf.json`.
- [x] **CI/CD**: Created `.github/workflows/release.yml` for automated Windows builds.

## Next Steps (User Action Required)

1.  **Generate Keys**:
    Run `npx tauri signature generate` in your terminal.

2.  **Update Config**:
    Copy the **Public Key** from the output and replace `"CONTENT_OF_PUBLIC_KEY_HERE"` in `src-tauri/tauri.conf.json`.

3.  **Configure GitHub Secrets**:
    Go to your GitHub Repository Settings -> Secrets and variables -> Actions.
    Add the following secrets:
    - `TAURI_SIGNING_PRIVATE_KEY`: (The private key content from step 1)
    - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: (The password you set, or empty if none)

4.  **Trigger Release**:
    Push a tag (e.g., `git tag v0.1.1 && git push --tags`) to trigger the build and release workflow.