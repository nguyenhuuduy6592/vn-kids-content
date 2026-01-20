-- VN Kids Content Database Schema
-- Run this in your Neon SQL Editor to set up the tables

-- Content table: stores songs, poems, stories
CREATE TABLE IF NOT EXISTS content (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('song', 'poem', 'story')),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Content progress table: tracks read count, favorites, archived globally (shared by all users)
-- Note: Will be expanded to user-based progress later
CREATE TABLE IF NOT EXISTS content_progress (
  id SERIAL PRIMARY KEY,
  content_id INTEGER NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  read_count INTEGER DEFAULT 0,
  favorite BOOLEAN DEFAULT FALSE,
  archived BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(content_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_content_type ON content(type);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for auto-updating timestamps
DROP TRIGGER IF EXISTS content_updated_at ON content;
CREATE TRIGGER content_updated_at
  BEFORE UPDATE ON content
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS content_progress_updated_at ON content_progress;
CREATE TRIGGER content_progress_updated_at
  BEFORE UPDATE ON content_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
