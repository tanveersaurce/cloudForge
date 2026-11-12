process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-minimum-32-characters-long-1234';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-minimum-32-characters-long-5678';
process.env.JWT_ACCESS_EXPIRES_IN ??= '15m';
process.env.JWT_REFRESH_EXPIRES_DAYS ??= '7';
process.env.CORS_ORIGIN ??= 'http://localhost:5173';
