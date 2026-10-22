"""Build all 12 pstack dogfood fixtures: python3 build_fixtures.py [out-dir]

out-dir defaults to a fresh temp dir and must not already hold any of the fixtures.
Each fixture is a one-commit git repo (main, "Initial import"); verify fixtures
also carry the uncommitted change under review, and their builder prints its
diff fingerprint (compare with the grading file).
"""
import os
import subprocess
import sys
import tempfile

BUILD = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build")
BUILDERS = ["p01", "p02", "v03", "v04", "v05", "a06", "v07", "p08", "v09", "p10", "p11", "p12"]


def main():
    out = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else tempfile.mkdtemp(prefix="pstack-fixtures-")
    os.makedirs(out, exist_ok=True)
    for name in BUILDERS:
        result = subprocess.run([sys.executable, "-B", os.path.join(BUILD, f"{name}.py"), out],
                                capture_output=True, text=True)
        if result.returncode:
            sys.exit(f"{name}.py failed:\n{result.stderr}")
        fingerprint = result.stdout.strip()
        print(f"{name}: ok" + (f"  fingerprint {fingerprint}" if fingerprint else ""))
    print(out)


if __name__ == "__main__":
    main()
