const db = require('../config/db');

// ===================== USERS =====================
const userQueries = {
    findByEmail: (email) =>
        db.query('SELECT * FROM users WHERE email = $1', [email]),

    findById: (id) =>
        db.query('SELECT * FROM users WHERE id = $1', [id]),

    create: (data) =>
        db.query(
            `INSERT INTO users (name, email, password, role, phone, department, roll_number, gender, date_of_birth)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [data.name, data.email, data.password, data.role || 'student',
                data.phone, data.department, data.roll_number, data.gender, data.date_of_birth]
        ),

    getAll: (role) =>
        role ? db.query('SELECT * FROM users WHERE role = $1 ORDER BY name', [role])
            : db.query('SELECT * FROM users ORDER BY name'),

    getStudents: () =>
        db.query("SELECT * FROM users WHERE role = 'student' ORDER BY name"),

    search: (query) =>
        db.query(
            `SELECT * FROM users WHERE role = 'student' 
             AND (LOWER(name) LIKE LOWER($1) OR LOWER(email) LIKE LOWER($1) OR LOWER(roll_number) LIKE LOWER($1))
             ORDER BY name`,
            [`%${query}%`]
        ),

    update: (id, data) =>
        db.query(
            `UPDATE users SET name=$1, phone=$2, department=$3, gender=$4, date_of_birth=$5, updated_at=NOW()
             WHERE id=$6 RETURNING *`,
            [data.name, data.phone, data.department, data.gender, data.date_of_birth, id]
        ),
};

// ===================== DOCTORS =====================
const doctorQueries = {
    getAll: () =>
        db.query('SELECT * FROM doctors WHERE is_active = TRUE ORDER BY name'),

    findById: (id) =>
        db.query('SELECT * FROM doctors WHERE id = $1', [id]),

    findByUserId: (userId) =>
        db.query('SELECT * FROM doctors WHERE user_id = $1', [userId]),

    getSlots: (doctorId) =>
        db.query('SELECT * FROM doctor_slots WHERE doctor_id = $1 ORDER BY day_of_week, start_time', [doctorId]),

    getAvailableSlots: (doctorId, dayOfWeek) =>
        db.query(
            'SELECT * FROM doctor_slots WHERE doctor_id = $1 AND day_of_week = $2 AND is_available = TRUE ORDER BY start_time',
            [doctorId, dayOfWeek]
        ),

    getSlotById: (slotId) =>
        db.query('SELECT * FROM doctor_slots WHERE id = $1', [slotId]),
};

// ===================== APPOINTMENTS =====================
const appointmentQueries = {
    create: (data) =>
        db.query(
            `INSERT INTO appointments (patient_id, doctor_id, slot_id, appointment_date, symptoms, priority)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [data.patient_id, data.doctor_id, data.slot_id, data.appointment_date, data.symptoms, data.priority || 'normal']
        ),

    findById: (id) =>
        db.query(
            `SELECT a.*, d.name as doctor_name, d.specialization, u.name as patient_name, u.roll_number, u.email as patient_email
             FROM appointments a
             JOIN doctors d ON a.doctor_id = d.id
             JOIN users u ON a.patient_id = u.id
             WHERE a.id = $1`, [id]
        ),

    getByPatient: (patientId) =>
        db.query(
            `WITH active_queue AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY doctor_id, appointment_date, slot_id
                        ORDER BY created_at, id
                    ) AS queue_position,
                    COUNT(*) OVER (
                        PARTITION BY doctor_id, appointment_date, slot_id
                    ) AS queue_size
                FROM appointments
                WHERE status != 'cancelled'
            )
            SELECT a.*, d.name as doctor_name, d.specialization,
                   ds.start_time, ds.end_time,
                   aq.queue_position, aq.queue_size
             FROM appointments a
             JOIN doctors d ON a.doctor_id = d.id
             LEFT JOIN doctor_slots ds ON a.slot_id = ds.id
             LEFT JOIN active_queue aq ON aq.id = a.id
             WHERE a.patient_id = $1
             ORDER BY a.appointment_date DESC, ds.start_time DESC NULLS LAST, a.created_at DESC`, [patientId]
        ),

    getUpcomingQueueSnapshots: (patientId) =>
        db.query(
            `WITH patient_upcoming AS (
                SELECT a.id, a.patient_id, a.doctor_id, a.slot_id, a.appointment_date,
                       a.status, a.created_at,
                       d.name AS doctor_name, d.specialization,
                       ds.start_time, ds.end_time
                FROM appointments a
                JOIN doctors d ON a.doctor_id = d.id
                LEFT JOIN doctor_slots ds ON a.slot_id = ds.id
                WHERE a.patient_id = $1
                  AND a.status != 'cancelled'
                  AND a.appointment_date >= CURRENT_DATE
            )
            SELECT pu.id AS appointment_id,
                   pu.appointment_date,
                   pu.status,
                   pu.doctor_name,
                   pu.specialization,
                   pu.start_time,
                   pu.end_time,
                   qa.id AS queue_appointment_id,
                   qa.patient_id AS queue_patient_id,
                   u.name AS queue_patient_name,
                   ROW_NUMBER() OVER (
                       PARTITION BY pu.id
                       ORDER BY qa.created_at, qa.id
                   ) AS queue_position,
                   COUNT(*) OVER (
                       PARTITION BY pu.id
                   ) AS queue_size
            FROM patient_upcoming pu
            JOIN appointments qa
              ON qa.doctor_id = pu.doctor_id
             AND qa.slot_id = pu.slot_id
             AND qa.appointment_date = pu.appointment_date
             AND qa.status != 'cancelled'
            JOIN users u ON u.id = qa.patient_id
            ORDER BY pu.appointment_date, pu.start_time NULLS LAST, queue_position`,
            [patientId]
        ),

    getByDoctor: (doctorId) =>
        db.query(
            `SELECT a.*, u.name as patient_name, u.roll_number, u.email as patient_email, u.phone as patient_phone
             FROM appointments a
             JOIN users u ON a.patient_id = u.id
             WHERE a.doctor_id = $1
             ORDER BY a.appointment_date DESC, a.created_at DESC`, [doctorId]
        ),

    getAll: (filters = {}) => {
        let query = `
            SELECT a.*, d.name as doctor_name, d.specialization,
                   u.name as patient_name, u.roll_number, u.email as patient_email
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.id
            JOIN users u ON a.patient_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.status) {
            params.push(filters.status);
            query += ` AND a.status = $${params.length}`;
        }
        if (filters.date) {
            params.push(filters.date);
            query += ` AND a.appointment_date = $${params.length}`;
        }
        if (filters.doctor_id) {
            params.push(filters.doctor_id);
            query += ` AND a.doctor_id = $${params.length}`;
        }

        query += ' ORDER BY a.appointment_date DESC, a.created_at DESC';

        if (filters.limit) {
            params.push(filters.limit);
            query += ` LIMIT $${params.length}`;
        }

        return db.query(query, params);
    },

    updateStatus: (id, status, notes) =>
        db.query(
            'UPDATE appointments SET status = $1, notes = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
            [status, notes, id]
        ),

    countByDateAndSlot: (doctorId, date, slotId) =>
        db.query(
            `SELECT COUNT(*) as count FROM appointments 
             WHERE doctor_id = $1 AND appointment_date = $2 AND slot_id = $3 AND status != 'cancelled'`,
            [doctorId, date, slotId]
        ),

    getTodayCount: () =>
        db.query(
            `SELECT COUNT(*) as count FROM appointments WHERE appointment_date = CURRENT_DATE AND status != 'cancelled'`
        ),

    getByDateRange: (startDate, endDate) =>
        db.query(
            `SELECT a.*, d.name as doctor_name, d.specialization,
                    u.name as patient_name, u.roll_number
             FROM appointments a
             JOIN doctors d ON a.doctor_id = d.id
             JOIN users u ON a.patient_id = u.id
             WHERE a.appointment_date BETWEEN $1 AND $2
             ORDER BY a.appointment_date, a.created_at`,
            [startDate, endDate]
        ),

    checkExisting: (patientId, doctorId, date) =>
        db.query(
            `SELECT * FROM appointments 
             WHERE patient_id = $1 AND doctor_id = $2 AND appointment_date = $3 AND status != 'cancelled'`,
            [patientId, doctorId, date]
        ),
};

// ===================== PRESCRIPTIONS =====================
const prescriptionQueries = {
    create: (data) =>
        db.query(
            `INSERT INTO prescriptions (appointment_id, doctor_id, patient_id, diagnosis, medicines, tests_recommended, instructions, follow_up_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [data.appointment_id, data.doctor_id, data.patient_id, data.diagnosis,
                JSON.stringify(data.medicines), data.tests_recommended, data.instructions, data.follow_up_date || null]
        ),

    findById: (id) =>
        db.query(
            `SELECT p.*, d.name as doctor_name, d.specialization, u.name as patient_name, u.roll_number
             FROM prescriptions p
             JOIN doctors d ON p.doctor_id = d.id
             JOIN users u ON p.patient_id = u.id
             WHERE p.id = $1`, [id]
        ),

    getByPatient: (patientId) =>
        db.query(
            `SELECT p.*, d.name as doctor_name, d.specialization
             FROM prescriptions p
             JOIN doctors d ON p.doctor_id = d.id
             WHERE p.patient_id = $1
             ORDER BY p.created_at DESC`, [patientId]
        ),

    getAll: () =>
        db.query(
            `SELECT p.*, d.name as doctor_name, d.specialization, u.name as patient_name, u.roll_number
             FROM prescriptions p
             JOIN doctors d ON p.doctor_id = d.id
             JOIN users u ON p.patient_id = u.id
             ORDER BY p.created_at DESC`
        ),
};

// ===================== MEDICAL RECORDS =====================
const medicalRecordQueries = {
    getByPatient: (patientId) =>
        db.query('SELECT * FROM medical_records WHERE patient_id = $1', [patientId]),

    upsert: (data) =>
        db.query(
            `INSERT INTO medical_records (patient_id, blood_group, allergies, chronic_conditions, current_medications,
             emergency_contact_name, emergency_contact_phone, emergency_contact_relation, height_cm, weight_kg)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (patient_id) DO UPDATE SET
             blood_group = EXCLUDED.blood_group, allergies = EXCLUDED.allergies,
             chronic_conditions = EXCLUDED.chronic_conditions, current_medications = EXCLUDED.current_medications,
             emergency_contact_name = EXCLUDED.emergency_contact_name,
             emergency_contact_phone = EXCLUDED.emergency_contact_phone,
             emergency_contact_relation = EXCLUDED.emergency_contact_relation,
             height_cm = EXCLUDED.height_cm, weight_kg = EXCLUDED.weight_kg,
             updated_at = NOW()
             RETURNING *`,
            [data.patient_id, data.blood_group, data.allergies, data.chronic_conditions,
                data.current_medications, data.emergency_contact_name, data.emergency_contact_phone,
                data.emergency_contact_relation, data.height_cm, data.weight_kg]
        ),
};

// ===================== HEALTH BULLETINS =====================
const bulletinQueries = {
    getAll: () =>
        db.query('SELECT * FROM health_bulletins WHERE is_active = TRUE ORDER BY created_at DESC'),

    create: (data) =>
        db.query(
            'INSERT INTO health_bulletins (title, content, category, author) VALUES ($1, $2, $3, $4) RETURNING *',
            [data.title, data.content, data.category, data.author]
        ),

    delete: (id) =>
        db.query('UPDATE health_bulletins SET is_active = FALSE WHERE id = $1', [id]),
};

// ===================== FEEDBACK =====================
const feedbackQueries = {
    create: (data) =>
        db.query(
            'INSERT INTO feedback (user_id, subject, message, rating, is_anonymous) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [data.user_id, data.subject, data.message, data.rating, data.is_anonymous || false]
        ),

    getAll: () =>
        db.query(
            `SELECT f.*, u.name as user_name
             FROM feedback f
             LEFT JOIN users u ON f.user_id = u.id
             ORDER BY f.created_at DESC`
        ),

    updateStatus: (id, status, response) =>
        db.query(
            'UPDATE feedback SET status = $1, admin_response = $2 WHERE id = $3 RETURNING *',
            [status, response, id]
        ),
};

// ===================== DASHBOARD STATS =====================
const statsQueries = {
    getDashboardStats: async () => {
        const [patients, appointments, todayAppts, pendingAppts] = await Promise.all([
            db.query("SELECT COUNT(*) as count FROM users WHERE role = 'student'"),
            db.query("SELECT COUNT(*) as count FROM appointments"),
            db.query("SELECT COUNT(*) as count FROM appointments WHERE appointment_date = CURRENT_DATE AND status != 'cancelled'"),
            db.query("SELECT COUNT(*) as count FROM appointments WHERE status = 'pending'"),
        ]);
        return {
            totalPatients: patients.rows[0].count,
            totalAppointments: appointments.rows[0].count,
            todayAppointments: todayAppts.rows[0].count,
            pendingAppointments: pendingAppts.rows[0].count,
        };
    },
};

module.exports = {
    userQueries,
    doctorQueries,
    appointmentQueries,
    prescriptionQueries,
    medicalRecordQueries,
    bulletinQueries,
    feedbackQueries,
    statsQueries
};
