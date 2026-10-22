TEST_DATABASE_URL ?= postgresql://usersvc:usersvc@localhost:55432/usersvc

.PHONY: test db-up db-down

db-up:
	docker compose -f docker-compose.test.yml up -d --wait

db-down:
	docker compose -f docker-compose.test.yml down -v

test: db-up
	TEST_DATABASE_URL=$(TEST_DATABASE_URL) python -m unittest -v; status=$$?; $(MAKE) db-down; exit $$status
