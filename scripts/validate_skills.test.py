#!/usr/bin/env python3
"""Focused tests for repository skill validation helpers."""

from __future__ import annotations

import contextlib
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import validate_skills


class OpenAIYamlValidationTest(unittest.TestCase):
    def validate(self, content: str) -> tuple[bool, str]:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "openai.yaml"
            path.write_text(content, encoding="utf-8")
            reporter = validate_skills.Reporter()
            output = io.StringIO()
            with (
                patch.object(validate_skills, "yaml", None),
                contextlib.redirect_stdout(output),
            ):
                validate_skills.validate_openai_yaml(
                    path, "status-update", reporter
                )
            return reporter.failed, output.getvalue()

    def test_accepts_complete_interface_without_pyyaml(self) -> None:
        failed, output = self.validate(
            """policy:
  allow_implicit_invocation: false
interface:
  display_name: "Status Update"
  short_description: "Understand long-running agent work quickly."
  default_prompt: "Use $status-update to summarize this task."
"""
        )

        self.assertFalse(failed, output)

    def test_rejects_default_prompt_without_skill_reference(self) -> None:
        failed, output = self.validate(
            """policy:
  allow_implicit_invocation: false
interface:
  display_name: "Status Update"
  short_description: "Understand long-running agent work quickly."
  default_prompt: "Summarize this task."
"""
        )

        self.assertTrue(failed)
        self.assertIn("must mention '$status-update'", output)

    def test_rejects_unquoted_interface_values_without_pyyaml(self) -> None:
        failed, output = self.validate(
            """policy:
  allow_implicit_invocation: false
interface:
  display_name: Status Update
  short_description: "Understand long-running agent work quickly."
  default_prompt: "Use $status-update to summarize this task."
"""
        )

        self.assertTrue(failed)
        self.assertIn("quoted string values", output)

    def test_accepts_policy_only_skill_metadata(self) -> None:
        failed, output = self.validate(
            """policy:
  allow_implicit_invocation: false
"""
        )

        self.assertFalse(failed, output)

    def test_rejects_missing_explicit_only_policy(self) -> None:
        failed, output = self.validate(
            """interface:
  display_name: "Status Update"
  short_description: "Understand long-running agent work quickly."
  default_prompt: "Use $status-update to summarize this task."
"""
        )

        self.assertTrue(failed)
        self.assertIn("allow_implicit_invocation: false", output)

    def test_rejects_implicit_codex_policy(self) -> None:
        failed, output = self.validate(
            """policy:
  allow_implicit_invocation: true
"""
        )

        self.assertTrue(failed)
        self.assertIn("allow_implicit_invocation: false", output)


if __name__ == "__main__":
    unittest.main()
