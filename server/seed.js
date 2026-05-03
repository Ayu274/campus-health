const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const pool = new Pool({
  connectionString: "postgresql://campus_health_db_user:OtGrH1lhpxYKTvrDQrxJsUdeZCMoeNse@dpg-d7ih32navr4c73fmsfh0-a.oregon-postgres.render.com:5432/campus_health_db",
  ssl: { rejectUnauthorized: false }
});

async function seed() {
  console.log("🌱 Seeding database...");

  try {
    // ─── Sample Doctors ──────────────────────────────────────────
    const doctors = [
      { full_name: "Dr. Priya Nair",    staff_type: "doctor", specialization: "General Medicine", phone: "9876543210", email: "priya@campus.edu", status: "available" },
      { full_name: "Dr. Rajesh Kumar",  staff_type: "doctor", specialization: "ENT Specialist",   phone: "9876543211", email: "rajesh@campus.edu", status: "available" },
      { full_name: "Dr. Anita Das",     staff_type: "doctor", specialization: "Gynecology",       phone: "9876543212", email: "anita@campus.edu", status: "available" },
      { full_name: "Dr. Suresh Baruah", staff_type: "doctor", specialization: "Orthopedics",      phone: "9876543213", email: "suresh@campus.edu", status: "available" },
    ];

    for (const d of doctors) {
      await pool.query(
        `INSERT INTO staff (full_name, staff_type, specialization, phone, email, status)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT DO NOTHING`,
        [d.full_name, d.staff_type, d.specialization, d.phone, d.email, d.status]
      );
    }
    console.log("✅ Doctors added!");

    // ─── Sample Students ─────────────────────────────────────────
    const students = [
      { id: "CS2021045", full_name: "Aditya Sharma",  department: "Computer Science",  year: 3, blood_group: "B+", phone: "9876543210", gender: "male" },
      { id: "EE2022018", full_name: "Meera Dutta",    department: "Electrical Eng.",   year: 2, blood_group: "O+", phone: "9871234560", gender: "female" },
      { id: "ME2020033", full_name: "Rohit Bora",     department: "Mechanical Eng.",   year: 4, blood_group: "A-", phone: "9864321098", gender: "male" },
      { id: "CE2021089", full_name: "Pranab Kalita",  department: "Civil Eng.",        year: 3, blood_group: "AB+",phone: "9812345678", gender: "male" },
      { id: "BT2022014", full_name: "Rina Hazarika",  department: "Biotechnology",     year: 2, blood_group: "O-", phone: "9898765432", gender: "female" },
      { id: "CS2023071", full_name: "Sneha Gogoi",    department: "Computer Science",  year: 1, blood_group: "B-", phone: "9887654321", gender: "female" },
      { id: "PH2022009", full_name: "Dipankar Paul",  department: "Physics",           year: 2, blood_group: "A+", phone: "9876501234", gender: "male" },
      { id: "CH2021033", full_name: "Ankita Borah",   department: "Chemistry",         year: 3, blood_group: "O+", phone: "9865432109", gender: "female" },
    ];

    for (const s of students) {
      await pool.query(
        `INSERT INTO students (id, full_name, department, year, blood_group, phone, gender)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO NOTHING`,
        [s.id, s.full_name, s.department, s.year, s.blood_group, s.phone, s.gender]
      );
    }
    console.log("✅ Students added!");

    // ─── Sample Users ────────────────────────────────────────────
    const password = await bcrypt.hash("admin123", 12);
    const users = [
      { email: "admin@campus.edu",   role: "admin" },
      { email: "doctor@campus.edu",  role: "doctor" },
      { email: "student@campus.edu", role: "student" },
    ];

    for (const u of users) {
      await pool.query(
        `INSERT INTO users (email, password, role)
         VALUES ($1,$2,$3)
         ON CONFLICT (email) DO NOTHING`,
        [u.email, password, u.role]
      );
    }
    console.log("✅ Users added!");

    // ─── Sample Drugs/Inventory ──────────────────────────────────
    const drugs = [
      { drug_name: "Paracetamol 500mg", category: "Analgesic",    unit: "tablets",  stock_qty: 500, reorder_level: 50, expiry_date: "2027-06-01" },
      { drug_name: "Ibuprofen 400mg",   category: "NSAID",        unit: "tablets",  stock_qty: 300, reorder_level: 30, expiry_date: "2026-12-01" },
      { drug_name: "Amoxicillin 250mg", category: "Antibiotic",   unit: "capsules", stock_qty: 100, reorder_level: 20, expiry_date: "2026-09-01" },
      { drug_name: "ORS Sachet",        category: "Rehydration",  unit: "packets",  stock_qty: 200, reorder_level: 30, expiry_date: "2027-03-01" },
      { drug_name: "Antacid Syrup",     category: "GI",           unit: "bottles",  stock_qty: 50,  reorder_level: 10, expiry_date: "2026-08-01" },
      { drug_name: "Cetirizine 10mg",   category: "Antihistamine",unit: "tablets",  stock_qty: 150, reorder_level: 20, expiry_date: "2027-01-01" },
      { drug_name: "Vitamin C 500mg",   category: "Supplement",   unit: "tablets",  stock_qty: 400, reorder_level: 50, expiry_date: "2027-06-01" },
      { drug_name: "Metronidazole 400mg",category:"Antibiotic",   unit: "tablets",  stock_qty: 80,  reorder_level: 15, expiry_date: "2026-11-01" },
    ];

    for (const d of drugs) {
      await pool.query(
        `INSERT INTO drugs (drug_name, category, unit, stock_qty, reorder_level, expiry_date)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT DO NOTHING`,
        [d.drug_name, d.category, d.unit, d.stock_qty, d.reorder_level, d.expiry_date]
      );
    }
    console.log("✅ Drug inventory added!");

    console.log("\n🎉 Database seeded successfully!");
    console.log("\n📋 Login credentials:");
    console.log("   Admin:   admin@campus.edu  / admin123");
    console.log("   Doctor:  doctor@campus.edu / admin123");
    console.log("   Student: student@campus.edu / admin123");

  } catch (err) {
    console.error("❌ Error seeding:", err.message);
  } finally {
    pool.end();
  }
}

seed();