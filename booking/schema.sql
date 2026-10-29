CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  postcode TEXT NOT NULL,
  zone TEXT NOT NULL,
  car_details TEXT NOT NULL,
  service_code TEXT NOT NULL,
  service_name TEXT NOT NULL,
  size TEXT NOT NULL,
  booking_date TEXT NOT NULL,
  booking_time TEXT NOT NULL,
  booking_start TEXT NOT NULL,
  booking_end TEXT NOT NULL,
  total_price INTEGER NOT NULL,
  notes TEXT,
  add_ons TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);