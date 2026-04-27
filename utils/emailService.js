/**
 * Email Service — Nodemailer with Gmail SMTP
 * Sends appointment booking confirmation emails.
 */
const nodemailer = require('nodemailer');

// Create reusable transporter
let transporter = null;

function getTransporter() {
    if (transporter) return transporter;

    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!user || !pass) {
        console.warn('⚠ Email not configured: EMAIL_USER or EMAIL_PASS missing in .env');
        return null;
    }

    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass }
    });

    return transporter;
}

/**
 * Send appointment booking confirmation email.
 * @param {Object} details
 * @param {string} details.patientName
 * @param {string} details.patientEmail
 * @param {string} details.doctorName
 * @param {string} details.specialization
 * @param {string} details.appointmentDate - Formatted date string
 * @param {string} details.timeSlot - e.g. "09:00 - 12:00"
 * @param {string} details.symptoms
 * @param {string} details.priority
 * @param {string[]} [details.priorityReasons]
 */
async function sendBookingConfirmation(details) {
    const mailer = getTransporter();
    if (!mailer) {
        console.log('Email skipped (not configured). Would have sent to:', details.patientEmail);
        return false;
    }

    const priorityColors = {
        emergency: '#dc3545',
        high: '#fd7e14',
        normal: '#0d6efd',
        low: '#6c757d'
    };

    const priorityColor = priorityColors[details.priority] || priorityColors.normal;

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; background: #f0f4f8; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
            .header { background: linear-gradient(135deg, #1a365d 0%, #2563eb 100%); color: #fff; padding: 32px 24px; text-align: center; }
            .header h1 { margin: 0 0 6px; font-size: 22px; font-weight: 700; }
            .header p { margin: 0; font-size: 14px; opacity: 0.9; }
            .body { padding: 28px 24px; }
            .greeting { font-size: 16px; color: #1a202c; margin-bottom: 16px; }
            .details-card { background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 16px 0; }
            .detail-row { display: flex; padding: 8px 0; border-bottom: 1px solid #edf2f7; }
            .detail-row:last-child { border-bottom: none; }
            .detail-label { font-weight: 600; color: #4a5568; min-width: 140px; font-size: 14px; }
            .detail-value { color: #1a202c; font-size: 14px; }
            .priority-badge { display: inline-block; padding: 3px 12px; border-radius: 12px; color: #fff; font-size: 12px; font-weight: 600; text-transform: uppercase; background: ${priorityColor}; }
            .symptoms-box { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 12px 0; font-size: 14px; color: #2d3748; line-height: 1.6; }
            .footer { text-align: center; padding: 20px 24px; background: #f7fafc; border-top: 1px solid #e2e8f0; }
            .footer p { margin: 0; font-size: 12px; color: #718096; }
            .note { background: #ebf8ff; border-left: 4px solid #3182ce; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0; font-size: 13px; color: #2c5282; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🏥 IIT Ropar Medical Center</h1>
                <p>Appointment Booking Confirmation</p>
            </div>
            <div class="body">
                <p class="greeting">Dear <strong>${details.patientName}</strong>,</p>
                <p style="font-size:14px; color:#4a5568;">Your appointment has been booked successfully. Here are the details:</p>

                <div class="details-card">
                    <div class="detail-row">
                        <span class="detail-label">👨‍⚕️ Doctor</span>
                        <span class="detail-value"><strong>${details.doctorName}</strong></span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">🔬 Specialization</span>
                        <span class="detail-value">${details.specialization}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">📅 Date</span>
                        <span class="detail-value"><strong>${details.appointmentDate}</strong></span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">⏰ Time Slot</span>
                        <span class="detail-value">${details.timeSlot}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">🚦 Priority</span>
                        <span class="detail-value"><span class="priority-badge">${details.priority}</span></span>
                    </div>
                </div>

                ${details.priorityReasons && details.priorityReasons.length > 0 && details.priorityReasons[0] !== 'Standard priority' ? `
                <div class="note">
                    <strong>Priority Note:</strong> ${details.priorityReasons.join(', ')}
                </div>
                ` : ''}

                <p style="font-size:14px; font-weight:600; color:#2d3748; margin-bottom:6px;">Symptoms Described:</p>
                <div class="symptoms-box">${details.symptoms || 'Not specified'}</div>

                <div class="note">
                    <strong>Important:</strong> Please arrive 10 minutes before your scheduled slot. Carry any previous prescriptions or medical reports if available.
                </div>
            </div>
            <div class="footer">
                <p>IIT Ropar Medical Center | Rupnagar, Punjab 140001</p>
                <p>This is an automated email. Please do not reply.</p>
            </div>
        </div>
    </body>
    </html>
    `;

    const mailOptions = {
        from: process.env.EMAIL_FROM || `"IIT Ropar Medical Center" <${process.env.EMAIL_USER}>`,
        to: details.patientEmail,
        subject: `Appointment Confirmed — ${details.doctorName} on ${details.appointmentDate}`,
        html: htmlContent
    };

    try {
        const info = await mailer.sendMail(mailOptions);
        console.log('✉ Confirmation email sent:', info.messageId);
        return true;
    } catch (err) {
        console.error('✉ Email send failed:', err.message);
        return false;
    }
}

/**
 * Send password reset email.
 * @param {string} email
 * @param {string} name
 * @param {string} resetUrl
 */
async function sendPasswordResetEmail(email, name, resetUrl) {
    const mailer = getTransporter();
    if (!mailer) {
        console.log('Email skipped (not configured). Would have sent reset link to:', email);
        console.log('Reset URL:', resetUrl);
        return false;
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; background: #f0f4f8; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
            .header { background: linear-gradient(135deg, #1a365d 0%, #2563eb 100%); color: #fff; padding: 32px 24px; text-align: center; }
            .header h1 { margin: 0 0 6px; font-size: 22px; font-weight: 700; }
            .header p { margin: 0; font-size: 14px; opacity: 0.9; }
            .body { padding: 28px 24px; text-align: center; }
            .greeting { font-size: 16px; color: #1a202c; margin-bottom: 16px; text-align: left; }
            .btn { display: inline-block; padding: 12px 24px; margin: 20px 0; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; }
            .footer { text-align: center; padding: 20px 24px; background: #f7fafc; border-top: 1px solid #e2e8f0; }
            .footer p { margin: 0; font-size: 12px; color: #718096; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🏥 IIT Ropar Medical Center</h1>
                <p>Password Reset Request</p>
            </div>
            <div class="body">
                <p class="greeting">Dear <strong>${name}</strong>,</p>
                <p style="font-size:14px; color:#4a5568; text-align: left;">You are receiving this email because you requested a password reset for your account.</p>
                <p style="font-size:14px; color:#4a5568; text-align: left;">Please click on the button below to complete the process. This link will expire in 1 hour.</p>
                
                <a href="${resetUrl}" class="btn">Reset Password</a>
                
                <p style="font-size:14px; color:#4a5568; text-align: left;">If you did not request this, please ignore this email and your password will remain unchanged.</p>
            </div>
            <div class="footer">
                <p>IIT Ropar Medical Center | Rupnagar, Punjab 140001</p>
                <p>This is an automated email. Please do not reply.</p>
            </div>
        </div>
    </body>
    </html>
    `;

    const mailOptions = {
        from: process.env.EMAIL_FROM || `"IIT Ropar Medical Center" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `Password Reset Request — IIT Ropar Medical Center`,
        html: htmlContent
    };

    try {
        const info = await mailer.sendMail(mailOptions);
        console.log('✉ Password reset email sent:', info.messageId);
        return true;
    } catch (err) {
        console.error('✉ Password reset email send failed:', err.message);
        return false;
    }
}

module.exports = { sendBookingConfirmation, sendPasswordResetEmail };
