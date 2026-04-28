# Haylo Inbox

Drop Haylo Lab `.html` essays here. Then click **Scan Inbox** in Admin → Haylo Library to ingest them.

## File conventions

- One essay per `.html` file. The filename (without `.html`) becomes the default topic slug.
- Optional first-line topic override:
  ```html
  <!-- topic: early-funding-stress -->
  ```
- Title is auto-detected in this order: first `<h1>`, then `<title>`, then first paragraph (truncated to 80 chars), then the filename.
- Files with identical content (sha256 of the body HTML) are skipped as duplicates.
- Files starting with `.` are ignored.

## Notes

- Files are not deleted after import — move/archive them yourself if you want to keep this folder clean.
- This folder is the file-drop ingestion path. The Admin paste-in form is the manual fallback.
- Future: an HTTP API endpoint will let Haylo Lab POST articles directly with a shared secret.
