# -*- coding: utf-8 -*-
# Lee el script actual y lo reescribe de forma limpia
import re

path = r"d:\PROYECTOS WEB\cea-plataforma\web\generar_guia.py"

with open(path, "r", encoding="utf-8") as f:
    src = f.read()

# Restore the file from scratch using safe string construction
# The real fix: replace all occurrences in the source where
# a string like "... "word" ..." (inner quotes) appears,
# replace inner straight quotes with unicode curly quotes
# So they render visually the same but don't break Python

# Use unicode curly quotes: “ = " (left), ” = " (right)
LQ = "“"  # "
RQ = "”"  # "

# Strategy: find all Python string content between outer double quotes
# and replace any unescaped inner " with the unicode equivalents
# We process using a simple state machine

result = []
i = 0
in_string = False
str_char = None
prev = None

while i < len(src):
    c = src[i]

    if not in_string:
        if c in ('"', "'"):
            # Check for triple quote
            if src[i:i+3] in ('"""', "'''"):
                result.append(src[i:i+3])
                i += 3
                continue
            in_string = True
            str_char = c
            result.append(c)
        else:
            result.append(c)
    else:
        if c == '\\':
            result.append(c)
            result.append(src[i+1] if i+1 < len(src) else '')
            i += 2
            continue
        elif c == str_char:
            in_string = False
            str_char = None
            result.append(c)
        elif c == '"' and str_char == '"':
            # Inner double quote inside double-quoted string - replace with unicode
            result.append(LQ)
        else:
            result.append(c)
    i += 1

fixed = "".join(result)

with open(path, "w", encoding="utf-8") as f:
    f.write(fixed)

print("Done. Checking syntax...")
import py_compile
try:
    py_compile.compile(path, doraise=True)
    print("Syntax OK!")
except py_compile.PyCompileError as e:
    print(f"Error: {e}")
