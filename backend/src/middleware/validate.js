/**
 * Validates req.body / req.query / req.params against zod schemas, replacing
 * the parsed value in place so route handlers see clean, defaulted, coerced
 * data. On failure, responds 400 with { error } — same shape every route
 * already used for validation failures, so the API contract doesn't change.
 */
function validate(schemas) {
  return (req, res, next) => {
    for (const key of ['params', 'query', 'body']) {
      const schema = schemas[key];
      if (!schema) continue;

      const result = schema.safeParse(req[key]);
      if (!result.success) {
        const issue = result.error.issues[0];
        const field = issue.path.join('.');
        return res.status(400).json({ error: field ? `${field}: ${issue.message}` : issue.message });
      }
      req[key] = result.data;
    }
    return next();
  };
}

module.exports = validate;
