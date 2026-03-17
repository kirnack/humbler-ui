import csv
import io
import os
import subprocess
import threading
import uuid
from pathlib import Path

from flask import Flask, abort, jsonify, render_template, request

app = Flask(__name__)

DOWNLOAD_DIR = os.environ.get("DOWNLOAD_DIR", "/downloads")
HOME_DIR = os.environ.get("HOME", "/config")
HUMBLE_CLI = os.environ.get("HUMBLE_CLI", "humble-cli")

# In-memory task tracking
_tasks: dict = {}
_tasks_lock = threading.Lock()

# Write session key from environment variable on startup
_startup_session_key = os.environ.get("HUMBLE_SESSION_KEY", "").strip()
if _startup_session_key:
    _config_path = Path(HOME_DIR) / ".humble-cli-key"
    _config_path.parent.mkdir(parents=True, exist_ok=True)
    _config_path.write_text(_startup_session_key, encoding="utf-8")
    _config_path.chmod(0o600)


def _humble_env() -> dict:
    env = os.environ.copy()
    env["HOME"] = HOME_DIR
    return env


def _run(args: list, timeout: int = 30) -> tuple:
    result = subprocess.run(
        [HUMBLE_CLI] + args,
        capture_output=True,
        text=True,
        timeout=timeout,
        env=_humble_env(),
    )
    return result.stdout, result.stderr, result.returncode


def _is_authenticated() -> bool:
    config_path = Path(HOME_DIR) / ".humble-cli-key"
    if not config_path.exists():
        return False
    return bool(config_path.read_text(encoding="utf-8").strip())


def _sanitize_name(name: str) -> str:
    """Replicate humble-cli's ReplaceInvalidCharsInFilename logic."""
    invalid = set('/\\?%*:|"<>;\n=')
    sanitized = "".join(" " if c in invalid else c for c in name)
    return sanitized.strip()


def _is_downloaded(bundle_name: str) -> bool:
    bundle_dir = Path(DOWNLOAD_DIR) / _sanitize_name(bundle_name)
    if not bundle_dir.exists() or not bundle_dir.is_dir():
        return False
    return any(f.is_file() for f in bundle_dir.rglob("*"))


def _get_bundles() -> list:
    stdout, stderr, rc = _run(
        ["list", "--field", "key", "--field", "name", "--field", "size", "--field", "claimed"],
        timeout=60,
    )
    if rc != 0:
        raise RuntimeError(f"humble-cli error: {stderr.strip() or 'unknown error'}")

    bundles = []
    reader = csv.reader(io.StringIO(stdout))
    for row in reader:
        if len(row) >= 4:
            key = row[0].strip()
            name = row[1].strip()
            size = row[2].strip()
            claimed = row[3].strip()
            if key:
                bundles.append(
                    {
                        "key": key,
                        "name": name,
                        "size": size,
                        "claimed": claimed,
                        "downloaded": _is_downloaded(name),
                    }
                )
    return bundles


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/status")
def api_status():
    return jsonify({"authenticated": _is_authenticated()})


@app.route("/api/auth", methods=["POST"])
def api_auth():
    data = request.get_json(silent=True)
    if not data or "session_key" not in data:
        return jsonify({"error": "session_key is required"}), 400
    session_key = data["session_key"].strip()
    if not session_key:
        return jsonify({"error": "session_key cannot be empty"}), 400

    config_path = Path(HOME_DIR) / ".humble-cli-key"
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(session_key, encoding="utf-8")
    config_path.chmod(0o600)
    return jsonify({"status": "ok"})


@app.route("/api/bundles")
def api_bundles():
    if not _is_authenticated():
        return jsonify({"error": "not_authenticated"}), 401
    try:
        bundles = _get_bundles()
        return jsonify({"bundles": bundles})
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/download", methods=["POST"])
def api_download():
    if not _is_authenticated():
        return jsonify({"error": "not_authenticated"}), 401
    data = request.get_json(silent=True)
    if not data or "key" not in data:
        return jsonify({"error": "key is required"}), 400

    bundle_key = data["key"].strip()
    formats = [f.strip() for f in data.get("formats", []) if f.strip()]

    task_id = str(uuid.uuid4())
    with _tasks_lock:
        _tasks[task_id] = {
            "status": "running",
            "bundle_key": bundle_key,
            "lines": [],
            "error": None,
        }

    def _worker():
        try:
            cmd = [HUMBLE_CLI, "download", bundle_key]
            for fmt in formats:
                cmd += ["-f", fmt]

            Path(DOWNLOAD_DIR).mkdir(parents=True, exist_ok=True)
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                cwd=DOWNLOAD_DIR,
                env=_humble_env(),
            )

            lines = []
            for line in process.stdout:
                lines.append(line.rstrip())
                with _tasks_lock:
                    _tasks[task_id]["lines"] = lines[:]

            process.wait()
            with _tasks_lock:
                _tasks[task_id]["status"] = (
                    "completed" if process.returncode == 0 else "failed"
                )
        except Exception as exc:  # pylint: disable=broad-except
            with _tasks_lock:
                _tasks[task_id]["status"] = "failed"
                _tasks[task_id]["error"] = str(exc)

    threading.Thread(target=_worker, daemon=True).start()
    return jsonify({"task_id": task_id})


@app.route("/api/download/status/<task_id>")
def api_download_status(task_id):
    with _tasks_lock:
        task = _tasks.get(task_id)
    if task is None:
        abort(404)
    return jsonify(task)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
