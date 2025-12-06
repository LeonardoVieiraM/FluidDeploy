const normalizeEmail = (email) => {
  if (!email) return null;
  return email.toLowerCase().trim();
};

const normalizePhone = (phone) => {
  if (!phone) return null;
  const cleaned = phone.toString().replace(/\D/g, "");
  if (!cleaned) return null;
  if (cleaned.length === 11) return "55" + cleaned;
  return cleaned || null;
};

const sanitizeNameQuery = (name) => {
  if (!name) return null;
  return name.trim().replace(/[%_]/g, "\\$&");
};

const pickUserPublicFields = (user) => {
  if (!user) return null;

  const userObj = user.toObject ? user.toObject() : user;

  const { senha, ...publicFields } = userObj;

  if (publicFields._id) {
    publicFields.id = publicFields._id.toString();
  }
  return publicFields;
};

module.exports = {
  normalizeEmail,
  normalizePhone,
  sanitizeNameQuery,
  pickUserPublicFields,
};
