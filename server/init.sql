CREATE TABLE IF NOT EXISTS answers (
    id SERIAL PRIMARY KEY,
    fingerprint_hash VARCHAR(64) NOT NULL,
    cookie_id VARCHAR(36) NOT NULL,
    section VARCHAR(10) NOT NULL CHECK (section IN ('green', 'blue', 'red')),
    field_index SMALLINT NOT NULL CHECK (field_index BETWEEN 0 AND 7),
    text TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    parent_id INTEGER REFERENCES answers(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_answers_user ON answers(fingerprint_hash, cookie_id);
CREATE INDEX IF NOT EXISTS idx_answers_section ON answers(section);
CREATE INDEX IF NOT EXISTS idx_answers_active_section ON answers(is_active, section);

CREATE TABLE IF NOT EXISTS submissions (
    cookie_id VARCHAR(36) PRIMARY KEY,
    fingerprint_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
