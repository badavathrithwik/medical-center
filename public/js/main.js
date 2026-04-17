// ============================================
// IIT ROPAR MEDICAL CENTER - Frontend JS
// ============================================

document.addEventListener('DOMContentLoaded', () => {

    // ---- Mobile Nav Toggle ----
    const toggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');
    if (toggle && navLinks) {
        toggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            const icon = toggle.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-bars');
                icon.classList.toggle('fa-xmark');
            }
        });
        // Close nav on clicking a link (mobile)
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    navLinks.classList.remove('active');
                    const icon = toggle.querySelector('i');
                    if (icon) {
                        icon.classList.remove('fa-xmark');
                        icon.classList.add('fa-bars');
                    }
                }
            });
        });
    }

    // ---- Flash Message Auto-dismiss & Close ----
    document.querySelectorAll('.flash-close').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.parentElement.style.animation = 'none';
            btn.parentElement.style.transition = 'all 0.3s ease';
            btn.parentElement.style.opacity = '0';
            btn.parentElement.style.transform = 'translateY(-10px)';
            setTimeout(() => btn.parentElement.remove(), 300);
        });
    });

    // Auto-dismiss flashes after 5s
    document.querySelectorAll('.flash').forEach(flash => {
        setTimeout(() => {
            flash.style.transition = 'all 0.5s ease';
            flash.style.opacity = '0';
            flash.style.transform = 'translateY(-10px)';
            setTimeout(() => flash.remove(), 500);
        }, 5000);
    });

    // ---- Appointment Booking Wizard ----
    // ---- Dynamic Medicine Rows (Admin Add Prescription) ----
    const addMedBtn = document.getElementById('addMedicine');
    if (addMedBtn) {
        initMedicineForm();
    }

    // ---- Confirmation Dialogs ----
    document.querySelectorAll('.confirm-action').forEach(form => {
        form.addEventListener('submit', e => {
            const msg = form.dataset.confirm || 'Are you sure?';
            if (!confirm(msg)) {
                e.preventDefault();
            }
        });
    });

    // ---- Active nav link ----
    setActiveNavLink();
});

// ==============================
// Medicine Form (Add Prescription)
// ==============================
function initMedicineForm() {
    const container = document.getElementById('medicineRows');
    const addBtn = document.getElementById('addMedicine');
    let count = container ? container.querySelectorAll('.medicine-row').length : 1;

    addBtn.addEventListener('click', () => {
        count++;
        const row = document.createElement('div');
        row.className = 'medicine-row';
        row.innerHTML = `
            <div class="form-row">
                <div class="form-group">
                    <label>Medicine Name *</label>
                    <input type="text" name="med_name[]" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>Dosage *</label>
                    <input type="text" name="med_dosage[]" class="form-control" placeholder="e.g. 500mg" required>
                </div>
                <div class="form-group">
                    <label>Frequency *</label>
                    <select name="med_frequency[]" class="form-control" required>
                        <option value="Once daily">Once daily</option>
                        <option value="Twice daily">Twice daily</option>
                        <option value="Thrice daily">Thrice daily</option>
                        <option value="As needed">As needed</option>
                        <option value="Before meals">Before meals</option>
                        <option value="After meals">After meals</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Duration</label>
                    <input type="text" name="med_duration[]" class="form-control" placeholder="e.g. 5 days">
                </div>
                <button type="button" class="btn btn-danger btn-sm remove-medicine" onclick="this.closest('.medicine-row').remove()">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(row);
    });
}

// ==============================
// Active Nav Link
// ==============================
function setActiveNavLink() {
    const path = window.location.pathname;
    document.querySelectorAll('.nav-links a').forEach(link => {
        const href = link.getAttribute('href');
        if (href === path || (href !== '/' && path.startsWith(href))) {
            link.classList.add('active');
        }
    });
}
