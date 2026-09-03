import jwt from "jsonwebtoken";

// Verifies the JWT and attaches the decoded user info to req.user
export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role, companyId }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Restricts a route to specific roles
export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have permission to perform this action" });
    }
    next();
  };
}

// Builds a Mongoose filter scoped to the requester's tenant.
// PLATFORM_ADMIN sees everything; everyone else is locked to their own companyId.
export function tenantScope(req) {
  if (req.user.role === "PLATFORM_ADMIN") return {};
  return { companyId: req.user.companyId };
}