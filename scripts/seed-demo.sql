-- Datos de ejemplo para probar el panel de revisión sin pasar por el portal.
-- Uso: make seed   (o psql "$DATABASE_URL" -f scripts/seed-demo.sql)
-- Es idempotente: no hace nada si el formulario de ejemplo ya existe.
DO $$
DECLARE
    org uuid;
    f uuid;
    v uuid;
    s uuid;
    schema jsonb := '{
      "sections": [
        {"key": "empresa", "title": "Datos de la empresa", "fields": [
          {"key": "razon_social", "type": "text", "label": "Razón social", "required": true},
          {"key": "rut", "type": "id_number", "label": "RUT"},
          {"key": "tipo", "type": "select", "label": "Tipo de sociedad", "options": ["SpA", "SRL", "Persona natural"]},
          {"key": "fecha_constitucion", "type": "date", "label": "Fecha de constitución"},
          {"key": "estatutos", "type": "file", "label": "Estatutos"}
        ]},
        {"key": "contacto", "title": "Contacto", "fields": [
          {"key": "email_contacto", "type": "email", "label": "Email de contacto"},
          {"key": "telefono", "type": "phone", "label": "Teléfono"}
        ]},
        {"key": "socios_sec", "title": "Socios", "fields": [
          {"key": "socios", "type": "repeater", "label": "Socios", "fields": [
            {"key": "nombre", "type": "text", "label": "Nombre"},
            {"key": "participacion", "type": "number", "label": "% participación"}
          ]}
        ]}
      ]
    }';
BEGIN
    SELECT id INTO org FROM organizations ORDER BY created_at LIMIT 1;
    IF EXISTS (SELECT 1 FROM forms WHERE organization_id = org AND title = 'Onboarding empresa (ejemplo)') THEN
        RETURN;
    END IF;

    INSERT INTO forms (organization_id, title, description, status, draft_schema)
    VALUES (org, 'Onboarding empresa (ejemplo)', 'Formulario KYB de ejemplo', 'published', schema)
    RETURNING id INTO f;
    INSERT INTO form_versions (form_id, version_number, schema) VALUES (f, 1, schema) RETURNING id INTO v;
    UPDATE forms SET current_version_id = v WHERE id = f;

    INSERT INTO submissions (organization_id, form_id, form_version_id, applicant_email, applicant_name,
                             access_token_hash, status, data, submitted_at, created_at)
    VALUES
      (org, f, v, 'maria@andescargo.cl', 'María González', 'demo-1', 'submitted',
       '{"razon_social":"Andes Cargo SpA","rut":"76.123.456-7","tipo":"SpA","fecha_constitucion":"2019-03-14",
         "email_contacto":"maria@andescargo.cl","telefono":"+56 9 1234 5678",
         "socios":[{"nombre":"María González","participacion":60},{"nombre":"Luis Rojas","participacion":40}]}',
       now() - interval '2 hours', now() - interval '3 hours'),
      (org, f, v, 'jorge@panaderialuz.pe', 'Jorge Quispe', 'demo-2', 'submitted',
       '{"razon_social":"Panadería Luz SRL","tipo":"SRL","email_contacto":"jorge@panaderialuz.pe",
         "socios":[{"nombre":"Jorge Quispe","participacion":100}]}',
       now() - interval '1 day', now() - interval '1 day'),
      (org, f, v, 'ana@estudiomora.com', 'Ana Mora', 'demo-3', 'approved',
       '{"razon_social":"Estudio Mora","tipo":"Persona natural","email_contacto":"ana@estudiomora.com"}',
       now() - interval '3 days', now() - interval '3 days'),
      (org, f, v, 'carlos@borrador.com', 'Carlos Díaz', 'demo-4', 'draft',
       '{"razon_social":"Díaz y Cía"}', NULL, now() - interval '1 hour');

    SELECT id INTO s FROM submissions WHERE access_token_hash = 'demo-1';
    INSERT INTO submission_files (submission_id, field_key, storage_key, filename, mime_type, size_bytes)
    VALUES (s, 'estatutos', 'demo/estatutos.pdf', 'Estatutos Andes Cargo.pdf', 'application/pdf', 48213);
    INSERT INTO audit_events (submission_id, actor_type, action, from_status, to_status)
    VALUES (s, 'applicant', 'submitted', 'draft', 'submitted');

    SELECT id INTO s FROM submissions WHERE access_token_hash = 'demo-2';
    INSERT INTO audit_events (submission_id, actor_type, action, from_status, to_status, created_at)
    VALUES (s, 'applicant', 'submitted', 'draft', 'submitted', now() - interval '1 day');

    SELECT id INTO s FROM submissions WHERE access_token_hash = 'demo-3';
    UPDATE submissions SET decided_at = now() - interval '2 days' WHERE id = s;
    INSERT INTO audit_events (submission_id, actor_type, action, from_status, to_status, created_at)
    VALUES (s, 'applicant', 'submitted', 'draft', 'submitted', now() - interval '3 days'),
           (s, 'system', 'approved', 'submitted', 'approved', now() - interval '2 days');
END $$;
