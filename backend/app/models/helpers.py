from sqlalchemy import BigInteger, CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, SmallInteger, String, Table, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


def uuid(name='id', foreign=None, nullable=False, primary=False):
    args = [ForeignKey(foreign, ondelete='RESTRICT')] if foreign else []
    return Column(name, UUID(as_uuid=True), *args, nullable=nullable, primary_key=primary, server_default=text('gen_random_uuid()') if name == 'id' else None)


def timestamp(name, nullable=False):
    return Column(name, DateTime(timezone=True), nullable=nullable)


def check(expression, name):
    return CheckConstraint(expression, name=name)


def choice(name, options, default=None):
    values = ','.join("'" + value + "'" for value in options.split('/'))
    return [Column(name, Text, nullable=False, server_default=default), check(f'{name} IN ({values})', name)]


def table(name, *items, mutable=True, created=True):
    columns = list(items)
    if created:
        columns.append(Column('created_at', DateTime(timezone=True), nullable=False, server_default=func.now()))
    if mutable:
        columns.extend([
            Column('updated_at', DateTime(timezone=True), nullable=False, server_default=func.now()),
            Column('row_version', BigInteger, nullable=False, server_default='1'),
            check('row_version >= 1', 'row_version'),
        ])
    result = Table(name, Base.metadata, *columns)
    # Every foreign key has a lookup index, including nullable references.
    for column in result.c:
        if column.foreign_keys and not column.primary_key:
            Index(f'ix_{name}_{column.name}', column)
    return result


def catalog(name, parent=None):
    cols = [uuid(primary=True)]
    if parent:
        cols.append(uuid(parent[0], parent[1]))
    cols += [Column('code', String(30), nullable=False), Column('name', String(150), nullable=False), *choice('status', 'active/inactive', 'active'),
             check("code ~ '^[A-Z0-9][A-Z0-9-]{0,29}$'", 'code'), check("length(btrim(name)) > 0", 'name')]
    result = table(name, *cols)
    scope = [result.c[parent[0]]] if parent else []
    Index(f'uq_{name}_normalized_code', *scope, func.lower(result.c.code), unique=True)
    Index(f'uq_{name}_normalized_name', *scope, func.lower(result.c.name), unique=True)
    return result


def year(name):
    return [Column(name, SmallInteger, nullable=False), check(f'{name} >= 2500', name)]
