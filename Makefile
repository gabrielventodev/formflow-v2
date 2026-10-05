.PHONY: up down db api web test

up:            ## Levanta todo con Docker
	docker compose up --build

down:
	docker compose down

db:            ## Solo Postgres, para desarrollo local
	docker compose up -d db

api:           ## API en Go contra la base local
	cd api && go run ./cmd/api

web:           ## Frontend en modo desarrollo
	cd web && npm run dev

test:
	cd api && go vet ./... && go test ./...
	cd web && npm run lint
