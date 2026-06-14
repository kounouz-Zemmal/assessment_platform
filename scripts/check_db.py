import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = BASE_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.db import connection

def check_db():
    with connection.cursor() as cursor:
        cursor.execute("SELECT id, name FROM public.semesters")
        semesters = cursor.fetchall()
        print(f"Semesters: {semesters}")
        
        cursor.execute("SELECT COUNT(*) FROM public.modules")
        modules_count = cursor.fetchone()[0]
        print(f"Modules count: {modules_count}")

if __name__ == "__main__":
    check_db()
