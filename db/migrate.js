require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

async function migrate() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    try {
        console.log('Running migrations...\n');

        // Add user_type to users table
        await pool.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='user_type') THEN
                    ALTER TABLE users ADD COLUMN user_type VARCHAR(20) DEFAULT 'student';
                END IF;
            END $$;
        `);
        console.log('✓ users.user_type column ensured');

        // Add is_handicapped to users table
        await pool.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_handicapped') THEN
                    ALTER TABLE users ADD COLUMN is_handicapped BOOLEAN DEFAULT FALSE;
                END IF;
            END $$;
        `);
        console.log('✓ users.is_handicapped column ensured');

        // Add gender to doctors table
        await pool.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='doctors' AND column_name='gender') THEN
                    ALTER TABLE doctors ADD COLUMN gender VARCHAR(10);
                END IF;
            END $$;
        `);
        console.log('✓ doctors.gender column ensured');

        // Add symptom_tags to doctors table
        await pool.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='doctors' AND column_name='symptom_tags') THEN
                    ALTER TABLE doctors ADD COLUMN symptom_tags TEXT[] DEFAULT '{}';
                END IF;
            END $$;
        `);
        console.log('✓ doctors.symptom_tags column ensured');

        // Add prefer_female_doctor to appointments table
        await pool.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='prefer_female_doctor') THEN
                    ALTER TABLE appointments ADD COLUMN prefer_female_doctor BOOLEAN DEFAULT FALSE;
                END IF;
            END $$;
        `);
        console.log('✓ appointments.prefer_female_doctor column ensured');

        // Add reset password fields to users table
        await pool.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='reset_password_token') THEN
                    ALTER TABLE users ADD COLUMN reset_password_token VARCHAR(255);
                    ALTER TABLE users ADD COLUMN reset_password_expires TIMESTAMP;
                END IF;
            END $$;
        `);
        console.log('✓ users.reset_password fields ensured');

        console.log('\n✅ All migrations completed successfully!');
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
