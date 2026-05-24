# -*- coding: utf-8 -*-
import re, sys

with open("generar_guia.py", "r", encoding="utf-8") as f:
    src = f.read()

# Replace every double-quoted string that contains an unescaped inner double-quote
# Strategy: find all " ... " spans and if they contain unescaped " inside, escape them
def fix_string(m):
    content = m.group(1)
    # escape any unescaped interior double quotes
    fixed = re.sub(r'(?<!\\)"', r'\\"', content)
    return '"' + fixed + '"'

# Match double-quoted strings (not triple) that contain inner quotes
# We process iteratively until stable
prev = None
result = src
while prev != result:
    prev = result
    result = re.sub(r'"((?:[^"\\]|\\.)*"(?:[^"\\]|\\.)*)"', fix_string, result)

with open("generar_guia.py", "w", encoding="utf-8") as f:
    f.write(result)
print("Fixed.")
