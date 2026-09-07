function createMembersRepository(db) {
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO website_members (website_id, user_id, role)
    VALUES (@website_id, @user_id, @role)
  `);
  const findStmt = db.prepare(
    'SELECT * FROM website_members WHERE website_id = ? AND user_id = ?'
  );

  return {
    upsert(websiteId, userId, role) {
      insertStmt.run({ website_id: websiteId, user_id: userId, role: role || 'owner' });
      return findStmt.get(websiteId, userId);
    },
    find(websiteId, userId) {
      return findStmt.get(websiteId, userId) || null;
    }
  };
}

module.exports = { createMembersRepository };
