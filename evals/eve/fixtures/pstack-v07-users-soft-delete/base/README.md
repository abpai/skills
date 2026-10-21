# usersvc

User records for the accounts platform, stored in Postgres.

## Tests

Repository tests run against the platform's Postgres test image (internal
registry; VPN required) with the platform extensions and seed roles installed:

```sh
pip install -r requirements.txt
make test
```

`make test` starts the database with `docker-compose.test.yml`, applies
`migrations/` in order, and runs the suite with `TEST_DATABASE_URL` set.
Without `TEST_DATABASE_URL` the repository tests are skipped.
