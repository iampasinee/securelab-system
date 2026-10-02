import argparse
import getpass
import os
from time import perf_counter

from sqlalchemy import select, func

from app.core.database import get_engine
from app.models import users, admin_profiles
from app.repositories.base import create, now
from app.schemas.auth import validate_password
from app.services.auth import hash_password
from app.services.audit import audit


def bootstrap(email, name, code):
    if not email.lower().endswith('@itm.kmutnb.ac.th') or not email.split('@')[0]:
        raise ValueError('Admin email must use @itm.kmutnb.ac.th')
    password = os.environ.get('SECURELAB_BOOTSTRAP_PASSWORD') or getpass.getpass('SecureLab Admin password: ')
    validate_password(password)
    encoded = hash_password(password)
    with get_engine().begin() as db:
        if db.scalar(select(func.count()).select_from(users).where(users.c.role == 'admin')):
            raise ValueError('An Admin already exists. Provision additional accounts through the Admin API.')
        user = create(db, users, {'email': email.lower(), 'full_name': name, 'role': 'admin', 'password_hash': encoded, 'activated_at': now()})
        create(db, admin_profiles, {'user_id': user['id'], 'admin_code': code})
        audit(db, user, 'auth.bootstrap', 'user', user['id'])
    print('Admin account created. Password is stored as Argon2id only.')


def main():
    parser = argparse.ArgumentParser(prog='securelab')
    commands = parser.add_subparsers(dest='command', required=True)
    admin = commands.add_parser('bootstrap-admin')
    admin.add_argument('--email', required=True)
    admin.add_argument('--name', required=True)
    admin.add_argument('--code', default='ADMIN001')
    commands.add_parser('seed-development')
    commands.add_parser('worker')
    commands.add_parser('benchmark-password')
    commands.add_parser('migrate')
    maintenance = commands.add_parser('quarantine-orphans')
    maintenance.add_argument('--age-hours', type=int, default=24)
    args = parser.parse_args()
    if args.command == 'bootstrap-admin':
        bootstrap(args.email, args.name, args.code)
    elif args.command == 'seed-development':
        from app.services.seed import seed_development
        seed_development()
    elif args.command == 'worker':
        from app.worker import main as worker_main
        worker_main()
    elif args.command == 'benchmark-password':
        elapsed = []
        for _ in range(5):
            started = perf_counter()
            hash_password('BenchmarkOnly123')
            elapsed.append(perf_counter() - started)
        print(f'Argon2id 64 MiB / time 3 / parallelism 4: average {sum(elapsed) / len(elapsed):.3f}s')
    elif args.command == 'migrate':
        from alembic import command
        from alembic.config import Config
        from app.services.database_roles import provision, grant_application_permissions
        from app.core.config import get_settings
        password = os.environ.get('APP_DB_PASSWORD')
        if not password:
            raise ValueError('APP_DB_PASSWORD is required for explicit database provisioning')
        provision(password)
        command.upgrade(Config('alembic.ini'), 'head')
        grant_application_permissions()
        root = get_settings().storage_root
        root.mkdir(parents=True, exist_ok=True)
        if hasattr(os, 'getuid') and os.getuid() == 0:
            os.chown(root, 10001, 10001)
        print('Migrations and application permissions are ready.')
    elif args.command == 'quarantine-orphans':
        if args.age_hours < 1:
            raise ValueError('Safety age must be at least one hour')
        from app.services.storage_maintenance import quarantine_orphans
        print(f'Quarantined {quarantine_orphans(args.age_hours)} unacknowledged files. Acknowledged content was preserved.')


if __name__ == '__main__':
    main()
