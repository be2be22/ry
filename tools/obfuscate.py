#!/usr/bin/env python3
"""
Optional hardening: turn the package into a sourceless bytecode build.

For every  <pkg>/**/*.py  it writes an optimised, unchecked .pyc right next to
the module and removes the original .py + any __pycache__ dirs. The result still
imports exactly the same (CPython's SourcelessFileLoader handles bare .pyc), but
ships no readable source — so a casual look at the container reveals nothing
about what the service does.

Usage:  python tools/obfuscate.py /app/app
Build:  docker build --build-arg OBFUSCATE=1 .
Run AFTER deps are installed and with the SAME python version that will run it.
"""
import os
import sys
import shutil
import py_compile


def harden(root: str) -> None:
    compiled = removed = 0
    for base, dirs, files in os.walk(root):
        if "__pycache__" in dirs:
            shutil.rmtree(os.path.join(base, "__pycache__"), ignore_errors=True)
            dirs.remove("__pycache__")
        for fn in files:
            if not fn.endswith(".py"):
                continue
            src = os.path.join(base, fn)
            dst = src + "c"  # foo.py -> foo.pyc (same dir, sourceless)
            py_compile.compile(
                src, cfile=dst, optimize=2, quiet=1,
                invalidation_mode=py_compile.PycInvalidationMode.UNCHECKED_HASH,
            )
            os.remove(src)
            compiled += 1
            removed += 1
    print(f"[obfuscate] compiled {compiled} modules, stripped {removed} sources under {root}")


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "app"
    if not os.path.isdir(target):
        sys.exit(f"not a directory: {target}")
    harden(target)
