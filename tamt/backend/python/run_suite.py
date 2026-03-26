#!/usr/bin/env python3
"""
Thin Python wrapper to invoke Robot Framework CLI.
Called by rfService.js via python-shell.

Usage: python run_suite.py '<json_args>'

JSON args shape:
{
  "outputDir": "/path/to/output",
  "scriptPaths": ["/path/to/script1.robot", ...],
  "variables": { "ENV": "SIT", "BASE_URL": "http://..." }
}
"""
import sys
import os
import json
import subprocess


def run_suite(output_dir, script_paths, variables=None):
    """Run robot framework with the given arguments."""
    cmd = [sys.executable, '-m', 'robot', '--outputdir', output_dir]

    if variables:
        for key, value in variables.items():
            cmd.extend(['--variable', f'{key}:{value}'])

    cmd.extend(script_paths)

    print(f'[RF] Running: {" ".join(cmd)}', flush=True)

    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )

    for line in process.stdout:
        print(line, end='', flush=True)

    process.wait()
    print(f'[RF] Process exited with code {process.returncode}', flush=True)
    return process.returncode


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python run_suite.py <json_args>', file=sys.stderr)
        sys.exit(1)

    try:
        args = json.loads(sys.argv[1])
    except json.JSONDecodeError as e:
        print(f'Invalid JSON args: {e}', file=sys.stderr)
        sys.exit(1)

    output_dir = args.get('outputDir', '/tmp/rf-output')
    script_paths = args.get('scriptPaths', [])
    variables = args.get('variables', {})

    if not script_paths:
        print('No script paths provided', file=sys.stderr)
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)
    exit_code = run_suite(output_dir, script_paths, variables)
    sys.exit(exit_code)
