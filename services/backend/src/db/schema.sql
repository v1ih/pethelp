CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY, email VARCHAR(180) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('tutor','clinic','veterinarian')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
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
CREATE TABLE IF NOT EXISTS vaccines (
  id UUID PRIMARY KEY, pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE RESTRICT, veterinarian_id UUID REFERENCES veterinarians(id) ON DELETE SET NULL,
  veterinarian_name VARCHAR(120), clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL, clinic_name VARCHAR(180), name VARCHAR(120) NOT NULL,
  applied_date DATE NOT NULL, next_dose_date DATE, status VARCHAR(20) NOT NULL DEFAULT 'up-to-date' CHECK (status IN ('up-to-date','late')),
  added_by VARCHAR(20) NOT NULL DEFAULT 'veterinarian' CHECK (added_by IN ('tutor','veterinarian','clinic')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
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
CREATE TABLE IF NOT EXISTS vet_passes (
  id UUID PRIMARY KEY, pass_code VARCHAR(64) NOT NULL UNIQUE, tutor_id UUID NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE, pet_name VARCHAR(120) NOT NULL, documents JSONB NOT NULL,
  redeemed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL, redeemed_at TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
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
