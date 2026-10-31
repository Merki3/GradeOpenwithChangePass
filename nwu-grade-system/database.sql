CREATE DATABASE IF NOT EXISTS grade_opening_system;
USE grade_opening_system;

-- Drop existing tables to avoid conflicts when resetting
DROP TABLE IF EXISTS approvals;
DROP TABLE IF EXISTS request_periods;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS grade_opening_requests;
DROP TABLE IF EXISTS users;

-- 1. USERS Table
CREATE TABLE users (
    username VARCHAR(50) PRIMARY KEY,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL, -- instructor, dean, vpaa, cict
    college VARCHAR(150),
    dept VARCHAR(100)
);

-- 2. GRADE OPENING REQUESTS Table (Cleaned of all old flat approval columns)
CREATE TABLE grade_opening_requests (
    request_id VARCHAR(50) PRIMARY KEY,
    instructor_id VARCHAR(50) NOT NULL,
    college VARCHAR(150),
    academic_year VARCHAR(20),
    date_submitted VARCHAR(50),
    created_at DATETIME,
    subject_code VARCHAR(50),
    subject_title VARCHAR(150),
    section VARCHAR(100),
    calendar VARCHAR(50),
    reason TEXT,
    status VARCHAR(50),
    FOREIGN KEY (instructor_id) REFERENCES users(username) ON DELETE CASCADE
);

-- 3. APPROVALS Table (Normalized log for Dean, VPAA, CICT actions)
CREATE TABLE approvals (
    approval_id INT AUTO_INCREMENT PRIMARY KEY,
    request_id VARCHAR(50) NOT NULL,
    approver_user_id VARCHAR(50) NOT NULL,
    decision TINYINT NOT NULL, -- 1 for approved, 0 for rejected
    remarks TEXT,
    decision_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES grade_opening_requests(request_id) ON DELETE CASCADE,
    FOREIGN KEY (approver_user_id) REFERENCES users(username) ON DELETE CASCADE
);

-- 4. REQUEST PERIODS Table (For multi-select checkboxes like Midterm & Finals)
CREATE TABLE request_periods (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id VARCHAR(50) NOT NULL,
    period VARCHAR(50) NOT NULL,
    FOREIGN KEY (request_id) REFERENCES grade_opening_requests(request_id) ON DELETE CASCADE
);

-- 5. NOTIFICATIONS Table
CREATE TABLE notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    request_id VARCHAR(50) NOT NULL,
    recipient_user_id VARCHAR(50), -- Username or Role (e.g., 'dean', 'vpaa', 'cict')
    college_to VARCHAR(150), -- Used for routing to specific deans
    message TEXT,
    sent_at DATETIME,
    is_read TINYINT(1) DEFAULT 0,
    FOREIGN KEY (request_id) REFERENCES grade_opening_requests(request_id) ON DELETE CASCADE
);

-- ==========================================
-- SEED DEFAULT ACCOUNTS
-- ==========================================

-- 9 College Deans
INSERT INTO users (username, password_hash, full_name, role, college, dept) VALUES
('dean_cahs', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Dean of Allied Health Sciences', 'dean', 'College of Allied Health Sciences', 'Office of the Dean'),
('dean_cas', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Dean of Arts and Sciences', 'dean', 'College of Arts and Sciences', 'Office of the Dean'),
('dean_cbe', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Dean of Business Education', 'dean', 'College of Business Education', 'Office of the Dean'),
('dean_cme', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Dean of Maritime Education', 'dean', 'College of Maritime Education', 'Office of the Dean'),
('dean_cte', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Dean of Teacher Education', 'dean', 'College of Teacher Education', 'Office of the Dean'),
('dean_ccje', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Dean of Criminal Justice Education', 'dean', 'College of Criminal Justice Education', 'Office of the Dean'),
('dean_ceat', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Dean of Engineering, Architecture, and Technology', 'dean', 'College of Engineering, Architecture, and Technology', 'Office of the Dean'),
('dean_cihtm', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Dean of International Hospitality and Tourism Management', 'dean', 'College of International Hospitality and Tourism Management', 'Office of the Dean'),
('dean_cca', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Dean of Culinary Arts', 'dean', 'College of Culinary Arts', 'Office of the Dean');

-- System Wide Accounts
INSERT INTO users (username, password_hash, full_name, role, college, dept) VALUES
('vpaa', '$2y$10$M9H.cM4eS0Dxyi3K0p/bLOUzK./f1Z8i6P/xR81NfJzX3NnO/rC3S', 'Dr. Charliemane A. Bullalayao', 'vpaa', 'Academic Affairs', 'Office of the VPAA'),
('cict', '$2y$10$bBw6N8c9N./f4y.2/9M7aO3M/4TqY.9f/0yD6q6p6HwZ3x.Z3x.Z3', 'CICT Office', 'cict', 'CICT', 'Grade Portal Administration');