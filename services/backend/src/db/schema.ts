// Esquema do banco como string, para poder ser aplicado tanto localmente quanto em
// ambientes serverless (Vercel), onde não é confiável ler arquivos .sql do disco.
// Mantido em sincronia com schema.sql (mesma fonte da verdade).
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY, email VARCHAR(180) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('tutor','clinic','veterinarian')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS email_codes (
  id UUID PRIMARY KEY, email VARCHAR(180) NOT NULL, code VARCHAR(10) NOT NULL,
  purpose VARCHAR(20) NOT NULL CHECK (purpose IN ('recovery','verification')),
  expires_at TIMESTAMP NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_email_codes_lookup ON email_codes (email, purpose);
-- E-mails agora são sempre guardados em minúsculas. No PostgreSQL "=" diferencia
-- maiúsculas, então contas gravadas como "Ana@Gmail.com" nunca eram encontradas pelas
-- rotas que normalizam o e-mail (verificação/reenvio), e o aviso voltava a pedir o código.
UPDATE users u SET email = LOWER(u.email)
  WHERE u.email <> LOWER(u.email)
    AND NOT EXISTS (SELECT 1 FROM users o WHERE o.id <> u.id AND o.email = LOWER(u.email));
UPDATE email_codes SET email = LOWER(email) WHERE email <> LOWER(email);
-- Impede novas contas duplicadas que só diferem por maiúsculas. Se o banco já tiver
-- duplicatas, o índice é ignorado (o cadastro já bloqueia o caso pela busca normalizada).
DO $$ BEGIN
  BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower ON users (LOWER(email));
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'E-mails duplicados por maiuscula/minuscula: indice unico nao criado.';
  END;
END $$;
CREATE TABLE IF NOT EXISTS tutors (
  id UUID PRIMARY KEY, user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL, phone VARCHAR(30), cpf VARCHAR(14) UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS clinics (
  id UUID PRIMARY KEY, user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  trade_name VARCHAR(180) NOT NULL, corporate_name VARCHAR(180), cnpj VARCHAR(18) UNIQUE, phone VARCHAR(30), address VARCHAR(255),
  connection_code VARCHAR(32) UNIQUE, services JSONB, working_hours JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS veterinarians (
  id UUID PRIMARY KEY, user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL, crmv VARCHAR(50) NOT NULL, crmv_uf CHAR(2) NOT NULL, specialty VARCHAR(120), phone VARCHAR(30),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_veterinarian_crmv_state UNIQUE (crmv, crmv_uf)
);
ALTER TABLE veterinarians ADD COLUMN IF NOT EXISTS working_hours JSONB;
CREATE TABLE IF NOT EXISTS clinic_veterinarians (
  id UUID PRIMARY KEY, clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE, veterinarian_id UUID NOT NULL REFERENCES veterinarians(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  requested_by VARCHAR(20) NOT NULL CHECK (requested_by IN ('clinic','veterinarian')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_clinic_veterinarian UNIQUE (clinic_id, veterinarian_id)
);
CREATE TABLE IF NOT EXISTS pets (
  id UUID PRIMARY KEY, current_tutor_id UUID REFERENCES tutors(id) ON DELETE SET NULL, linked_clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL,
  name VARCHAR(120) NOT NULL, species VARCHAR(80) NOT NULL, breed VARCHAR(120), age VARCHAR(50), weight VARCHAR(50), photo TEXT,
  allergies JSONB, conditions JSONB, is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE pets ADD COLUMN IF NOT EXISTS sex VARCHAR(20);
ALTER TABLE pets ADD COLUMN IF NOT EXISTS neutered BOOLEAN;
-- Data de nascimento: quando preenchida, a idade é calculada na hora de exibir (e o
-- sistema manda os parabéns no dia). A coluna "age" continua para pets resgatados,
-- em que só se sabe a idade aproximada.
ALTER TABLE pets ADD COLUMN IF NOT EXISTS birth_date DATE;
-- Clínica que criou o cadastro (diferente de linked_clinic_id, que é só o vínculo atual):
-- permite à clínica listar depois os pets que ela mesma cadastrou.
ALTER TABLE pets ADD COLUMN IF NOT EXISTS registered_by_clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS pet_ownership_history (
  id UUID PRIMARY KEY, pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  previous_tutor_id UUID REFERENCES tutors(id) ON DELETE SET NULL, new_tutor_id UUID NOT NULL REFERENCES tutors(id) ON DELETE RESTRICT,
  transferred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY, pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE RESTRICT, pet_name VARCHAR(120) NOT NULL,
  tutor_id UUID NOT NULL REFERENCES tutors(id) ON DELETE RESTRICT, veterinarian_id UUID REFERENCES veterinarians(id) ON DELETE RESTRICT,
  clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL, clinic_name VARCHAR(180), veterinarian_name VARCHAR(120),
  veterinarian_email VARCHAR(180), veterinarian_phone VARCHAR(30), appointment_date DATE NOT NULL, appointment_time TIME NOT NULL,
  reason TEXT NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Remove agendamentos duplicados (mesmo vet/data/hora), mantendo o mais antigo.
DELETE FROM appointments a USING appointments b
  WHERE a.status = 'scheduled' AND b.status = 'scheduled'
    AND a.veterinarian_id IS NOT NULL AND a.veterinarian_id = b.veterinarian_id
    AND a.appointment_date = b.appointment_date AND a.appointment_time = b.appointment_time
    AND (a.created_at, a.id) > (b.created_at, b.id);
-- Impede o mesmo veterinário ter dois agendamentos no mesmo horário.
CREATE UNIQUE INDEX IF NOT EXISTS uq_appointment_vet_slot
  ON appointments (veterinarian_id, appointment_date, appointment_time)
  WHERE status = 'scheduled' AND veterinarian_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY, appointment_id UUID NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE, tutor_id UUID NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
  veterinarian_id UUID NOT NULL REFERENCES veterinarians(id) ON DELETE CASCADE, clinic_name VARCHAR(180), rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS medical_records (
  id UUID PRIMARY KEY, pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE RESTRICT, veterinarian_id UUID REFERENCES veterinarians(id) ON DELETE SET NULL,
  veterinarian_name VARCHAR(120), clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL, clinic_name VARCHAR(180), record_date DATE NOT NULL,
  description TEXT NOT NULL, treatment TEXT, documents JSONB,
  added_by VARCHAR(20) NOT NULL DEFAULT 'veterinarian' CHECK (added_by IN ('tutor','veterinarian','clinic')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
CREATE TABLE IF NOT EXISTS vaccines (
  id UUID PRIMARY KEY, pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE RESTRICT, veterinarian_id UUID REFERENCES veterinarians(id) ON DELETE SET NULL,
  veterinarian_name VARCHAR(120), clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL, clinic_name VARCHAR(180), name VARCHAR(120) NOT NULL,
  applied_date DATE NOT NULL, next_dose_date DATE, status VARCHAR(20) NOT NULL DEFAULT 'up-to-date' CHECK (status IN ('up-to-date','late')),
  added_by VARCHAR(20) NOT NULL DEFAULT 'veterinarian' CHECK (added_by IN ('tutor','veterinarian','clinic')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE vaccines ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
-- Foto opcional da vacina ou da carteirinha (data URL de imagem, já reduzida no navegador).
ALTER TABLE vaccines ADD COLUMN IF NOT EXISTS photo TEXT;
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY, pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE RESTRICT,
  veterinarian_id UUID NOT NULL REFERENCES veterinarians(id) ON DELETE RESTRICT, target_clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL,
  reason TEXT NOT NULL, referral_code VARCHAR(12) NOT NULL UNIQUE, status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','expired')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, pet_id UUID REFERENCES pets(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL, source_key VARCHAR(120),
  type VARCHAR(20) NOT NULL CHECK (type IN ('vaccine','appointment','connection','referral')), title VARCHAR(180) NOT NULL, message TEXT NOT NULL,
  notification_date DATE NOT NULL, read_at TIMESTAMP, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Abre espaço para o aviso de aniversário do pet. Procura o CHECK pelo conteúdo (e não
-- pelo nome, que pode variar entre bancos) e só mexe quando ele ainda não aceita
-- 'birthday' — assim o ALTER não roda a cada boot.
DO $$
DECLARE constraint_row record; needs_fix boolean := FALSE;
BEGIN
  FOR constraint_row IN
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = 'notifications'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%referral%'
  LOOP
    IF constraint_row.def NOT ILIKE '%birthday%' THEN
      EXECUTE format('ALTER TABLE notifications DROP CONSTRAINT %I', constraint_row.conname);
      needs_fix := TRUE;
    END IF;
  END LOOP;

  IF needs_fix THEN
    ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
      CHECK (type IN ('vaccine','appointment','connection','referral','birthday'));
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS vet_passes (
  id UUID PRIMARY KEY, pass_code VARCHAR(64) NOT NULL UNIQUE, tutor_id UUID NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE, pet_name VARCHAR(120) NOT NULL, documents JSONB NOT NULL,
  redeemed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL, redeemed_at TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Escopo do Vet-Pass por categoria (responsável escolhe o que liberar). Default TRUE p/ passes antigos.
ALTER TABLE vet_passes ADD COLUMN IF NOT EXISTS includes_medical_records BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE vet_passes ADD COLUMN IF NOT EXISTS includes_vaccines BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE vet_passes ADD COLUMN IF NOT EXISTS includes_exams BOOLEAN NOT NULL DEFAULT TRUE;
-- Guarda compartilhada: responsáveis adicionais (além do responsável principal em pets.current_tutor_id).
CREATE TABLE IF NOT EXISTS pet_guardians (
  id UUID PRIMARY KEY, pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  tutor_id UUID NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_pet_guardian UNIQUE (pet_id, tutor_id)
);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON users; CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS tutors_updated_at ON tutors; CREATE TRIGGER tutors_updated_at BEFORE UPDATE ON tutors FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS clinics_updated_at ON clinics; CREATE TRIGGER clinics_updated_at BEFORE UPDATE ON clinics FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS veterinarians_updated_at ON veterinarians; CREATE TRIGGER veterinarians_updated_at BEFORE UPDATE ON veterinarians FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS clinic_veterinarians_updated_at ON clinic_veterinarians; CREATE TRIGGER clinic_veterinarians_updated_at BEFORE UPDATE ON clinic_veterinarians FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS pets_updated_at ON pets; CREATE TRIGGER pets_updated_at BEFORE UPDATE ON pets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS appointments_updated_at ON appointments; CREATE TRIGGER appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS reviews_updated_at ON reviews; CREATE TRIGGER reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS medical_records_updated_at ON medical_records; CREATE TRIGGER medical_records_updated_at BEFORE UPDATE ON medical_records FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS vaccines_updated_at ON vaccines; CREATE TRIGGER vaccines_updated_at BEFORE UPDATE ON vaccines FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS referrals_updated_at ON referrals; CREATE TRIGGER referrals_updated_at BEFORE UPDATE ON referrals FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS notifications_updated_at ON notifications; CREATE TRIGGER notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS vet_passes_updated_at ON vet_passes; CREATE TRIGGER vet_passes_updated_at BEFORE UPDATE ON vet_passes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
`;
