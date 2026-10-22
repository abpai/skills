CREATE TABLE users (
    id          bigserial PRIMARY KEY,
    email       platform.email_address NOT NULL,
    name        text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
