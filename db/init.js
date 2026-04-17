require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function initDB() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    try {
        const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        await pool.query(schema);
        console.log('Database schema created successfully!');
    } catch (err) {
        console.error('Error initializing database:', err.message);
    } finally {
        await pool.end();
    }
}

initDB();
