const crypto = require('crypto');

function makeId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

module.exports = {
  makeId,
  websiteId: () => makeId('web'),
  pageId: () => makeId('pg'),
  sectionId: () => makeId('sec'),
  navId: () => makeId('nav'),
  mediaId: () => makeId('med'),
  domainId: () => makeId('dom'),
  versionId: () => makeId('ver'),
  formId: () => makeId('frm'),
  submissionId: () => makeId('sub'),
  aiJobId: () => makeId('aij'),
  auditId: () => makeId('aud')
};
