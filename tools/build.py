# Сборка SQL-файлов: python3 tools/build.py
# 1) генерирует каталог подарков, 2) собирает supabase/stage3.sql,
# 3) кладёт весь SQL в js/setup-sql.js для кнопки «Скопировать» на setup.html
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'gen_gifts.py')], check=True)

src = open(os.path.join(ROOT, 'tools', 'stage3.src.sql'), encoding='utf-8').read()
data = open(os.path.join(ROOT, 'supabase', 'stage3-data.sql'), encoding='utf-8').read()
stage3 = src.replace('@@DATA@@', data)
open(os.path.join(ROOT, 'supabase', 'stage3.sql'), 'w', encoding='utf-8').write(stage3)
os.remove(os.path.join(ROOT, 'supabase', 'stage3-data.sql'))

stage4 = open(os.path.join(ROOT, 'tools', 'stage4.src.sql'), encoding='utf-8').read()
open(os.path.join(ROOT, 'supabase', 'stage4.sql'), 'w', encoding='utf-8').write(stage4)

stage2 = open(os.path.join(ROOT, 'supabase', 'stage2.sql'), encoding='utf-8').read()
full = stage2 + '\n\n' + stage3 + '\n\n' + stage4
js = ('// Создаётся автоматически (tools/build.py) — не редактируй вручную\n'
      'export const ALL_SQL = ' + json.dumps(full, ensure_ascii=False) + ';\n')
open(os.path.join(ROOT, 'js', 'setup-sql.js'), 'w', encoding='utf-8').write(js)
old = os.path.join(ROOT, 'js', 'stage2-sql.js')
if os.path.exists(old): os.remove(old)
print('stage3.sql:', len(stage3.splitlines()), 'lines; all:', len(full.splitlines()), 'lines,', len(full) // 1024, 'KB')
