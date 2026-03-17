# humbler-ui

A containerized web UI for browsing and downloading your [Humble Bundle](https://www.humblebundle.com/) purchases.
Built on top of [humble-cli](https://github.com/smbl64/humble-cli).

## Features

- View all your Humble Bundle purchases in one place
- Easily see which bundles have **not** been downloaded yet
- Trigger downloads directly from the browser
- Monitor download progress in real time
- Runs in Docker — deploy locally or on a NAS

## Quick Start

### 1. Clone & Build

```bash
git clone https://github.com/kirnack/humbler-ui.git
cd humbler-ui
docker compose up --build -d
```

### 2. Open the UI

Navigate to **http://localhost:5000** in your browser.

### 3. Authenticate

Humbler UI needs your Humble Bundle session cookie (`_simpleauth_sess`).

1. Log in to [humblebundle.com](https://www.humblebundle.com/) in your browser.
2. Find the `_simpleauth_sess` cookie value ([Chrome guide](https://github.com/smbl64/humble-cli/blob/master/docs/session-key-chrome.md) · [Firefox guide](https://github.com/smbl64/humble-cli/blob/master/docs/session-key-firefox.md)).
3. Paste it into the **Authentication Required** form in the UI.

The key is saved to `./config/.humble-cli-key` and persists across restarts.

### Alternative: Pre-configure via Environment Variable

Set `HUMBLE_SESSION_KEY` before starting the container and the auth step will be skipped:

```bash
HUMBLE_SESSION_KEY="<your session key>" docker compose up -d
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| `HUMBLE_SESSION_KEY` | *(empty)* | Humble Bundle session cookie value (optional at startup) |
| `DOWNLOAD_DIR` | `/downloads` | Path inside the container where bundles are saved |

Docker Compose mounts:

| Host path | Container path | Purpose |
|---|---|---|
| `./config` | `/config` | Stores the humble-cli session key |
| `./downloads` | `/downloads` | Downloaded bundle files |

## Updating

```bash
docker compose pull   # if using a registry image
docker compose up --build -d
```
