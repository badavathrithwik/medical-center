require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function nextFutureWeekday(targetDay) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);

    const offset = (targetDay - date.getDay() + 7) % 7 || 7;
    date.setDate(date.getDate() + offset);
    return date;
}

async function upsertUser(pool, user, hashedPassword) {
    const result = await pool.query(
        `INSERT INTO users (name, email, password, role, phone, department, roll_number, gender, date_of_birth, user_type, is_handicapped)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (email) DO UPDATE SET
             name = EXCLUDED.name,
             password = EXCLUDED.password,
             role = EXCLUDED.role,
             phone = EXCLUDED.phone,
             department = EXCLUDED.department,
             roll_number = EXCLUDED.roll_number,
             gender = EXCLUDED.gender,
             date_of_birth = EXCLUDED.date_of_birth,
             user_type = EXCLUDED.user_type,
             is_handicapped = EXCLUDED.is_handicapped,
             updated_at = NOW()
         RETURNING *`,
        [
            user.name,
            user.email,
            hashedPassword,
            user.role,
            user.phone || null,
            user.department || null,
            user.roll_number || null,
            user.gender || null,
            user.date_of_birth || null,
            user.user_type || 'student',
            user.is_handicapped || false
        ]
    );

    return result.rows[0];
}

async function getOrCreateDoctor(pool, doctorData) {
    const existing = await pool.query('SELECT * FROM doctors WHERE user_id = $1 LIMIT 1', [doctorData.user_id]);
    if (existing.rows.length > 0) {
        // Update existing doctor with new fields
        await pool.query(
            `UPDATE doctors SET gender = $1, symptom_tags = $2 WHERE id = $3`,
            [doctorData.gender || null, doctorData.symptom_tags || '{}', existing.rows[0].id]
        );
        const updated = await pool.query('SELECT * FROM doctors WHERE id = $1', [existing.rows[0].id]);
        return updated.rows[0];
    }

    const created = await pool.query(
        `INSERT INTO doctors (user_id, name, specialization, qualification, experience_years, phone, email, bio, photo_url, gender, symptom_tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
            doctorData.user_id,
            doctorData.name,
            doctorData.specialization,
            doctorData.qualification,
            doctorData.experience_years,
            doctorData.phone,
            doctorData.email,
            doctorData.bio,
            doctorData.photo_url || '/images/default-doctor.png',
            doctorData.gender || null,
            doctorData.symptom_tags || '{}'
        ]
    );

    return created.rows[0];
}

async function ensureSlot(pool, slotData) {
    const existing = await pool.query(
        `SELECT * FROM doctor_slots
         WHERE doctor_id = $1 AND day_of_week = $2 AND start_time = $3 AND end_time = $4
         LIMIT 1`,
        [slotData.doctor_id, slotData.day_of_week, slotData.start_time, slotData.end_time]
    );

    if (existing.rows.length > 0) {
        return existing.rows[0];
    }

    const created = await pool.query(
        `INSERT INTO doctor_slots (doctor_id, day_of_week, start_time, end_time, max_patients)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
            slotData.doctor_id,
            slotData.day_of_week,
            slotData.start_time,
            slotData.end_time,
            slotData.max_patients
        ]
    );

    return created.rows[0];
}

async function createAppointment(pool, appointment) {
    const result = await pool.query(
        `INSERT INTO appointments
            (patient_id, doctor_id, slot_id, appointment_date, status, symptoms, priority, notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
         RETURNING *`,
        [
            appointment.patient_id,
            appointment.doctor_id,
            appointment.slot_id,
            appointment.appointment_date,
            appointment.status,
            appointment.symptoms,
            appointment.priority || 'normal',
            appointment.notes || null,
            appointment.created_at
        ]
    );

    return result.rows[0];
}

async function seed() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    try {
        const adminPass = await bcrypt.hash('admin123', 10);
        const doctorPass = await bcrypt.hash('doctor123', 10);
        const studentPass = await bcrypt.hash('student123', 10);

        const admin = await upsertUser(pool, {
            name: 'Admin',
            email: 'admin@iitrpr.ac.in',
            role: 'admin',
            phone: '01881-235193',
            user_type: 'staff'
        }, adminPass);

        const doctorUser1 = await upsertUser(pool, {
            name: 'Dr. Reena Rani',
            email: 'reena@iitrpr.ac.in',
            role: 'doctor',
            phone: '01881-235187',
            gender: 'Female'
        }, doctorPass);

        const doctorUser2 = await upsertUser(pool, {
            name: 'Dr. Charanjit Singh',
            email: 'drcharanjit@iitrpr.ac.in',
            role: 'doctor',
            phone: '01881-235188',
            gender: 'Male'
        }, doctorPass);

        const doctorUser3 = await upsertUser(pool, {
            name: 'Dr. Neetesh Singh',
            email: 'neetesh@iitrpr.ac.in',
            role: 'doctor',
            phone: '01881-235188',
            gender: 'Male'
        }, doctorPass);

        const doctor1 = await getOrCreateDoctor(pool, {
            user_id: doctorUser1.id,
            name: 'Dr. Reena Rani',
            specialization: 'Medical Officer – Allopathy',
            qualification: 'MBBS',
            experience_years: 15,
            phone: '01881-235187',
            email: 'reena@iitrpr.ac.in',
            bio: 'Dr. Reena Rani is a Medical Officer specializing in Allopathy.',
            photo_url: 'https://ui-avatars.com/api/?name=Reena+Rani&background=random',
            gender: 'Female',
            symptom_tags: '{fever,cold,cough,infection,headache,body pain,stomach,vomiting,flu,wound,injury,allergy,skin rash,ear,eye,nose}'
        });

        const doctor2 = await getOrCreateDoctor(pool, {
            user_id: doctorUser2.id,
            name: 'Dr. Charanjit Singh',
            specialization: 'Medical Officer – Allopathy',
            qualification: 'MBBS',
            experience_years: 10,
            phone: '01881-235187',
            email: 'drcharanjit@iitrpr.ac.in',
            bio: 'Dr. Charanjit Singh is a Medical Officer specializing in Allopathy.',
            photo_url: 'https://ui-avatars.com/api/?name=Charanjit+Singh&background=random',
            gender: 'Male',
            symptom_tags: '{fever,cold,cough,infection,headache,body pain,blood pressure,diabetes,asthma,breathing,chest pain,weakness}'
        });

        const doctor3 = await getOrCreateDoctor(pool, {
            user_id: doctorUser3.id,
            name: 'Dr. Neetesh Singh',
            specialization: 'Homeopathic Doctor',
            qualification: 'BHMS',
            experience_years: 12,
            phone: '01881-235188',
            email: 'neetesh@iitrpr.ac.in',
            bio: 'Dr. Neetesh Singh is a Homeopathic Doctor.',
            photo_url: 'https://ui-avatars.com/api/?name=Neetesh+Singh&background=random',
            gender: 'Male',
            symptom_tags: '{chronic,recurring,migraine,sinusitis,eczema,arthritis,acidity,digestive,hair loss,piles,tonsils,immunity,seasonal}'
        });

        for (let day = 1; day <= 5; day++) {
            await ensureSlot(pool, { doctor_id: doctor1.id, day_of_week: day, start_time: '09:00', end_time: '12:00', max_patients: 15 });
            await ensureSlot(pool, { doctor_id: doctor1.id, day_of_week: day, start_time: '14:00', end_time: '16:00', max_patients: 10 });
            await ensureSlot(pool, { doctor_id: doctor3.id, day_of_week: day, start_time: '14:00', end_time: '17:00', max_patients: 12 });
        }

        for (const day of [1, 3, 5]) {
            await ensureSlot(pool, { doctor_id: doctor2.id, day_of_week: day, start_time: '10:00', end_time: '13:00', max_patients: 8 });
        }

        for (const day of [2, 4]) {
            await ensureSlot(pool, { doctor_id: doctor2.id, day_of_week: day, start_time: '14:00', end_time: '17:00', max_patients: 8 });
        }

        await ensureSlot(pool, { doctor_id: doctor3.id, day_of_week: 6, start_time: '09:00', end_time: '12:00', max_patients: 8 });

        const students = {};
        const studentProfiles = [
            {
                key: 'rithwik',
                name: 'Rithwik',
                email: 'rithwik@iitrpr.ac.in',
                phone: '9876543210',
                department: 'Computer Science',
                roll_number: '2023CSB1001',
                gender: 'Male',
                date_of_birth: '2004-05-15',
                user_type: 'student',
                is_handicapped: false
            },
            {
                key: 'patient1',
                name: 'Patient 1',
                email: 'patient1@iitrpr.ac.in',
                phone: '9000000001',
                department: 'Electrical Engineering',
                roll_number: '2023EEB1001',
                gender: 'Male',
                date_of_birth: '2004-01-10',
                user_type: 'student',
                is_handicapped: false
            },
            {
                key: 'patient2',
                name: 'Patient 2',
                email: 'patient2@iitrpr.ac.in',
                phone: '9000000002',
                department: 'Mechanical Engineering',
                roll_number: '2023MEB1002',
                gender: 'Female',
                date_of_birth: '2004-03-12',
                user_type: 'student',
                is_handicapped: false
            },
            {
                key: 'patient3',
                name: 'Patient 3',
                email: 'patient3@iitrpr.ac.in',
                phone: '9000000003',
                department: 'Civil Engineering',
                roll_number: '2023CEB1003',
                gender: 'Male',
                date_of_birth: '2004-07-21',
                user_type: 'student',
                is_handicapped: false
            },
            {
                key: 'patient5',
                name: 'Patient 5',
                email: 'patient5@iitrpr.ac.in',
                phone: '9000000005',
                department: 'Chemical Engineering',
                roll_number: '2023CHB1005',
                gender: 'Female',
                date_of_birth: '2004-09-02',
                user_type: 'student',
                is_handicapped: false
            },
            // Faculty member for priority testing
            {
                key: 'faculty1',
                name: 'Prof. Sharma',
                email: 'prof.sharma@iitrpr.ac.in',
                phone: '9000000010',
                department: 'Computer Science',
                roll_number: '',
                gender: 'Male',
                date_of_birth: '1975-03-20',
                user_type: 'faculty',
                is_handicapped: false
            },
            // Senior citizen for priority testing
            {
                key: 'senior1',
                name: 'Retired Prof. Gupta',
                email: 'prof.gupta@iitrpr.ac.in',
                phone: '9000000011',
                department: 'Physics',
                roll_number: '',
                gender: 'Male',
                date_of_birth: '1955-06-15',
                user_type: 'faculty',
                is_handicapped: false
            },
            // PwD student for priority testing
            {
                key: 'pwd1',
                name: 'Patient PwD',
                email: 'pwd.student@iitrpr.ac.in',
                phone: '9000000012',
                department: 'Mathematics',
                roll_number: '2023MAB1001',
                gender: 'Male',
                date_of_birth: '2003-11-08',
                user_type: 'student',
                is_handicapped: true
            }
        ];

        for (const profile of studentProfiles) {
            students[profile.key] = await upsertUser(pool, { ...profile, role: 'student' }, studentPass);
        }

        const sampleStudentIds = Object.values(students).map((student) => student.id);
        await pool.query('DELETE FROM appointments WHERE patient_id = ANY($1::int[])', [sampleStudentIds]);
        await pool.query(`DELETE FROM appointments WHERE symptoms LIKE 'Seeded%'`);

        const mondayQueueDate = nextFutureWeekday(1);
        const wednesdayDate = nextFutureWeekday(3);

        const rajeshMorningSlot = await pool.query(
            `SELECT * FROM doctor_slots
             WHERE doctor_id = $1 AND day_of_week = 1 AND start_time = '09:00'
             ORDER BY id
             LIMIT 1`,
            [doctor1.id]
        );

        const priyaMorningSlot = await pool.query(
            `SELECT * FROM doctor_slots
             WHERE doctor_id = $1 AND day_of_week = 3 AND start_time = '10:00'
             ORDER BY id
             LIMIT 1`,
            [doctor2.id]
        );

        const queueDateString = formatDate(mondayQueueDate);
        const counselingDateString = formatDate(wednesdayDate);

        const patient1QueueAppointment = await createAppointment(pool, {
            patient_id: students.patient1.id,
            doctor_id: doctor1.id,
            slot_id: rajeshMorningSlot.rows[0].id,
            appointment_date: queueDateString,
            status: 'pending',
            symptoms: 'Seeded FCFS demo: fever and sore throat',
            created_at: `${queueDateString}T08:00:00.000Z`
        });

        const patient2QueueAppointment = await createAppointment(pool, {
            patient_id: students.patient2.id,
            doctor_id: doctor1.id,
            slot_id: rajeshMorningSlot.rows[0].id,
            appointment_date: queueDateString,
            status: 'cancelled',
            symptoms: 'Seeded FCFS demo: cancelled queue entry',
            notes: 'Cancelled before consultation',
            created_at: `${queueDateString}T08:05:00.000Z`
        });

        const rithwikQueueAppointment = await createAppointment(pool, {
            patient_id: students.rithwik.id,
            doctor_id: doctor1.id,
            slot_id: rajeshMorningSlot.rows[0].id,
            appointment_date: queueDateString,
            status: 'pending',
            symptoms: 'Seeded FCFS demo: headache and mild fever',
            created_at: `${queueDateString}T08:10:00.000Z`
        });

        const patient3QueueAppointment = await createAppointment(pool, {
            patient_id: students.patient3.id,
            doctor_id: doctor1.id,
            slot_id: rajeshMorningSlot.rows[0].id,
            appointment_date: queueDateString,
            status: 'confirmed',
            symptoms: 'Seeded FCFS demo: flu follow-up',
            created_at: `${queueDateString}T08:15:00.000Z`
        });

        const patient5QueueAppointment = await createAppointment(pool, {
            patient_id: students.patient5.id,
            doctor_id: doctor1.id,
            slot_id: rajeshMorningSlot.rows[0].id,
            appointment_date: queueDateString,
            status: 'pending',
            symptoms: 'Seeded FCFS demo: recurring cough',
            created_at: `${queueDateString}T08:20:00.000Z`
        });

        const rithwikCounselingAppointment = await createAppointment(pool, {
            patient_id: students.rithwik.id,
            doctor_id: doctor2.id,
            slot_id: priyaMorningSlot.rows[0].id,
            appointment_date: counselingDateString,
            status: 'confirmed',
            symptoms: 'Seeded follow-up: stress management consultation',
            created_at: `${counselingDateString}T09:00:00.000Z`
        });

        const seededStatuses = [
            { id: patient1QueueAppointment.id, status: 'pending' },
            { id: patient2QueueAppointment.id, status: 'cancelled' },
            { id: rithwikQueueAppointment.id, status: 'pending' },
            { id: patient3QueueAppointment.id, status: 'confirmed' },
            { id: patient5QueueAppointment.id, status: 'pending' },
            { id: rithwikCounselingAppointment.id, status: 'confirmed' }
        ];

        for (const item of seededStatuses) {
            await pool.query(
                'UPDATE appointments SET status = $1, updated_at = created_at WHERE id = $2',
                [item.status, item.id]
            );
        }

        const bulletinTitles = [
            'Cover Your Mouth While Sneezing',
            'Stay Hydrated During Summer',
            'Mental Health Awareness'
        ];

        await pool.query('DELETE FROM health_bulletins WHERE title = ANY($1::text[])', [bulletinTitles]);

        await pool.query(
            `INSERT INTO health_bulletins (title, content, category, author) VALUES
             ($1, $2, $3, $4),
             ($5, $6, $7, $8),
             ($9, $10, $11, $12)`,
            [
                'Cover Your Mouth While Sneezing',
                'The speed of droplets produced while sneezing and coughing is high enough to spread infection quickly. Always cover your nose and mouth while sneezing or coughing and wash your hands.',
                'hygiene',
                'Medical Officer',
                'Stay Hydrated During Summer',
                'With rising temperatures, drink enough water through the day and watch for headache, dizziness, dry mouth, or fatigue as signs of dehydration.',
                'wellness',
                'Medical Officer',
                'Mental Health Awareness',
                'Mental health matters as much as physical health. The Medical Center offers confidential counseling support with Dr. Priya Gupta for stress, anxiety, and emotional wellness.',
                'mental-health',
                'Medical Officer'
            ]
        );

        console.log('Database seeded successfully!');
        console.log('\n--- Login Credentials ---');
        console.log(`Admin:     ${admin.email} / admin123`);
        console.log(`Doctor:    ${doctorUser1.email} / doctor123 (Female)`);
        console.log(`Doctor:    ${doctorUser2.email} / doctor123 (Male)`);
        console.log(`Doctor:    ${doctorUser3.email} / doctor123 (Male, Homeopathy)`);
        console.log(`Student:   ${students.rithwik.email} / student123`);
        console.log(`Faculty:   ${students.faculty1.email} / student123 (priority boost)`);
        console.log(`Senior:    ${students.senior1.email} / student123 (priority boost)`);
        console.log(`PwD:       ${students.pwd1.email} / student123 (priority boost)`);
        console.log(`Female:    ${students.patient2.email} / student123 (female doctor pref)`);
        console.log('Queue demo students: patient1@iitrpr.ac.in, patient3@iitrpr.ac.in, patient5@iitrpr.ac.in / student123');
        console.log(`Sample FCFS queue date: ${queueDateString} with Dr. Reena Rani (09:00 - 12:00)`);
    } catch (err) {
        console.error('Error seeding database:', err.message);
    } finally {
        await pool.end();
    }
}

seed();
