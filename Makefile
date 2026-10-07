.PHONY: up down db api web seed seed-envios test

up:            ## Levanta todo con Docker
	docker compose up --build

down:
	docker compose down

db:            ## Solo Postgres, para desarrollo local
	docker compose up -d db

api:           ## API en Go contra la base local
	cd api && ADMIN_EMAIL=$${ADMIN_EMAIL:-admin@formsis.local} ADMIN_PASSWORD=$${ADMIN_PASSWORD:-cambiame123} go run ./cmd/api

seed:          ## Formulario KYB de prueba con enlace público /f/demo-kyb
	cd api && go run ./cmd/seed

web:           ## Frontend en modo desarrollo
	cd web && npm run dev

test:
	cd api && go vet ./... && go test ./...
	cd web && npm run lint

seed-envios:   ## Envíos de ejemplo en varios estados para probar el panel
	docker compose exec -T db psql -U formsis formsis < scripts/seed-demo.sql
