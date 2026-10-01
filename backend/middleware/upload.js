import multer from "multer";

const ALLOWED_EXTENSIONS = [".xlsx", ".csv"];

const uploadSpreadsheet = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.slice(file.originalname.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error("Only .xlsx or .csv files are supported"));
    }
    cb(null, true);
  },
});

// Wraps multer so file-too-large / wrong-extension errors come back as a
// clean 400 JSON response instead of hitting Express's default error page.
export function handleSpreadsheetUpload(req, res, next) {
  uploadSpreadsheet.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || "Invalid file upload" });
    next();
  });
}
