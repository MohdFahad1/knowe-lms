import fs from "fs";
import path from "path";

const LIBRARY_VERSION = 1;
const LIBRARY_FILE = "library.json";

function getLibraryJsonPath(libraryRoot) {
  return path.join(libraryRoot, LIBRARY_FILE);
}

export function createPortableLibrary(libraryRoot) {
  if (!libraryRoot) {
    throw new Error("Library folder is required.");
  }

  const root = path.resolve(libraryRoot);

  // Create root folder
  fs.mkdirSync(root, { recursive: true });

  // Create required folders
  fs.mkdirSync(path.join(root, "content"), {
    recursive: true,
  });

  fs.mkdirSync(path.join(root, "assessments"), {
    recursive: true,
  });

  const libraryPath = getLibraryJsonPath(root);

  // Create library.json if it doesn't exist
  if (!fs.existsSync(libraryPath)) {
    const library = {
      version: LIBRARY_VERSION,
      content: {},
      subjects: {},
      assessments: {},
    };

    fs.writeFileSync(
      libraryPath,
      JSON.stringify(library, null, 2),
      "utf-8"
    );

    return library;
  }

  return readPortableLibrary(root);
}

export function readPortableLibrary(libraryRoot) {
  if (!libraryRoot) {
    throw new Error("Library folder is required.");
  }

  const root = path.resolve(libraryRoot);
  const libraryPath = getLibraryJsonPath(root);

  if (!fs.existsSync(libraryPath)) {
    return createPortableLibrary(root);
  }

  try {
    const library = JSON.parse(
      fs.readFileSync(libraryPath, "utf-8")
    );

    return {
      version: library.version ?? LIBRARY_VERSION,
      content: library.content ?? {},
      subjects: library.subjects ?? {},
      assessments: library.assessments ?? {},
    };
  } catch (error) {
    throw new Error(
      `Invalid library.json: ${error.message}`
    );
  }
}

export function writePortableLibrary(libraryRoot, library) {
  if (!libraryRoot) {
    throw new Error("Library folder is required.");
  }

  const root = path.resolve(libraryRoot);

  fs.mkdirSync(root, {
    recursive: true,
  });

  const normalizedLibrary = {
    version: LIBRARY_VERSION,
    content: library.content ?? {},
    subjects: library.subjects ?? {},
    assessments: library.assessments ?? {},
  };

  fs.writeFileSync(
    getLibraryJsonPath(root),
    JSON.stringify(normalizedLibrary, null, 2),
    "utf-8"
  );

  return normalizedLibrary;
}

export function getRelativeLibraryPath(
  libraryRoot,
  absolutePath
) {
  const root = path.resolve(libraryRoot);
  const target = path.resolve(absolutePath);

  const relativePath = path.relative(root, target);

  if (
    relativePath === "" ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(
      "Path is outside the selected portable library."
    );
  }

  // Always store portable paths using /
  return relativePath.split(path.sep).join("/");
}

export function resolveLibraryPath(
  libraryRoot,
  relativePath
) {
  if (!libraryRoot || !relativePath) {
    throw new Error(
      "Library root and relative path are required."
    );
  }

  const root = path.resolve(libraryRoot);

  // Convert portable "/" path to current OS separator
  const normalizedRelativePath = relativePath
    .split("/")
    .join(path.sep);

  const target = path.resolve(
    root,
    normalizedRelativePath
  );

  // Prevent path traversal
  if (
    target !== root &&
    !target.startsWith(root + path.sep)
  ) {
    throw new Error(
      "Invalid path outside portable library."
    );
  }

  return target;
}

export function getLibraryStructure(libraryRoot) {
  const root = path.resolve(libraryRoot);

  return {
    root,
    libraryFile: getLibraryJsonPath(root),
    contentDir: path.join(root, "content"),
    assessmentsDir: path.join(root, "assessments"),
  };
}