import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.academics.models import Module
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
