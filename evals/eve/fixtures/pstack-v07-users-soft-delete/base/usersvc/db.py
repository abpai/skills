import os


def connect(url=None):
    import psycopg

    return psycopg.connect(url or os.environ["DATABASE_URL"], autocommit=True)


def apply_migrations(conn, directory):
    for name in sorted(os.listdir(directory)):
        if name.endswith(".sql"):
            with open(os.path.join(directory, name)) as fh:
                conn.execute(fh.read())
