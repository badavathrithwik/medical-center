-- IIT Ropar Medical Center Database Schema

-- Drop existing tables (in reverse dependency order)
DROP TABLE IF EXISTS feedback CASCADE;
DROP TABLE IF EXISTS prescriptions CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS doctor_slots CASCADE;
DROP TABLE IF EXISTS medical_records CASCADE;
DROP TABLE IF EXISTS health_bulletins CASCADE;
DROP TABLE IF EXISTS doctors CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'student' CHECK (role IN ('student', 'admin', 'doctor')),
    phone VARCHAR(20),
    department VARCHAR(100),
    roll_number VARCHAR(50),
    gender VARCHAR(10),
    date_of_birth DATE,
    user_type VARCHAR(20) DEFAULT 'student',
    is_handicapped BOOLEAN DEFAULT FALSE,
    reset_password_token VARCHAR(255),
    reset_password_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- DOCTORS TABLE
-- ============================================
CREATE TABLE doctors (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    specialization VARCHAR(100) NOT NULL,
    qualification VARCHAR(200),
    experience_years INTEGER DEFAULT 0,
    phone VARCHAR(20),
    email VARCHAR(150),
    bio TEXT,
    photo_url VARCHAR(255) DEFAULT '/images/default-doctor.png',
    gender VARCHAR(10),
    symptom_tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- DOCTOR SLOTS TABLE
-- ============================================
CREATE TABLE doctor_slots (
    id SERIAL PRIMARY KEY,
    doctor_id INTEGER REFERENCES doctors(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    -- 0=Sunday, 1=Monday, ..., 6=Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    max_patients INTEGER DEFAULT 10,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- MEDICAL RECORDS TABLE
-- ============================================
CREATE TABLE medical_records (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    blood_group VARCHAR(5),
    allergies TEXT,
    chronic_conditions TEXT,
    current_medications TEXT,
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(20),
    emergency_contact_relation VARCHAR(50),
    height_cm DECIMAL(5,2),
    weight_kg DECIMAL(5,2),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- APPOINTMENTS TABLE
-- ============================================
CREATE TABLE appointments (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    doctor_id INTEGER REFERENCES doctors(id) ON DELETE CASCADE,
    slot_id INTEGER REFERENCES doctor_slots(id) ON DELETE SET NULL,
    appointment_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no-show')),
    symptoms TEXT,
    notes TEXT,
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'emergency')),
    prefer_female_doctor BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PRESCRIPTIONS TABLE
-- ============================================
CREATE TABLE prescriptions (
    id SERIAL PRIMARY KEY,
    appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
    doctor_id INTEGER REFERENCES doctors(id) ON DELETE SET NULL,
    patient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    diagnosis TEXT NOT NULL,
    medicines JSONB NOT NULL DEFAULT '[]',
    -- Array of {name, dosage, frequency, duration, instructions}
    tests_recommended TEXT,
    instructions TEXT,
    follow_up_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- HEALTH BULLETINS TABLE
-- ============================================
CREATE TABLE health_bulletins (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'general',
    author VARCHAR(100) DEFAULT 'Medical Officer',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- FEEDBACK TABLE
-- ============================================
CREATE TABLE feedback (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    subject VARCHAR(200),
    message TEXT NOT NULL,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    is_anonymous BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
    admin_response TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX idx_doctor_slots_doctor ON doctor_slots(doctor_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
