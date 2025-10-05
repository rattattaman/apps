Agent Guidelines for This Workspace

Scope
- This file applies to the entire repository.

Approval Policy
- Workspace operations: Do not ask for approval for any read/write/edit/move/delete actions performed inside this workspace. Local commands (including local git operations that do not require network) are allowed without prompting.
- Network access: Ask for approval before any command that requires internet or remote access (e.g., git fetch/push, package installs/downloads, API calls).
- If the harness enforces stricter rules, follow the harness, but treat this as the default behavior for this repo.

Project Notes
- Game lives in `mongpong/`.
- Quick test: open `mongpong/index.html` directly in a browser (no server required).
- Keep changes minimal, focused, and consistent with current style.

Commit Messages
- Use concise, descriptive messages (e.g., "mongpong: <short summary>").

