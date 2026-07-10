#!/usr/bin/env python3

import json
import os
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("feedback_notes.py")


class FeedbackNotesTest(unittest.TestCase):
    def test_capture_is_private_and_preserves_words(self) -> None:
        with tempfile.TemporaryDirectory() as root:
            env = {**os.environ, "DECISION_WORKSHEET_HOME": root, "CAPTURE_FEEDBACK_HOME": str(Path(root) / "legacy")}
            words = "Keep  two spaces — exactly."
            result = subprocess.run([str(SCRIPT), "capture", words], check=True, text=True, capture_output=True, env=env)
            path = Path(result.stdout.splitlines()[1])
            payload = json.loads(path.read_text())
            self.assertEqual(payload["user_words"], words)
            self.assertEqual(payload["schema_version"], "decision_feedback_note/v1")
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
            self.assertEqual(stat.S_IMODE(path.parent.stat().st_mode), 0o700)
            self.assertEqual(stat.S_IMODE(path.parent.parent.stat().st_mode), 0o700)

    def test_list_and_show_include_legacy_notes(self) -> None:
        with tempfile.TemporaryDirectory() as root:
            legacy_root = Path(root) / "legacy"
            inbox = legacy_root / "inbox"
            inbox.mkdir(parents=True)
            payload = {
                "schema_version": "capture_feedback_note/v1",
                "id": "cf_legacy",
                "created_at": "2026-01-01T00:00:00Z",
                "marker": "capture-feedback:cf_legacy",
                "cwd": "/tmp/project",
                "user_words": "legacy words",
            }
            (inbox / "cf_legacy.json").write_text(json.dumps(payload))
            env = {**os.environ, "DECISION_WORKSHEET_HOME": str(Path(root) / "new"), "CAPTURE_FEEDBACK_HOME": str(legacy_root)}
            listed = subprocess.run([str(SCRIPT), "list"], check=True, text=True, capture_output=True, env=env)
            shown = subprocess.run([str(SCRIPT), "show", "capture-feedback:cf_legacy"], check=True, text=True, capture_output=True, env=env)
            self.assertIn("cf_legacy", listed.stdout)
            self.assertEqual(json.loads(shown.stdout)["user_words"], "legacy words")


if __name__ == "__main__":
    unittest.main()
