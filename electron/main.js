import {
  ipcMain,
  app,
  BrowserWindow,
  globalShortcut,
  session,
  protocol,
  net,
  safeStorage,
  dialog
} from "electron";
import crypto from "crypto";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import fs from "fs";
import AdmZip from "adm-zip";
import { encryptBuffer, decryptBuffer } from "./crypto.js";
import {
  createPortableLibrary,
  readPortableLibrary,
  writePortableLibrary,
  getRelativeLibraryPath,
  resolveLibraryPath,
  getLibraryStructure,
} from "./portableLibrary.js";

import {
  getPortableEncryptionKey,
  portableKeyExists,
  getPortableKeyPath,
} from "./portableKey.js";

app.commandLine.appendSwitch("disable-features", "OutOfBlinkCors");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    autoHideMenuBar: true,
    show: false,

    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      devTools: true,
    },
  });

  // Show window when ready
  win.once("ready-to-show", () => {
    win.show();

    if (isDev) {
      win.maximize();
    }
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // Automatically open DevTools after the page has loaded
  // win.webContents.once("did-finish-load", () => {
  //   win.webContents.openDevTools({ mode: "detach" });
  // });
  if (isDev) {
    win.webContents.once("did-finish-load", () => {
      win.webContents.openDevTools({ mode: "detach" });
    });
  }
}

// Must be called before app is ready. Registers "offline" as a real,
// secure, fetch-capable origin so an iframe pointed at offline://<id>/...
// can load and so relative asset requests inside the page (js/css/img)
// resolve correctly - this is what a plain file:// src can't do.
protocol.registerSchemesAsPrivileged([
  {
    scheme: "offline",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

app.whenReady().then(async () => {
  const cookies = await session.defaultSession.cookies.get({
    url: "https://app.knowe.in",
  });

  console.log("Electron cookies:", cookies);

  session.defaultSession.webRequest.onBeforeSendHeaders(
    (details, callback) => {
      if (details.url.includes("/api/classes")) {
        fs.appendFileSync(
          path.join(app.getPath("desktop"), "headers.txt"),
          JSON.stringify(details.requestHeaders, null, 2) + "\n\n"
        );
      }

      callback({ requestHeaders: details.requestHeaders });
    }
  );

  ipcMain.handle("set-cookie", async (_, token) => {
    try {
      await session.defaultSession.cookies.set({
        url: "https://app.knowe.in",
        name: "token",
        value: token,
        path: "/",
        secure: true,
        httpOnly: true,
        sameSite: "no_restriction",
      });

      console.log("✅ Cookie set successfully");

      const cookies = await session.defaultSession.cookies.get({
        url: "https://app.knowe.in",
      });

      console.log("Current Cookies:", cookies);

      return true;
    } catch (err) {
      console.error("❌ Failed to set cookie:", err);
      return false;
    }
  });


  console.log("__dirname:", __dirname);
  console.log(
    "Preload exists:",
    fs.existsSync(path.join(__dirname, "preload.js"))
  );
  console.log("Preload path:", path.join(__dirname, "preload.js"));

  const downloadsDir = path.join(app.getPath("userData"), "downloads");

  const assessmentsDir = path.join(
    downloadsDir,
    "assessments"
  );

  const manifestPath = path.join(
    app.getPath("userData"),
    "downloads-manifest.json"
  );

  const tempDownloadsDir = path.join(
    app.getPath("temp"),
    "knowe-lms"
  );



  // ======================================================
// ACTIVE PORTABLE LIBRARY
// ======================================================

const activeLibraryConfigPath = path.join(
  app.getPath("userData"),
  "active-library.json"
);

function getActiveLibraryRoot() {
  if (!fs.existsSync(activeLibraryConfigPath)) {
    return null;
  }

  try {
    const config = JSON.parse(
      fs.readFileSync(
        activeLibraryConfigPath,
        "utf-8"
      )
    );

    if (!config.libraryRoot) {
      return null;
    }

    return config.libraryRoot;
  } catch (error) {
    console.error(
      "❌ Failed to read active library:",
      error
    );

    return null;
  }
}

function setActiveLibraryRoot(libraryRoot) {
  if (!libraryRoot) {
    throw new Error(
      "Portable library folder is required."
    );
  }

  const root = path.resolve(libraryRoot);

  fs.mkdirSync(root, {
    recursive: true,
  });

  fs.writeFileSync(
    activeLibraryConfigPath,
    JSON.stringify(
      {
        libraryRoot: root,
      },
      null,
      2
    ),
    "utf-8"
  );

  return root;
}


function getActivePortableLibrary() {
  const libraryRoot = getActiveLibraryRoot();

  if (!libraryRoot) {
    throw new Error("No portable library selected.");
  }

  if (!fs.existsSync(libraryRoot)) {
    throw new Error("Selected portable library folder does not exist.");
  }

  const library = createPortableLibrary(libraryRoot);
  const key = getPortableEncryptionKey(libraryRoot);

  return {
    libraryRoot,
    library,
    key,
  };
}


  // ======================================================
// PORTABLE LIBRARY FOUNDATION
// ======================================================

const portableLibraryTestDir = path.join(
  app.getPath("userData"),
  "portable-library-test"
);

try {
  const library = createPortableLibrary(
    portableLibraryTestDir
  );

  console.log(
    "✅ Portable library foundation initialized."
  );

  console.log(
    "Portable library structure:",
    getLibraryStructure(portableLibraryTestDir)
  );

  console.log(
    "Portable library metadata:",
    library
  );
} catch (error) {
  console.error(
    "❌ Portable library foundation failed:",
    error
  );
}


try {
  const portableKey = getPortableEncryptionKey(
    portableLibraryTestDir
  );

  console.log(
    "✅ Portable encryption key loaded."
  );

  console.log(
    "Portable key exists:",
    portableKeyExists(portableLibraryTestDir)
  );

  console.log(
    "Portable key length:",
    portableKey.length
  );

  console.log(
    "Portable key path:",
    getPortableKeyPath(
      portableLibraryTestDir
    )
  );
} catch (error) {
  console.error(
    "❌ Portable encryption key test failed:",
    error
  );
}



try {
  const testText =
    "Knowe LMS portable encryption test";

  const testBuffer = Buffer.from(
    testText,
    "utf-8"
  );

  const portableKey =
    getPortableEncryptionKey(
      portableLibraryTestDir
    );

  // Encrypt
  const encryptedBuffer =
    encryptBuffer(
      testBuffer,
      portableKey
    );

  const encryptedPath = path.join(
    portableLibraryTestDir,
    "content",
    "encryption-test.enc"
  );

  fs.writeFileSync(
    encryptedPath,
    encryptedBuffer
  );

  console.log(
    "✅ Test data encrypted."
  );

  // Read encrypted file
  const storedEncryptedBuffer =
    fs.readFileSync(
      encryptedPath
    );

  // Decrypt
  const decryptedBuffer =
    decryptBuffer(
      storedEncryptedBuffer,
      portableKey
    );

  const decryptedText =
    decryptedBuffer.toString("utf-8");

  console.log(
    "Decrypted test data:",
    decryptedText
  );

  if (decryptedText === testText) {
    console.log(
      "✅ PORTABLE ENCRYPTION TEST PASSED."
    );
  } else {
    console.error(
      "❌ Encryption test FAILED: data mismatch."
    );
  }
} catch (error) {
  console.error(
    "❌ Portable encryption test failed:",
    error
  );
}


// try {
//   const testRoot =
//     portableLibraryTestDir;

//   const savedRoot =
//     setActiveLibraryRoot(
//       testRoot
//     );

//   console.log(
//     "✅ Active library saved:",
//     savedRoot
//   );

//   console.log(
//     "Active library read back:",
//     getActiveLibraryRoot()
//   );
// } catch (error) {
//   console.error(
//     "❌ Active library test failed:",
//     error
//   );
// }

  function cleanupTempDownloads() {
    try {
      if (fs.existsSync(tempDownloadsDir)) {
        fs.rmSync(tempDownloadsDir, {
          recursive: true,
          force: true,
        });

        console.log(
          "🧹 Temporary decrypted content cleaned."
        );
      }
    } catch (err) {
      console.error(
        "❌ Failed to clean temporary content:",
        err
      );
    }
  }

  cleanupTempDownloads();

  const encryptionKeyPath = path.join(
    app.getPath("userData"),
    "encryption.key"
  );

  function getEncryptionKey() {
    // Existing key
    if (fs.existsSync(encryptionKeyPath)) {
      const encryptedKey = fs.readFileSync(
        encryptionKeyPath
      );

      const keyBase64 =
        safeStorage.decryptString(encryptedKey);

      return Buffer.from(keyBase64, "base64");
    }

    // Generate a new 256-bit key
    const key = crypto.randomBytes(32);

    // Protect the key using the operating system
    const encryptedKey =
      safeStorage.encryptString(
        key.toString("base64")
      );

    fs.writeFileSync(
      encryptionKeyPath,
      encryptedKey
    );

    console.log("✅ New encryption key created");

    return key;
  }

  function readManifest() {
    if (!fs.existsSync(manifestPath)) return {};
    return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  }

  function writeManifest(manifest) {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }

  // Recursively locate the package's entry HTML file. HTML5 lesson
  // packages often nest it inside a subfolder (e.g. "html5/story.html")
  // rather than dropping it at the extraction root.
  function findEntryFile(rootDir, currentDir = rootDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    const priority = ["story.html", "index_lms.html", "index.html"];

    for (const name of priority) {
      if (entries.some((e) => e.isFile() && e.name === name)) {
        return path.relative(rootDir, path.join(currentDir, name));
      }
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const found = findEntryFile(rootDir, path.join(currentDir, entry.name));
        if (found) return found;
      }
    }

    const anyHtml = entries.find(
      (e) => e.isFile() && e.name.toLowerCase().endsWith(".html")
    );

    return anyHtml
      ? path.relative(rootDir, path.join(currentDir, anyHtml.name))
      : null;
  }

  // Serves extracted offline packages over the "offline" scheme instead of
  // file:// - Chromium blocks file:// iframes from a non-file:// parent
  // (our dev renderer is http://localhost:5173), and even in production a
  // bare file:// src can't resolve the package's own relative asset
  // requests. offline://pkg/<topicId>/<relative/path> fixes both.
  //
  // NOTE: the topicId deliberately lives in the *path*, not the host.
  // "offline" is registered as a standard scheme, and Chromium's URL
  // parser applies IPv4-style canonicalization to numeric hostnames - a
  // host of "2116" silently becomes "0.0.8.68". Using a fixed host
  // ("pkg") avoids that trap entirely.
  // protocol.handle("offline", (request) => {
  //   try {
  //     const url = new URL(request.url);

  //     // For:
  //     // offline://temp/2116/story.html
  //     //
  //     // hostname = "temp"
  //     // pathname = "/2116/story.html"

  //     const type = url.hostname;

  //     const decodedPath = decodeURIComponent(
  //       url.pathname
  //     ).replace(/^\/+/, "");

  //     const parts = decodedPath.split("/");

  //     const topicId = parts.shift();
  //     const relPath = parts.join("/");

  //     let baseDir;

  //     // Permanently stored package
  //     // offline://pkg/2116/...
  //     if (type === "pkg") {
  //       baseDir = path.resolve(
  //         path.join(downloadsDir, topicId)
  //       );
  //     }

  //     // Temporarily decrypted package
  //     // offline://temp/2116/...
  //     else if (type === "temp") {
  //       const tempRoot = path.join(
  //         app.getPath("temp"),
  //         "knowe-lms"
  //       );

  //       baseDir = path.resolve(
  //         path.join(tempRoot, topicId)
  //       );
  //     }

  //     else {
  //       return new Response(
  //         "Invalid offline resource",
  //         {
  //           status: 400,
  //         }
  //       );
  //     }

  //     const target = path.resolve(
  //       path.join(baseDir, relPath)
  //     );

  //     // Prevent path traversal
  //     if (
  //       target !== baseDir &&
  //       !target.startsWith(
  //         baseDir + path.sep
  //       )
  //     ) {
  //       return new Response(
  //         "Forbidden",
  //         {
  //           status: 403,
  //         }
  //       );
  //     }

  //     if (!fs.existsSync(target)) {
  //       console.error(
  //         "Offline file not found:",
  //         target
  //       );

  //       return new Response(
  //         "File not found",
  //         {
  //           status: 404,
  //         }
  //       );
  //     }

  //     console.log(
  //       "Offline request:",
  //       request.url
  //     );

  //     console.log(
  //       "Serving:",
  //       target
  //     );

  //     return net.fetch(
  //       pathToFileURL(target).href
  //     );
  //   } catch (error) {
  //     console.error(
  //       "Offline protocol error:",
  //       error
  //     );

  //     return new Response(
  //       "Internal server error",
  //       {
  //         status: 500,
  //       }
  //     );
  //   }
  // });

  protocol.handle("offline", async (request) => {
    try {
      console.log("");
      console.log("========== OFFLINE REQUEST ==========");
      console.log("URL:", request.url);

      const url = new URL(request.url);

      const type = url.hostname;

      const decodedPath = decodeURIComponent(
        url.pathname
      ).replace(/^\/+/, "");

      const parts = decodedPath.split("/");

      const topicId = parts.shift();
      const relPath = parts.join("/");

      console.log("Type:", type);
      console.log("Topic:", topicId);
      console.log("Relative path:", relPath);

      let baseDir;

      if (type === "pkg") {
        baseDir = path.resolve(
          path.join(downloadsDir, topicId)
        );
      } else if (type === "temp") {
        baseDir = path.resolve(
          path.join(tempDownloadsDir, topicId)
        );
      } else {
        console.error("Invalid offline type:", type);

        return new Response(
          "Invalid offline resource",
          { status: 400 }
        );
      }

      const target = path.resolve(
        path.join(baseDir, relPath)
      );

      console.log("Base directory:", baseDir);
      console.log("Target:", target);
      console.log("Exists:", fs.existsSync(target));

      if (
        target !== baseDir &&
        !target.startsWith(baseDir + path.sep)
      ) {
        console.error("PATH TRAVERSAL BLOCKED");

        return new Response(
          "Forbidden",
          { status: 403 }
        );
      }

      if (!fs.existsSync(target)) {
        console.error(
          "❌ OFFLINE FILE NOT FOUND:",
          target
        );

        return new Response(
          "File not found",
          { status: 404 }
        );
      }

      console.log(
        "✅ SERVING:",
        target
      );

      const response = await net.fetch(
        pathToFileURL(target).href
      );

      console.log(
        "Response status:",
        response.status
      );

      console.log(
        "Response content-type:",
        response.headers.get("content-type")
      );

      console.log(
        "===================================="
      );

      return response;

    } catch (error) {
      console.error(
        "❌ OFFLINE PROTOCOL ERROR:",
        error
      );

      return new Response(
        "Internal server error",
        { status: 500 }
      );
    }
  });


  // ipcMain.handle("download-extract", async (_, { buffer, meta }) => {
  //   try {
  //     if (!fs.existsSync(downloadsDir)) {
  //       fs.mkdirSync(downloadsDir, {
  //         recursive: true,
  //       });
  //     }

  //     const folderName = String(meta.topicId);

  //     const topicDir = path.join(
  //       downloadsDir,
  //       folderName
  //     );

  //     // Remove previous download
  //     if (fs.existsSync(topicDir)) {
  //       fs.rmSync(topicDir, {
  //         recursive: true,
  //         force: true,
  //       });
  //     }

  //     // Create topic folder
  //     fs.mkdirSync(topicDir, {
  //       recursive: true,
  //     });

  //     // Get our AES-256 key
  //     const key = getEncryptionKey();

  //     // Encrypt the downloaded ZIP
  //     const encryptedBuffer = encryptBuffer(
  //       Buffer.from(buffer),
  //       key
  //     );

  //     // Store encrypted content
  //     const encryptedPath = path.join(
  //       topicDir,
  //       "content.enc"
  //     );

  //     fs.writeFileSync(
  //       encryptedPath,
  //       encryptedBuffer
  //     );

  //     // Update manifest
  //     const manifest = readManifest();

  //     // Make sure individual section exists
  //     if (!manifest.individual) {
  //       manifest.individual = {};
  //     }

  //     manifest.individual[folderName] = {
  //       ...meta,
  //       encryptedPath,
  //       downloadedAt: new Date().toISOString(),
  //     };

  //     writeManifest(manifest);

  //     console.log(
  //       `✅ Encrypted content stored: ${encryptedPath}`
  //     );

  //     return {
  //       success: true,
  //       entry: manifest.individual[folderName],
  //     };
  //   } catch (err) {
  //     console.error(
  //       "❌ Encryption failed:",
  //       err
  //     );

  //     return {
  //       success: false,
  //       error: err.message,
  //     };
  //   }
  // });


  ipcMain.handle("download-extract", async (_, { buffer, meta }) => {
  try {
    console.log("=================================");
    console.log("PORTABLE CONTENT DOWNLOAD");
    console.log("=================================");

    const topicId = String(meta?.topicId);

    if (!topicId || topicId === "undefined") {
      throw new Error("Topic ID is required.");
    }

    // -----------------------------------------
    // Get active portable library
    // -----------------------------------------

    const {
      libraryRoot,
      library,
      key,
    } = getActivePortableLibrary();

    console.log("Portable library:", libraryRoot);

    // -----------------------------------------
    // Prepare topic directory
    // -----------------------------------------

    const topicDir = path.join(
      libraryRoot,
      "content",
      topicId
    );

    // Remove previous portable copy
    if (fs.existsSync(topicDir)) {
      fs.rmSync(topicDir, {
        recursive: true,
        force: true,
      });
    }

    fs.mkdirSync(topicDir, {
      recursive: true,
    });

    // -----------------------------------------
    // Encrypt downloaded ZIP
    // -----------------------------------------

    const encryptedBuffer = encryptBuffer(
      Buffer.from(buffer),
      key
    );

    // -----------------------------------------
    // Store encrypted content
    // -----------------------------------------

    const encryptedPath = path.join(
      topicDir,
      "content.enc"
    );

    fs.writeFileSync(
      encryptedPath,
      encryptedBuffer
    );

    // -----------------------------------------
    // Store RELATIVE path in portable library
    // -----------------------------------------

    const relativePath = getRelativeLibraryPath(
      libraryRoot,
      encryptedPath
    );

    // -----------------------------------------
    // Update portable library metadata
    // -----------------------------------------

    if (!library.content) {
      library.content = {};
    }

    const downloadedAt = new Date().toISOString();

    library.content[topicId] = {
      ...meta,
      topicId,
      encryptedPath: relativePath,
      downloadedAt,
    };

    writePortableLibrary(
      libraryRoot,
      library
    );

    console.log(
      `✅ Portable encrypted content stored: ${encryptedPath}`
    );

    console.log(
      `✅ Portable relative path: ${relativePath}`
    );

    console.log(
      `✅ Portable library metadata updated: ${path.join(
        libraryRoot,
        "library.json"
      )}`
    );

    console.log("=================================");

    return {
      success: true,
      entry: library.content[topicId],
    };

  } catch (err) {
    console.error(
      "❌ Portable content download failed:",
      err
    );

    return {
      success: false,
      error: err.message,
    };
  }
});



  // ipcMain.handle("play-download", async (_, topicId) => {
  //   try {
  //     const manifest = readManifest();

  //     const folderName = String(topicId);

  //     let entry = null;

  //     // -----------------------------------------
  //     // 1. Check individual downloads
  //     // -----------------------------------------

  //     if (manifest.individual?.[folderName]) {
  //       entry = manifest.individual[folderName];
  //     }

  //     // -----------------------------------------
  //     // 2. Check bulk subject downloads
  //     // -----------------------------------------

  //     if (!entry && manifest.subjects) {
  //       for (const subject of Object.values(
  //         manifest.subjects
  //       )) {
  //         for (const chapter of Object.values(
  //           subject.chapters || {}
  //         )) {
  //           if (
  //             chapter.topics?.[folderName]
  //           ) {
  //             entry =
  //               chapter.topics[folderName];

  //             break;
  //           }
  //         }

  //         if (entry) break;
  //       }
  //     }

  //     // -----------------------------------------
  //     // 3. Nothing found
  //     // -----------------------------------------

  //     if (!entry) {
  //       throw new Error(
  //         "Downloaded content not found."
  //       );
  //     }

  //     if (!entry.encryptedPath) {
  //       throw new Error(
  //         "This download is not encrypted or is from an older version."
  //       );
  //     }

  //     // -----------------------------------------
  //     // 4. Check encrypted file
  //     // -----------------------------------------

  //     if (!fs.existsSync(entry.encryptedPath)) {
  //       throw new Error(
  //         "Encrypted content file is missing."
  //       );
  //     }

  //     // -----------------------------------------
  //     // 5. Get encryption key
  //     // -----------------------------------------

  //     const key = getEncryptionKey();

  //     // -----------------------------------------
  //     // 6. Read encrypted content
  //     // -----------------------------------------

  //     const encryptedBuffer =
  //       fs.readFileSync(
  //         entry.encryptedPath
  //       );

  //     // -----------------------------------------
  //     // 7. Decrypt ZIP
  //     // -----------------------------------------

  //     const zipBuffer =
  //       decryptBuffer(
  //         encryptedBuffer,
  //         key
  //       );

  //     // -----------------------------------------
  //     // 8. Temporary playback directory
  //     // -----------------------------------------

  //     const tempRoot =
  //       tempDownloadsDir;

  //     const extractPath =
  //       path.join(
  //         tempRoot,
  //         folderName
  //       );

  //     // Remove previous temporary copy
  //     if (fs.existsSync(extractPath)) {
  //       fs.rmSync(
  //         extractPath,
  //         {
  //           recursive: true,
  //           force: true,
  //         }
  //       );
  //     }

  //     fs.mkdirSync(
  //       extractPath,
  //       {
  //         recursive: true,
  //       }
  //     );

  //     // -----------------------------------------
  //     // 9. Extract decrypted ZIP
  //     // -----------------------------------------

  //     const zip =
  //       new AdmZip(zipBuffer);

  //     zip.extractAllTo(
  //       extractPath,
  //       true
  //     );

  //     // -----------------------------------------
  //     // 10. Find playable HTML
  //     // -----------------------------------------

  //     const entryRelPath =
  //       findEntryFile(
  //         extractPath
  //       );

  //     if (!entryRelPath) {
  //       throw new Error(
  //         "No playable HTML file found in downloaded content."
  //       );
  //     }

  //     // -----------------------------------------
  //     // 11. Build offline URL
  //     // -----------------------------------------

  //     const entryUrl =
  //       `offline://temp/${folderName}/${entryRelPath
  //         .split(path.sep)
  //         .map(encodeURIComponent)
  //         .join("/")}`;

  //     console.log(
  //       "✅ Offline content decrypted:",
  //       entryUrl
  //     );

  //     return {
  //       success: true,
  //       entryUrl,
  //     };

  //   } catch (err) {
  //     console.error(
  //       "❌ Offline playback failed:",
  //       err
  //     );

  //     return {
  //       success: false,
  //       error: err.message,
  //     };
  //   }
  // });


  ipcMain.handle("play-download", async (_, topicId) => {
  try {
    console.log("=================================");
    console.log("PORTABLE CONTENT PLAYBACK");
    console.log("=================================");

    const folderName = String(topicId);

    if (!folderName || folderName === "undefined") {
      throw new Error("Topic ID is required.");
    }

    // -----------------------------------------
    // Get active portable library
    // -----------------------------------------

    const {
      libraryRoot,
      library,
      key,
    } = getActivePortableLibrary();

    // -----------------------------------------
    // Find topic in portable library
    // -----------------------------------------

    const entry = library.content?.[folderName];

    if (!entry) {
      throw new Error(
        "Downloaded content not found in portable library."
      );
    }

    if (!entry.encryptedPath) {
      throw new Error(
        "Portable content does not have an encrypted path."
      );
    }

    // -----------------------------------------
    // Resolve relative path safely
    // -----------------------------------------

    const encryptedPath = resolveLibraryPath(
      libraryRoot,
      entry.encryptedPath
    );

    console.log(
      "Portable encrypted file:",
      encryptedPath
    );

    if (!fs.existsSync(encryptedPath)) {
      throw new Error(
        "Portable encrypted content file is missing."
      );
    }

    // -----------------------------------------
    // Read encrypted content
    // -----------------------------------------

    const encryptedBuffer = fs.readFileSync(
      encryptedPath
    );

    // -----------------------------------------
    // Decrypt using portable library key
    // -----------------------------------------

    const zipBuffer = decryptBuffer(
      encryptedBuffer,
      key
    );

    console.log(
      "✅ Portable content decrypted successfully."
    );

    // -----------------------------------------
    // Temporary playback directory
    // -----------------------------------------

    const tempRoot = tempDownloadsDir;

    const extractPath = path.join(
      tempRoot,
      folderName
    );

    // Remove previous temporary copy
    if (fs.existsSync(extractPath)) {
      fs.rmSync(extractPath, {
        recursive: true,
        force: true,
      });
    }

    fs.mkdirSync(extractPath, {
      recursive: true,
    });

    // -----------------------------------------
    // Extract decrypted ZIP
    // -----------------------------------------

    const zip = new AdmZip(zipBuffer);

    zip.extractAllTo(
      extractPath,
      true
    );

    // -----------------------------------------
    // Find playable HTML file
    // -----------------------------------------

    const entryRelPath = findEntryFile(
      extractPath
    );

    if (!entryRelPath) {
      throw new Error(
        "No playable HTML file found in downloaded content."
      );
    }

    // -----------------------------------------
    // Build offline URL
    // -----------------------------------------

    const entryUrl =
      `offline://temp/${folderName}/${entryRelPath
        .split(path.sep)
        .map(encodeURIComponent)
        .join("/")}`;

    console.log(
      "✅ Portable offline content ready:",
      entryUrl
    );

    console.log("=================================");

    return {
      success: true,
      entryUrl,
    };

  } catch (err) {
    console.error(
      "❌ Portable playback failed:",
      err
    );

    return {
      success: false,
      error: err.message,
    };
  }
});


  // ipcMain.handle("list-downloads", () => {
  //   const manifest = readManifest();

  //   // -----------------------------------------
  //   // Clean stale individual downloads
  //   // -----------------------------------------

  //   if (manifest.individual) {
  //     for (const topicId of Object.keys(manifest.individual)) {
  //       const entry = manifest.individual[topicId];

  //       if (
  //         !entry.encryptedPath ||
  //         !fs.existsSync(entry.encryptedPath)
  //       ) {
  //         delete manifest.individual[topicId];
  //       }
  //     }
  //   }

  //   // -----------------------------------------
  //   // Clean stale topics inside subjects
  //   // -----------------------------------------

  //   if (manifest.subjects) {
  //     for (const subjectId of Object.keys(manifest.subjects)) {
  //       const subject = manifest.subjects[subjectId];

  //       if (!subject.chapters) continue;

  //       for (const chapterId of Object.keys(subject.chapters)) {
  //         const chapter = subject.chapters[chapterId];

  //         if (!chapter.topics) continue;

  //         for (const topicId of Object.keys(chapter.topics)) {
  //           const topic = chapter.topics[topicId];

  //           if (
  //             !topic.encryptedPath ||
  //             !fs.existsSync(topic.encryptedPath)
  //           ) {
  //             delete chapter.topics[topicId];
  //           }
  //         }

  //         // Remove empty chapter
  //         if (
  //           Object.keys(chapter.topics).length === 0
  //         ) {
  //           delete subject.chapters[chapterId];
  //         }
  //       }

  //       // Remove empty subject
  //       if (
  //         Object.keys(subject.chapters).length === 0
  //       ) {
  //         delete manifest.subjects[subjectId];
  //       }
  //     }
  //   }

  //   // Save cleaned manifest
  //   writeManifest(manifest);

  //   return {
  //     subjects: Object.values(
  //       manifest.subjects || {}
  //     ),

  //     individual: Object.values(
  //       manifest.individual || {}
  //     ),

  //     assessments: Object.values(manifest.assessments || {}),
  //   };
  // });


//   ipcMain.handle("list-downloads", () => {
//   try {
//     console.log("=================================");
//     console.log("LIST PORTABLE DOWNLOADS");
//     console.log("=================================");

//     const libraryRoot = getActiveLibraryRoot();

//     // No portable library selected yet
//     if (!libraryRoot) {
//       return {
//         success: true,
//         libraryRoot: null,
//         subjects: [],
//         individual: [],
//         assessments: [],
//       };
//     }

//     // Selected folder is no longer available
//     if (!fs.existsSync(libraryRoot)) {
//       return {
//         success: true,
//         libraryRoot: null,
//         subjects: [],
//         individual: [],
//         assessments: [],
//       };
//     }

//     const library = readPortableLibrary(libraryRoot);

//     const portableContent = Object.values(
//       library.content || {}
//     ).filter((item) => {
//       if (!item?.encryptedPath) {
//         return false;
//       }

//       try {
//         const encryptedPath = resolveLibraryPath(
//           libraryRoot,
//           item.encryptedPath
//         );

//         return fs.existsSync(encryptedPath);
//       } catch (error) {
//         console.error(
//           "Invalid portable content path:",
//           error
//         );

//         return false;
//       }
//     });

//     const portableAssessments = Object.values(
//       library.assessments || {}
//     ).filter((item) => {
//       if (!item?.encryptedPath) {
//         return false;
//       }

//       try {
//         const encryptedPath = resolveLibraryPath(
//           libraryRoot,
//           item.encryptedPath
//         );

//         return fs.existsSync(encryptedPath);
//       } catch (error) {
//         console.error(
//           "Invalid portable assessment path:",
//           error
//         );

//         return false;
//       }
//     });

//     console.log(
//       `Portable content found: ${portableContent.length}`
//     );

//     console.log(
//       `Portable assessments found: ${portableAssessments.length}`
//     );

//     console.log("=================================");

//     return {
//       success: true,

//       libraryRoot,

//       // Keep old structure so Downloads.jsx
//       // continues working without UI changes.
//       subjects: [],

//       // Portable downloaded topics
//       individual: portableContent,

//       // Portable downloaded assessments
//       assessments: portableAssessments,
//     };

//   } catch (error) {
//     console.error(
//       "❌ Failed to list portable downloads:",
//       error
//     );

//     return {
//       success: false,
//       error: error.message,
//       subjects: [],
//       individual: [],
//       assessments: [],
//     };
//   }
// });


ipcMain.handle("list-downloads", () => {
  try {
    console.log("=================================");
    console.log("LIST PORTABLE DOWNLOADS");
    console.log("=================================");

    const libraryRoot = getActiveLibraryRoot();

    // --------------------------------------------------
    // No portable library selected
    // --------------------------------------------------

    if (!libraryRoot) {
      return {
        success: true,
        libraryRoot: null,
        subjects: [],
        individual: [],
        assessments: [],
      };
    }

    // --------------------------------------------------
    // Selected folder no longer exists
    // --------------------------------------------------

    if (!fs.existsSync(libraryRoot)) {
      return {
        success: true,
        libraryRoot: null,
        subjects: [],
        individual: [],
        assessments: [],
      };
    }

    const library = readPortableLibrary(libraryRoot);

    // ==================================================
    // 1. SUBJECT DOWNLOADS
    // ==================================================

    const portableSubjects = Object.values(
      library.subjects || {}
    )
      .map((subject) => {
        const validChapters = Object.values(
          subject.chapters || {}
        )
          .map((chapter) => {
            const validTopics = Object.values(
              chapter.topics || {}
            ).filter((topic) => {
              if (!topic?.encryptedPath) {
                return false;
              }

              try {
                const encryptedPath =
                  resolveLibraryPath(
                    libraryRoot,
                    topic.encryptedPath
                  );

                return fs.existsSync(
                  encryptedPath
                );
              } catch (error) {
                console.error(
                  "Invalid portable subject topic path:",
                  error
                );

                return false;
              }
            });

            if (validTopics.length === 0) {
              return null;
            }

            return {
              ...chapter,
              topics: validTopics,
            };
          })
          .filter(Boolean);

        if (validChapters.length === 0) {
          return null;
        }

        return {
          ...subject,
          chapters: validChapters,
        };
      })
      .filter(Boolean);

    // ==================================================
    // 2. COLLECT SUBJECT TOPIC IDS
    //
    // This also handles old library.json entries
    // where subject topics were incorrectly stored
    // inside library.content.
    // ==================================================

    const subjectTopicIds = new Set();

    for (const subject of portableSubjects) {
      for (const chapter of subject.chapters || []) {
        for (const topic of chapter.topics || []) {
          subjectTopicIds.add(
            String(topic.topicId)
          );
        }
      }
    }

    // ==================================================
    // 3. INDIVIDUAL DOWNLOADS
    // ==================================================

    const portableContent = Object.values(
      library.content || {}
    ).filter((item) => {
      if (!item?.encryptedPath) {
        return false;
      }

      // Do not show subject-download topics
      // inside Individual Downloads.
      if (
        item.source === "subject" ||
        subjectTopicIds.has(
          String(item.topicId)
        )
      ) {
        return false;
      }

      try {
        const encryptedPath =
          resolveLibraryPath(
            libraryRoot,
            item.encryptedPath
          );

        return fs.existsSync(
          encryptedPath
        );
      } catch (error) {
        console.error(
          "Invalid portable content path:",
          error
        );

        return false;
      }
    });

    // ==================================================
    // 4. ASSESSMENTS
    // ==================================================

    const portableAssessments = Object.values(
      library.assessments || {}
    ).filter((item) => {
      if (!item?.encryptedPath) {
        return false;
      }

      try {
        const encryptedPath =
          resolveLibraryPath(
            libraryRoot,
            item.encryptedPath
          );

        return fs.existsSync(
          encryptedPath
        );
      } catch (error) {
        console.error(
          "Invalid portable assessment path:",
          error
        );

        return false;
      }
    });

    // ==================================================
    // LOGS
    // ==================================================

    console.log(
      `Portable subjects found: ${portableSubjects.length}`
    );

    console.log(
      `Portable individual content found: ${portableContent.length}`
    );

    console.log(
      `Portable assessments found: ${portableAssessments.length}`
    );

    console.log("=================================");

    // ==================================================
    // RETURN
    // ==================================================

    return {
      success: true,

      libraryRoot,

      subjects: portableSubjects,

      individual: portableContent,

      assessments: portableAssessments,
    };
  } catch (error) {
    console.error(
      "❌ Failed to list portable downloads:",
      error
    );

    return {
      success: false,
      error: error.message,
      subjects: [],
      individual: [],
      assessments: [],
    };
  }
});

  // ipcMain.handle("delete-download", (_, topicId) => {
  //   try {
  //     const manifest = readManifest();
  //     const entry = manifest[String(topicId)];

  //     if (entry && entry.encryptedPath) {
  //       const topicDir = path.dirname(
  //         entry.encryptedPath
  //       );

  //       if (fs.existsSync(topicDir)) {
  //         fs.rmSync(topicDir, {
  //           recursive: true,
  //           force: true,
  //         });
  //       }
  //     }

  //     delete manifest[String(topicId)];
  //     writeManifest(manifest);

  //     return { success: true };
  //   } catch (err) {
  //     console.error("Delete download failed:", err);

  //     return {
  //       success: false,
  //       error: err.message,
  //     };
  //   }
  // });

    // ipcMain.handle("download-subject-test", async (_, { buffer, meta }) => {
    //   try {
    //     console.log("=================================");
    //     console.log("BULK SUBJECT DOWNLOAD");
    //     console.log("=================================");

    //     const testDir = path.join(
    //       app.getPath("temp"),
    //       "knowe-lms-subject-test"
    //     );

    //     // Clean previous temporary data
    //     if (fs.existsSync(testDir)) {
    //       fs.rmSync(testDir, {
    //         recursive: true,
    //         force: true,
    //       });
    //     }

    //     fs.mkdirSync(testDir, {
    //       recursive: true,
    //     });

    //     // --------------------------------------------------
    //     // 1. Save subject ZIP temporarily
    //     // --------------------------------------------------

    //     const subjectZipPath = path.join(
    //       testDir,
    //       "subject.zip"
    //     );

    //     fs.writeFileSync(
    //       subjectZipPath,
    //       Buffer.from(buffer)
    //     );

    //     console.log(
    //       "Subject ZIP saved:",
    //       subjectZipPath
    //     );

    //     // --------------------------------------------------
    //     // 2. Extract subject ZIP
    //     // --------------------------------------------------

    //     const subjectExtractPath = path.join(
    //       testDir,
    //       "subject"
    //     );

    //     fs.mkdirSync(subjectExtractPath, {
    //       recursive: true,
    //     });

    //     const subjectZip = new AdmZip(
    //       subjectZipPath
    //     );

    //     subjectZip.extractAllTo(
    //       subjectExtractPath,
    //       true
    //     );

    //     console.log(
    //       "Subject ZIP extracted."
    //     );

    //     // --------------------------------------------------
    //     // 3. Find all chapters
    //     // --------------------------------------------------

    //     const rootEntries = fs.readdirSync(
    //       subjectExtractPath,
    //       { withFileTypes: true }
    //     );

    //     const chapterEntries = rootEntries.filter(
    //       (entry) =>
    //         entry.isDirectory() &&
    //         entry.name.startsWith("Chapter_")
    //     );

    //     console.log(
    //       `Found ${chapterEntries.length} chapters.`
    //     );

    //     // Existing encryption key
    //     const key = getEncryptionKey();

    //     const manifest = readManifest();

    //     const processedTopics = [];

    //     // --------------------------------------------------
    //     // 4. Process every chapter
    //     // --------------------------------------------------

    //     for (const chapterEntry of chapterEntries) {
    //       const chapterId =
    //         chapterEntry.name.replace(
    //           "Chapter_",
    //           ""
    //         );

    //       const chapterPath = path.join(
    //         subjectExtractPath,
    //         chapterEntry.name
    //       );

    //       console.log("");
    //       console.log(
    //         `📖 Processing Chapter ${chapterId}`
    //       );

    //       const topicEntries = fs.readdirSync(
    //         chapterPath,
    //         { withFileTypes: true }
    //       );

    //       const topics = topicEntries.filter(
    //         (entry) =>
    //           entry.isDirectory() &&
    //           entry.name.startsWith("Topic_")
    //       );

    //       console.log(
    //         `   Found ${topics.length} topics`
    //       );

    //       // ------------------------------------------------
    //       // 5. Process every topic
    //       // ------------------------------------------------

    //       for (const topicEntry of topics) {
    //         const topicId =
    //           topicEntry.name.replace(
    //             "Topic_",
    //             ""
    //           );

    //         const topicPath = path.join(
    //           chapterPath,
    //           topicEntry.name
    //         );

    //         console.log(
    //           `   ▶ Processing Topic ${topicId}`
    //         );

    //         // ----------------------------------------------
    //         // Create ZIP in memory
    //         // ----------------------------------------------

    //         const topicZip = new AdmZip();

    //         topicZip.addLocalFolder(
    //           topicPath
    //         );

    //         const topicZipBuffer =
    //           topicZip.toBuffer();

    //         console.log(
    //           `      ZIP size: ${(
    //             topicZipBuffer.length /
    //             1024 /
    //             1024
    //           ).toFixed(2)} MB`
    //         );

    //         // ----------------------------------------------
    //         // Encrypt ZIP
    //         // ----------------------------------------------

    //         const encryptedBuffer =
    //           encryptBuffer(
    //             topicZipBuffer,
    //             key
    //           );

    //         // ----------------------------------------------
    //         // Permanent encrypted location
    //         // ----------------------------------------------

    //         const topicDownloadDir = path.join(
    //           downloadsDir,
    //           String(topicId)
    //         );

    //         // Make sure the main downloads directory exists
    //         fs.mkdirSync(downloadsDir, {
    //           recursive: true,
    //         });

    //         // Don't delete the topic directory.
    //         // Just make sure it exists.
    //         fs.mkdirSync(topicDownloadDir, {
    //           recursive: true,
    //         });

    //         const encryptedPath = path.join(
    //           topicDownloadDir,
    //           "content.enc"
    //         );

    //         // Replace existing encrypted content
    //         fs.writeFileSync(
    //           encryptedPath,
    //           encryptedBuffer
    //         );

    //         console.log(
    //           `      ✅ Encrypted: ${encryptedPath}`
    //         );

    //         // ----------------------------------------------
    //         // Add manifest entry
    //         // ----------------------------------------------

    //         const subjectId = String(meta?.subjectId);

    //         if (!manifest.subjects) {
    //           manifest.subjects = {};
    //         }

    //         if (!manifest.subjects[subjectId]) {
    //           manifest.subjects[subjectId] = {
    //             subjectId: Number(subjectId),
    //             subjectName: meta?.subjectName ?? `Subject ${subjectId}`,
    //             classId: meta?.classId ?? null,
    //             chapters: {},
    //           };
    //         }

    //         if (!manifest.subjects[subjectId].chapters[chapterId]) {
    //           manifest.subjects[subjectId].chapters[chapterId] = {
    //             chapterId: Number(chapterId),
    //             chapterName: `Chapter ${chapterId}`,
    //             topics: {},
    //           };
    //         }

    //         manifest.subjects[subjectId].chapters[chapterId].topics[
    //           String(topicId)
    //         ] = {
    //           topicId: Number(topicId),
    //           topicName: `Topic ${topicId}`,
    //           encryptedPath,
    //           downloadedAt: new Date().toISOString(),
    //         };

    //         processedTopics.push({
    //           topicId: Number(topicId),
    //           chapterId: Number(chapterId),
    //         });
    //       }
    //     }

    //     // --------------------------------------------------
    //     // 6. Save manifest
    //     // --------------------------------------------------

    //     writeManifest(
    //       manifest
    //     );

    //     // --------------------------------------------------
    //     // 7. Delete temporary files
    //     // --------------------------------------------------

    //     fs.rmSync(
    //       testDir,
    //       {
    //         recursive: true,
    //         force: true,
    //       }
    //     );

    //     console.log("");
    //     console.log("=================================");
    //     console.log("BULK SUBJECT DOWNLOAD COMPLETE");
    //     console.log("=================================");

    //     console.log(
    //       `Chapters: ${chapterEntries.length}`
    //     );

    //     console.log(
    //       `Topics processed: ${processedTopics.length}`
    //     );

    //     return {
    //       success: true,

    //       chapters:
    //         chapterEntries.length,

    //       topics:
    //         processedTopics.length,

    //       processedTopics,
    //     };

    //   } catch (err) {
    //     console.error(
    //       "❌ Bulk subject download failed:",
    //       err
    //     );

    //     return {
    //       success: false,
    //       error: err.message,
    //     };
    //   }
    // });



//     ipcMain.handle(
//   "download-subject-test",
//   async (_, { buffer, meta }) => {
//     try {
//       console.log("=================================");
//       console.log("PORTABLE BULK SUBJECT DOWNLOAD");
//       console.log("=================================");

//       const subjectId = String(meta?.subjectId);

//       if (!subjectId || subjectId === "undefined") {
//         throw new Error("Subject ID is required.");
//       }

//       if (!buffer) {
//         throw new Error("Subject ZIP data is required.");
//       }

//       // --------------------------------------------------
//       // 1. Get active portable library
//       // --------------------------------------------------

//       const {
//         libraryRoot,
//         library,
//         key,
//       } = getActivePortableLibrary();

//       console.log(
//         "📁 Portable library:",
//         libraryRoot
//       );

//       // --------------------------------------------------
//       // 2. Temporary extraction directory
//       // --------------------------------------------------

//       const testDir = path.join(
//         app.getPath("temp"),
//         "knowe-lms-subject-test"
//       );

//       if (fs.existsSync(testDir)) {
//         fs.rmSync(testDir, {
//           recursive: true,
//           force: true,
//         });
//       }

//       fs.mkdirSync(testDir, {
//         recursive: true,
//       });

//       // --------------------------------------------------
//       // 3. Save subject ZIP temporarily
//       // --------------------------------------------------

//       const subjectZipPath = path.join(
//         testDir,
//         "subject.zip"
//       );

//       fs.writeFileSync(
//         subjectZipPath,
//         Buffer.from(buffer)
//       );

//       console.log(
//         "Subject ZIP saved temporarily:",
//         subjectZipPath
//       );

//       // --------------------------------------------------
//       // 4. Extract subject ZIP
//       // --------------------------------------------------

//       const subjectExtractPath = path.join(
//         testDir,
//         "subject"
//       );

//       fs.mkdirSync(subjectExtractPath, {
//         recursive: true,
//       });

//       const subjectZip = new AdmZip(
//         subjectZipPath
//       );

//       subjectZip.extractAllTo(
//         subjectExtractPath,
//         true
//       );

//       console.log(
//         "Subject ZIP extracted."
//       );

//       // --------------------------------------------------
//       // 5. Find chapters
//       // --------------------------------------------------

//       const rootEntries = fs.readdirSync(
//         subjectExtractPath,
//         { withFileTypes: true }
//       );

//       const chapterEntries = rootEntries.filter(
//         (entry) =>
//           entry.isDirectory() &&
//           entry.name.startsWith("Chapter_")
//       );

//       console.log(
//         `Found ${chapterEntries.length} chapters.`
//       );

//       const processedTopics = [];

//       // --------------------------------------------------
//       // 6. Process every chapter
//       // --------------------------------------------------

//       for (const chapterEntry of chapterEntries) {
//         const chapterId =
//           chapterEntry.name.replace(
//             "Chapter_",
//             ""
//           );

//         const chapterPath = path.join(
//           subjectExtractPath,
//           chapterEntry.name
//         );

//         console.log("");
//         console.log(
//           `📖 Processing Chapter ${chapterId}`
//         );

//         const topicEntries = fs.readdirSync(
//           chapterPath,
//           { withFileTypes: true }
//         );

//         const topics = topicEntries.filter(
//           (entry) =>
//             entry.isDirectory() &&
//             entry.name.startsWith("Topic_")
//         );

//         console.log(
//           `   Found ${topics.length} topics`
//         );

//         // ------------------------------------------------
//         // 7. Process every topic
//         // ------------------------------------------------

//         for (const topicEntry of topics) {
//           const topicId =
//             topicEntry.name.replace(
//               "Topic_",
//               ""
//             );

//           const topicPath = path.join(
//             chapterPath,
//             topicEntry.name
//           );

//           console.log(
//             `   ▶ Processing Topic ${topicId}`
//           );

//           // ----------------------------------------------
//           // Create topic ZIP in memory
//           // ----------------------------------------------

//           const topicZip = new AdmZip();

//           topicZip.addLocalFolder(
//             topicPath
//           );

//           const topicZipBuffer =
//             topicZip.toBuffer();

//           console.log(
//             `      ZIP size: ${(
//               topicZipBuffer.length /
//               1024 /
//               1024
//             ).toFixed(2)} MB`
//           );

//           // ----------------------------------------------
//           // Encrypt using portable library key
//           // ----------------------------------------------

//           const encryptedBuffer =
//             encryptBuffer(
//               topicZipBuffer,
//               key
//             );

//           // ----------------------------------------------
//           // Portable permanent location
//           // ----------------------------------------------

//           const topicDownloadDir = path.join(
//             libraryRoot,
//             "content",
//             String(topicId)
//           );

//           fs.mkdirSync(
//             topicDownloadDir,
//             {
//               recursive: true,
//             }
//           );

//           const encryptedPath = path.join(
//             topicDownloadDir,
//             "content.enc"
//           );

//           // ----------------------------------------------
//           // Save encrypted content
//           // ----------------------------------------------

//           fs.writeFileSync(
//             encryptedPath,
//             encryptedBuffer
//           );

//           console.log(
//             `      ✅ Encrypted: ${encryptedPath}`
//           );

//           // ----------------------------------------------
//           // Store RELATIVE path in library.json
//           // ----------------------------------------------

//           const relativePath =
//             getRelativeLibraryPath(
//               libraryRoot,
//               encryptedPath
//             );

//           if (!library.content) {
//             library.content = {};
//           }

//           // ----------------------------------------------
//           // Add / update portable content entry
//           // ----------------------------------------------

//           library.content[String(topicId)] = {
//             topicId: Number(topicId),
//             topicName: `Topic ${topicId}`,

//             chapterId: Number(chapterId),
//             chapterName: `Chapter ${chapterId}`,

//             subjectId:
//               meta?.subjectId ?? null,

//             subjectName:
//               meta?.subjectName ??
//               `Subject ${subjectId}`,

//             classId:
//               meta?.classId ?? null,

//             className:
//               meta?.className ?? null,

//             boardId:
//               meta?.boardId ?? null,

//             boardName:
//               meta?.boardName ?? null,

//             encryptedPath:
//               relativePath,

//             downloadedAt:
//               new Date().toISOString(),
//           };

//           processedTopics.push({
//             topicId: Number(topicId),
//             chapterId: Number(chapterId),
//           });
//         }
//       }

//       // --------------------------------------------------
//       // 8. Save portable library.json
//       // --------------------------------------------------

//       writePortableLibrary(
//         libraryRoot,
//         library
//       );

//       console.log(
//         "✅ Portable library.json updated."
//       );

//       // --------------------------------------------------
//       // 9. Delete temporary files
//       // --------------------------------------------------

//       fs.rmSync(
//         testDir,
//         {
//           recursive: true,
//           force: true,
//         }
//       );

//       console.log("");
//       console.log("=================================");
//       console.log(
//         "PORTABLE BULK SUBJECT DOWNLOAD COMPLETE"
//       );
//       console.log("=================================");

//       console.log(
//         `Chapters: ${chapterEntries.length}`
//       );

//       console.log(
//         `Topics processed: ${processedTopics.length}`
//       );

//       return {
//         success: true,

//         chapters:
//           chapterEntries.length,

//         topics:
//           processedTopics.length,

//         processedTopics,
//       };
//     } catch (err) {
//       console.error(
//         "❌ Portable bulk subject download failed:",
//         err
//       );

//       return {
//         success: false,
//         error: err.message,
//       };
//     }
//   }
// );


ipcMain.handle("delete-download", (_, topicId) => {
  try {
    const id = String(topicId);

    if (!id || id === "undefined") {
      throw new Error("Topic ID is required.");
    }

    const libraryRoot = getActiveLibraryRoot();

    if (!libraryRoot) {
      throw new Error("No portable library selected.");
    }

    if (!fs.existsSync(libraryRoot)) {
      throw new Error("Portable library folder does not exist.");
    }

    const library = readPortableLibrary(libraryRoot);

    // ==================================================
    // 1. DELETE PHYSICAL CONTENT FILE
    // ==================================================

    const entry = library.content?.[id];

    if (entry?.encryptedPath) {
      const encryptedPath = resolveLibraryPath(
        libraryRoot,
        entry.encryptedPath
      );

      const topicDir = path.dirname(encryptedPath);

      if (fs.existsSync(topicDir)) {
        fs.rmSync(topicDir, {
          recursive: true,
          force: true,
        });
      }
    }

    // ==================================================
    // 2. REMOVE FROM CANONICAL CONTENT INDEX
    // ==================================================

    if (library.content) {
      delete library.content[id];
    }

    // ==================================================
    // 3. REMOVE FROM SUBJECT GROUPING
    // ==================================================

    for (const [subjectId, subject] of Object.entries(
      library.subjects || {}
    )) {
      for (const [chapterId, chapter] of Object.entries(
        subject.chapters || {}
      )) {
        if (chapter.topics?.[id]) {
          delete chapter.topics[id];
        }

        // Remove empty chapter
        if (
          !chapter.topics ||
          Object.keys(chapter.topics).length === 0
        ) {
          delete subject.chapters[chapterId];
        }
      }

      // Remove empty subject
      if (
        !subject.chapters ||
        Object.keys(subject.chapters).length === 0
      ) {
        delete library.subjects[subjectId];
      }
    }

    // ==================================================
    // 4. SAVE UPDATED LIBRARY
    // ==================================================

    writePortableLibrary(
      libraryRoot,
      library
    );

    console.log(
      `🗑️ Portable content deleted: Topic ${id}`
    );

    return {
      success: true,
      topicId: Number(id),
    };
  } catch (error) {
    console.error(
      "❌ Portable content deletion failed:",
      error
    );

    return {
      success: false,
      error: error.message,
    };
  }
});

ipcMain.handle(
  "download-subject-test",
  async (_, { buffer, meta }) => {
    try {
      console.log("=================================");
      console.log("PORTABLE BULK SUBJECT DOWNLOAD");
      console.log("=================================");

      const subjectId = String(meta?.subjectId);

      if (!subjectId || subjectId === "undefined") {
        throw new Error("Subject ID is required.");
      }

      if (!buffer) {
        throw new Error("Subject ZIP data is required.");
      }

      // --------------------------------------------------
      // 1. Get active portable library
      // --------------------------------------------------

      const {
        libraryRoot,
        library,
        key,
      } = getActivePortableLibrary();

      console.log(
        "📁 Portable library:",
        libraryRoot
      );

      // Make sure required sections exist
      if (!library.content) {
        library.content = {};
      }

      if (!library.subjects) {
        library.subjects = {};
      }

      // --------------------------------------------------
      // 2. Create / update subject metadata
      // --------------------------------------------------

      if (!library.subjects[subjectId]) {
        library.subjects[subjectId] = {
          subjectId: Number(subjectId),
          subjectName:
            meta?.subjectName ??
            `Subject ${subjectId}`,

          classId:
            meta?.classId ?? null,

          className:
            meta?.className ?? null,

          boardId:
            meta?.boardId ?? null,

          boardName:
            meta?.boardName ?? null,

          chapters: {},
        };
      } else {
        // Update latest metadata
        library.subjects[subjectId].subjectName =
          meta?.subjectName ??
          library.subjects[subjectId].subjectName;

        library.subjects[subjectId].classId =
          meta?.classId ??
          library.subjects[subjectId].classId;

        library.subjects[subjectId].className =
          meta?.className ??
          library.subjects[subjectId].className;

        library.subjects[subjectId].boardId =
          meta?.boardId ??
          library.subjects[subjectId].boardId;

        library.subjects[subjectId].boardName =
          meta?.boardName ??
          library.subjects[subjectId].boardName;
      }

      const subjectEntry =
        library.subjects[subjectId];

      // --------------------------------------------------
      // 3. Temporary extraction directory
      // --------------------------------------------------

      const testDir = path.join(
        app.getPath("temp"),
        "knowe-lms-subject-test"
      );

      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, {
          recursive: true,
          force: true,
        });
      }

      fs.mkdirSync(testDir, {
        recursive: true,
      });

      try {
        // --------------------------------------------------
        // 4. Save subject ZIP temporarily
        // --------------------------------------------------

        const subjectZipPath = path.join(
          testDir,
          "subject.zip"
        );

        fs.writeFileSync(
          subjectZipPath,
          Buffer.from(buffer)
        );

        console.log(
          "Subject ZIP saved temporarily:",
          subjectZipPath
        );

        // --------------------------------------------------
        // 5. Extract subject ZIP
        // --------------------------------------------------

        const subjectExtractPath = path.join(
          testDir,
          "subject"
        );

        fs.mkdirSync(subjectExtractPath, {
          recursive: true,
        });

        const subjectZip = new AdmZip(
          subjectZipPath
        );

        subjectZip.extractAllTo(
          subjectExtractPath,
          true
        );

        console.log(
          "Subject ZIP extracted."
        );

        // --------------------------------------------------
        // 6. Find chapters
        // --------------------------------------------------

        const rootEntries = fs.readdirSync(
          subjectExtractPath,
          { withFileTypes: true }
        );

        const chapterEntries = rootEntries.filter(
          (entry) =>
            entry.isDirectory() &&
            entry.name.startsWith("Chapter_")
        );

        console.log(
          `Found ${chapterEntries.length} chapters.`
        );

        const processedTopics = [];

        // --------------------------------------------------
        // 7. Process every chapter
        // --------------------------------------------------

        for (const chapterEntry of chapterEntries) {
          const chapterId =
            chapterEntry.name.replace(
              "Chapter_",
              ""
            );

          const chapterPath = path.join(
            subjectExtractPath,
            chapterEntry.name
          );

          console.log("");
          console.log(
            `📖 Processing Chapter ${chapterId}`
          );

          const topicEntries = fs.readdirSync(
            chapterPath,
            { withFileTypes: true }
          );

          const topics = topicEntries.filter(
            (entry) =>
              entry.isDirectory() &&
              entry.name.startsWith("Topic_")
          );

          console.log(
            `   Found ${topics.length} topics`
          );

          // ------------------------------------------------
          // Create / update chapter metadata
          // ------------------------------------------------

          const chapterMeta =
            (meta?.chapters || []).find(
              (chapter) =>
                String(chapter.chapterId) ===
                String(chapterId)
            );

          if (!subjectEntry.chapters) {
            subjectEntry.chapters = {};
          }

          if (!subjectEntry.chapters[chapterId]) {
            subjectEntry.chapters[chapterId] = {
              chapterId: Number(chapterId),

              chapterName:
                chapterMeta?.chapterName ??
                `Chapter ${chapterId}`,

              chapterDescription:
                chapterMeta?.chapterDescription ??
                "",

              topics: {},
            };
          } else {
            subjectEntry.chapters[chapterId].chapterName =
              chapterMeta?.chapterName ??
              subjectEntry.chapters[chapterId].chapterName;

            subjectEntry.chapters[chapterId].chapterDescription =
              chapterMeta?.chapterDescription ??
              subjectEntry.chapters[chapterId].chapterDescription;
          }

          const chapterEntryMeta =
            subjectEntry.chapters[chapterId];

          // ------------------------------------------------
          // 8. Process every topic
          // ------------------------------------------------

          for (const topicEntry of topics) {
            const topicId =
              topicEntry.name.replace(
                "Topic_",
                ""
              );

            const topicPath = path.join(
              chapterPath,
              topicEntry.name
            );

            console.log(
              `   ▶ Processing Topic ${topicId}`
            );

            // ----------------------------------------------
            // Find real topic metadata
            // ----------------------------------------------

            const topicMeta =
              (chapterMeta?.topics || []).find(
                (topic) =>
                  String(topic.topicId) ===
                  String(topicId)
              );

            // ----------------------------------------------
            // Create topic ZIP in memory
            // ----------------------------------------------

            const topicZip = new AdmZip();

            topicZip.addLocalFolder(
              topicPath
            );

            const topicZipBuffer =
              topicZip.toBuffer();

            console.log(
              `      ZIP size: ${(
                topicZipBuffer.length /
                1024 /
                1024
              ).toFixed(2)} MB`
            );

            // ----------------------------------------------
            // Encrypt using portable library key
            // ----------------------------------------------

            const encryptedBuffer =
              encryptBuffer(
                topicZipBuffer,
                key
              );

            // ----------------------------------------------
            // Permanent portable location
            // ----------------------------------------------

            const topicDownloadDir =
              path.join(
                libraryRoot,
                "content",
                String(topicId)
              );

            fs.mkdirSync(
              topicDownloadDir,
              {
                recursive: true,
              }
            );

            const encryptedPath =
              path.join(
                topicDownloadDir,
                "content.enc"
              );

            // ----------------------------------------------
            // Save encrypted content
            // ----------------------------------------------

            fs.writeFileSync(
              encryptedPath,
              encryptedBuffer
            );

            console.log(
              `      ✅ Encrypted: ${encryptedPath}`
            );

            // ----------------------------------------------
            // Store RELATIVE path
            // ----------------------------------------------

            const relativePath =
              getRelativeLibraryPath(
                libraryRoot,
                encryptedPath
              );

            const downloadedAt =
              new Date().toISOString();

            // ----------------------------------------------
            // Canonical content entry
            // ----------------------------------------------

            library.content[String(topicId)] = {
              topicId: Number(topicId),

              topicName:
                topicMeta?.topicName ??
                `Topic ${topicId}`,

              topicDescription:
                topicMeta?.topicDescription ??
                "",

              chapterId:
                Number(chapterId),

              chapterName:
                chapterMeta?.chapterName ??
                `Chapter ${chapterId}`,

              subjectId:
                Number(subjectId),

              subjectName:
                meta?.subjectName ??
                `Subject ${subjectId}`,

              classId:
                meta?.classId ?? null,

              className:
                meta?.className ?? null,

              boardId:
                meta?.boardId ?? null,

              boardName:
                meta?.boardName ?? null,

              source: "subject",

              encryptedPath:
                relativePath,

              downloadedAt,
            };

            // ----------------------------------------------
            // Subject → Chapter → Topic hierarchy
            // ----------------------------------------------

            chapterEntryMeta.topics[
              String(topicId)
            ] = {
              topicId: Number(topicId),

              topicName:
                topicMeta?.topicName ??
                `Topic ${topicId}`,

              topicDescription:
                topicMeta?.topicDescription ??
                "",

              encryptedPath:
                relativePath,

              downloadedAt,
            };

            processedTopics.push({
              topicId: Number(topicId),
              chapterId: Number(chapterId),
            });
          }
        }

        // --------------------------------------------------
        // 9. Save portable library.json
        // --------------------------------------------------

        writePortableLibrary(
          libraryRoot,
          library
        );

        console.log(
          "✅ Portable library.json updated."
        );

        console.log("");
        console.log("=================================");
        console.log(
          "PORTABLE BULK SUBJECT DOWNLOAD COMPLETE"
        );
        console.log("=================================");

        console.log(
          `Chapters: ${chapterEntries.length}`
        );

        console.log(
          `Topics processed: ${processedTopics.length}`
        );

        return {
          success: true,

          chapters:
            chapterEntries.length,

          topics:
            processedTopics.length,

          processedTopics,
        };
      } finally {
        // --------------------------------------------------
        // 10. Always delete temporary files
        // --------------------------------------------------

        if (fs.existsSync(testDir)) {
          fs.rmSync(
            testDir,
            {
              recursive: true,
              force: true,
            }
          );
        }
      }
    } catch (err) {
      console.error(
        "❌ Portable bulk subject download failed:",
        err
      );

      return {
        success: false,
        error: err.message,
      };
    }
  }
);

  ipcMain.handle("is-content-downloaded", (_, topicId) => {
  try {
    const id = String(topicId);

    if (!id || id === "undefined") {
      return false;
    }

    const libraryRoot = getActiveLibraryRoot();

    if (!libraryRoot) {
      return false;
    }

    if (!fs.existsSync(libraryRoot)) {
      return false;
    }

    const library = readPortableLibrary(libraryRoot);

    const entry = library.content?.[id];

    if (!entry?.encryptedPath) {
      return false;
    }

    const encryptedPath = resolveLibraryPath(
      libraryRoot,
      entry.encryptedPath
    );

    const exists = fs.existsSync(encryptedPath);

    console.log(
      `Portable download status for topic ${id}: ${exists}`
    );

    return exists;

  } catch (error) {
    console.error(
      "❌ Error checking portable download status:",
      error
    );

    return false;
  }
});

  // ipcMain.handle("is-subject-downloaded", (_, subjectId) => {
  //   try {
  //     const manifest = readManifest();
  //     const id = String(subjectId);

  //     const subject = manifest.subjects?.[id];

  //     if (!subject) {
  //       return false;
  //     }

  //     // Make sure the subject actually has
  //     // downloaded content inside it.
  //     for (const chapter of Object.values(
  //       subject.chapters || {}
  //     )) {
  //       for (const topic of Object.values(
  //         chapter.topics || {}
  //       )) {
  //         if (
  //           topic.encryptedPath &&
  //           fs.existsSync(topic.encryptedPath)
  //         ) {
  //           return true;
  //         }
  //       }
  //     }

  //     return false;
  //   } catch (error) {
  //     console.error(
  //       "Error checking subject download status:",
  //       error
  //     );

  //     return false;
  //   }
  // });


  ipcMain.handle(
  "is-subject-downloaded",
  (_, subjectId) => {
    try {
      const id = String(subjectId);

      if (!id || id === "undefined") {
        return false;
      }

      const libraryRoot =
        getActiveLibraryRoot();

      if (!libraryRoot) {
        return false;
      }

      if (!fs.existsSync(libraryRoot)) {
        return false;
      }

      const library =
        readPortableLibrary(
          libraryRoot
        );

      const subject =
        library.subjects?.[id];

      if (!subject) {
        return false;
      }

      // --------------------------------------------------
      // Check whether at least one topic actually exists
      // --------------------------------------------------

      for (const chapter of Object.values(
        subject.chapters || {}
      )) {
        for (const topic of Object.values(
          chapter.topics || {}
        )) {
          if (!topic?.encryptedPath) {
            continue;
          }

          try {
            const encryptedPath =
              resolveLibraryPath(
                libraryRoot,
                topic.encryptedPath
              );

            if (
              fs.existsSync(
                encryptedPath
              )
            ) {
              return true;
            }
          } catch (error) {
            console.error(
              "Invalid subject topic path:",
              error
            );
          }
        }
      }

      return false;
    } catch (error) {
      console.error(
        "Error checking portable subject download status:",
        error
      );

      return false;
    }
  }
);

  ipcMain.handle(
  "is-chapter-downloaded",
  (_, chapterId) => {
    try {
      const id = String(chapterId);

      if (!id || id === "undefined") {
        return false;
      }

      const libraryRoot =
        getActiveLibraryRoot();

      if (!libraryRoot) {
        return false;
      }

      if (!fs.existsSync(libraryRoot)) {
        return false;
      }

      const library =
        readPortableLibrary(
          libraryRoot
        );

      // --------------------------------------------------
      // Search chapter inside all downloaded subjects
      // --------------------------------------------------

      for (const subject of Object.values(
        library.subjects || {}
      )) {
        const chapter =
          subject.chapters?.[id];

        if (!chapter) {
          continue;
        }

        // ------------------------------------------------
        // Check whether at least one topic actually exists
        // ------------------------------------------------

        for (const topic of Object.values(
          chapter.topics || {}
        )) {
          if (!topic?.encryptedPath) {
            continue;
          }

          try {
            const encryptedPath =
              resolveLibraryPath(
                libraryRoot,
                topic.encryptedPath
              );

            if (
              fs.existsSync(
                encryptedPath
              )
            ) {
              return true;
            }
          } catch (error) {
            console.error(
              "Invalid chapter topic path:",
              error
            );
          }
        }
      }

      return false;
    } catch (error) {
      console.error(
        "Error checking portable chapter download status:",
        error
      );

      return false;
    }
  }
);


  // ipcMain.handle(
  //   "download-assessment",
  //   async (_, { assessment, meta }) => {
  //     try {
  //       console.log("=================================");
  //       console.log("ASSESSMENT DOWNLOAD");
  //       console.log("=================================");

  //       const topicId = String(meta?.topicId);

  //       if (!topicId || topicId === "undefined") {
  //         throw new Error("Topic ID is required.");
  //       }

  //       if (!assessment) {
  //         throw new Error("Assessment data is required.");
  //       }

  //       // -----------------------------------------
  //       // Create assessment directory
  //       // -----------------------------------------

  //       const topicAssessmentDir = path.join(
  //         assessmentsDir,
  //         topicId
  //       );

  //       fs.mkdirSync(topicAssessmentDir, {
  //         recursive: true,
  //       });

  //       // -----------------------------------------
  //       // Convert assessment to JSON
  //       // -----------------------------------------

  //       const assessmentJson = JSON.stringify(
  //         assessment
  //       );

  //       const assessmentBuffer = Buffer.from(
  //         assessmentJson,
  //         "utf-8"
  //       );

  //       console.log(
  //         `Assessment size: ${(
  //           assessmentBuffer.length /
  //           1024
  //         ).toFixed(2)} KB`
  //       );

  //       // -----------------------------------------
  //       // Encrypt assessment
  //       // -----------------------------------------

  //       const key = getEncryptionKey();

  //       const encryptedBuffer = encryptBuffer(
  //         assessmentBuffer,
  //         key
  //       );

  //       // -----------------------------------------
  //       // Permanent location
  //       // -----------------------------------------

  //       const encryptedPath = path.join(
  //         topicAssessmentDir,
  //         "assessment.enc"
  //       );

  //       fs.writeFileSync(
  //         encryptedPath,
  //         encryptedBuffer
  //       );

  //       console.log(
  //         "✅ Assessment encrypted:",
  //         encryptedPath
  //       );

  //       // -----------------------------------------
  //       // Update manifest
  //       // -----------------------------------------

  //       const manifest = readManifest();

  //       if (!manifest.assessments) {
  //         manifest.assessments = {};
  //       }

  //       manifest.assessments[topicId] = {
  //         topicId: Number(topicId),
  //         topicName:
  //           meta?.topicName ??
  //           `Topic ${topicId}`,

  //         classId:
  //           meta?.classId ?? null,

  //         subjectId:
  //           meta?.subjectId ?? null,

  //         chapterId:
  //           meta?.chapterId ?? null,

  //         encryptedPath,

  //         downloadedAt:
  //           new Date().toISOString(),
  //       };

  //       writeManifest(manifest);

  //       console.log(
  //         "✅ Assessment download complete."
  //       );

  //       return {
  //         success: true,
  //         topicId: Number(topicId),
  //         downloadedAt:
  //           manifest.assessments[topicId]
  //             .downloadedAt,
  //       };
  //     } catch (err) {
  //       console.error(
  //         "❌ Assessment download failed:",
  //         err
  //       );

  //       return {
  //         success: false,
  //         error: err.message,
  //       };
  //     }
  //   }
  // );


  ipcMain.handle(
  "download-assessment",
  async (_, { assessment, meta }) => {
    try {
      console.log("=================================");
      console.log("PORTABLE ASSESSMENT DOWNLOAD");
      console.log("=================================");

      const topicId = String(meta?.topicId);

      if (!topicId || topicId === "undefined") {
        throw new Error("Topic ID is required.");
      }

      if (!assessment) {
        throw new Error("Assessment data is required.");
      }

      // -----------------------------------------
      // Get active portable library
      // -----------------------------------------

      const {
        libraryRoot,
        library,
        key,
      } = getActivePortableLibrary();

      console.log(
        "Portable library:",
        libraryRoot
      );

      // -----------------------------------------
      // Create assessment directory
      // -----------------------------------------

      const topicAssessmentDir = path.join(
        libraryRoot,
        "assessments",
        topicId
      );

      // Remove previous assessment for this topic
      if (fs.existsSync(topicAssessmentDir)) {
        fs.rmSync(topicAssessmentDir, {
          recursive: true,
          force: true,
        });
      }

      fs.mkdirSync(topicAssessmentDir, {
        recursive: true,
      });

      // -----------------------------------------
      // Convert assessment to JSON
      // -----------------------------------------

      const assessmentJson = JSON.stringify(
        assessment
      );

      const assessmentBuffer = Buffer.from(
        assessmentJson,
        "utf-8"
      );

      console.log(
        `Assessment size: ${(
          assessmentBuffer.length / 1024
        ).toFixed(2)} KB`
      );

      // -----------------------------------------
      // Encrypt assessment
      // -----------------------------------------

      const encryptedBuffer = encryptBuffer(
        assessmentBuffer,
        key
      );

      // -----------------------------------------
      // Portable permanent location
      // -----------------------------------------

      const encryptedPath = path.join(
        topicAssessmentDir,
        "assessment.enc"
      );

      fs.writeFileSync(
        encryptedPath,
        encryptedBuffer
      );

      console.log(
        "✅ Portable assessment encrypted:",
        encryptedPath
      );

      // -----------------------------------------
      // Store relative path
      // -----------------------------------------

      const relativePath =
        getRelativeLibraryPath(
          libraryRoot,
          encryptedPath
        );

      console.log(
        "Portable relative path:",
        relativePath
      );

      // -----------------------------------------
      // Update portable library metadata
      // -----------------------------------------

      if (!library.assessments) {
        library.assessments = {};
      }

      const downloadedAt =
        new Date().toISOString();

      library.assessments[topicId] = {
        topicId: Number(topicId),

        topicName:
          meta?.topicName ??
          `Topic ${topicId}`,

        classId:
          meta?.classId ?? null,

        className:
          meta?.className ?? null,

        subjectId:
          meta?.subjectId ?? null,

        subjectName:
          meta?.subjectName ?? null,

        chapterId:
          meta?.chapterId ?? null,

        chapterName:
          meta?.chapterName ?? null,

        boardId:
          meta?.boardId ?? null,

        boardName:
          meta?.boardName ?? null,

        encryptedPath:
          relativePath,

        downloadedAt,
      };

      writePortableLibrary(
        libraryRoot,
        library
      );

      console.log(
        "✅ Portable library metadata updated:",
        path.join(
          libraryRoot,
          "library.json"
        )
      );

      console.log(
        "✅ Assessment download complete."
      );

      return {
        success: true,

        topicId: Number(topicId),

        downloadedAt,
      };
    } catch (err) {
      console.error(
        "❌ Portable assessment download failed:",
        err
      );

      return {
        success: false,
        error: err.message,
      };
    }
  }
);

  // ipcMain.handle(
  //   "is-assessment-downloaded",
  //   (_, topicId) => {
  //     try {
  //       const manifest = readManifest();

  //       const id = String(topicId);

  //       const assessment =
  //         manifest.assessments?.[id];

  //       if (
  //         !assessment?.encryptedPath
  //       ) {
  //         return false;
  //       }

  //       return fs.existsSync(
  //         assessment.encryptedPath
  //       );
  //     } catch (error) {
  //       console.error(
  //         "Error checking assessment download status:",
  //         error
  //       );

  //       return false;
  //     }
  //   }
  // );

  ipcMain.handle(
  "is-assessment-downloaded",
  (_, topicId) => {
    try {
      const id = String(topicId);

      if (!id || id === "undefined") {
        return false;
      }

      const libraryRoot = getActiveLibraryRoot();

      if (!libraryRoot) {
        return false;
      }

      if (!fs.existsSync(libraryRoot)) {
        return false;
      }

      const library = readPortableLibrary(libraryRoot);

      const assessment =
        library.assessments?.[id];

      if (!assessment?.encryptedPath) {
        return false;
      }

      const encryptedPath =
        resolveLibraryPath(
          libraryRoot,
          assessment.encryptedPath
        );

      const exists =
        fs.existsSync(encryptedPath);

      console.log(
        `Portable assessment status for topic ${id}: ${exists}`
      );

      return exists;
    } catch (error) {
      console.error(
        "❌ Error checking portable assessment download status:",
        error
      );

      return false;
    }
  }
);

  ipcMain.handle(
  "get-downloaded-assessment",
  (_, topicId) => {
    try {
      console.log("=================================");
      console.log("LOAD PORTABLE ASSESSMENT");
      console.log("=================================");

      const id = String(topicId);

      if (!id || id === "undefined") {
        throw new Error("Topic ID is required.");
      }

      // -----------------------------------------
      // Get active portable library
      // -----------------------------------------

      const {
        libraryRoot,
        library,
        key,
      } = getActivePortableLibrary();

      console.log(
        "Portable library:",
        libraryRoot
      );

      // -----------------------------------------
      // Get assessment metadata
      // -----------------------------------------

      const assessment =
        library.assessments?.[id];

      if (!assessment?.encryptedPath) {
        return {
          success: false,
          error: "Assessment is not downloaded.",
        };
      }

      // -----------------------------------------
      // Resolve portable relative path
      // -----------------------------------------

      const encryptedPath =
        resolveLibraryPath(
          libraryRoot,
          assessment.encryptedPath
        );

      if (!fs.existsSync(encryptedPath)) {
        return {
          success: false,
          error:
            "Downloaded assessment file not found.",
        };
      }

      console.log(
        "Portable assessment:",
        encryptedPath
      );

      // -----------------------------------------
      // Read encrypted assessment
      // -----------------------------------------

      const encryptedBuffer =
        fs.readFileSync(encryptedPath);

      // -----------------------------------------
      // Decrypt using portable library key
      // -----------------------------------------

      const decryptedBuffer =
        decryptBuffer(
          encryptedBuffer,
          key
        );

      // -----------------------------------------
      // Convert JSON → object
      // -----------------------------------------

      const assessmentData =
        JSON.parse(
          decryptedBuffer.toString("utf-8")
        );

      console.log(
        `✅ Portable offline assessment loaded: Topic ${id}`
      );

      // -----------------------------------------
      // Return assessment + metadata
      // -----------------------------------------

      return {
        success: true,

        assessment: assessmentData,

        meta: {
          topicId:
            assessment.topicId,

          topicName:
            assessment.topicName,

          boardId:
            assessment.boardId,

          boardName:
            assessment.boardName,

          classId:
            assessment.classId,

          className:
            assessment.className,

          subjectId:
            assessment.subjectId,

          subjectName:
            assessment.subjectName,

          chapterId:
            assessment.chapterId,

          chapterName:
            assessment.chapterName,

          downloadedAt:
            assessment.downloadedAt,
        },
      };
    } catch (err) {
      console.error(
        "❌ Failed to load portable offline assessment:",
        err
      );

      return {
        success: false,
        error: err.message,
      };
    }
  }
);

  // ipcMain.handle(
  //   "delete-downloaded-assessment",
  //   (_, topicId) => {
  //     try {
  //       const manifest = readManifest();

  //       const id = String(topicId);

  //       const assessment =
  //         manifest.assessments?.[id];

  //       if (
  //         assessment?.encryptedPath
  //       ) {
  //         const assessmentDir =
  //           path.dirname(
  //             assessment.encryptedPath
  //           );

  //         if (
  //           fs.existsSync(assessmentDir)
  //         ) {
  //           fs.rmSync(
  //             assessmentDir,
  //             {
  //               recursive: true,
  //               force: true,
  //             }
  //           );
  //         }
  //       }

  //       if (manifest.assessments) {
  //         delete manifest.assessments[id];
  //       }

  //       writeManifest(manifest);

  //       console.log(
  //         `🗑️ Assessment deleted: Topic ${topicId}`
  //       );

  //       return {
  //         success: true,
  //       };
  //     } catch (err) {
  //       console.error(
  //         "❌ Assessment deletion failed:",
  //         err
  //       );

  //       return {
  //         success: false,
  //         error: err.message,
  //       };
  //     }
  //   }
  // );

  ipcMain.handle(
  "delete-downloaded-assessment",
  (_, topicId) => {
    try {
      const id = String(topicId);

      if (!id || id === "undefined") {
        throw new Error("Topic ID is required.");
      }

      const libraryRoot = getActiveLibraryRoot();

      if (!libraryRoot) {
        throw new Error("No portable library selected.");
      }

      if (!fs.existsSync(libraryRoot)) {
        throw new Error(
          "Portable library folder does not exist."
        );
      }

      const library =
        readPortableLibrary(libraryRoot);

      // ==================================================
      // 1. GET ASSESSMENT ENTRY
      // ==================================================

      const assessment =
        library.assessments?.[id];

      // ==================================================
      // 2. DELETE PHYSICAL ASSESSMENT FILE
      // ==================================================

      if (assessment?.encryptedPath) {
        const encryptedPath =
          resolveLibraryPath(
            libraryRoot,
            assessment.encryptedPath
          );

        const assessmentDir =
          path.dirname(encryptedPath);

        if (fs.existsSync(assessmentDir)) {
          fs.rmSync(assessmentDir, {
            recursive: true,
            force: true,
          });
        }
      }

      // ==================================================
      // 3. REMOVE FROM LIBRARY INDEX
      // ==================================================

      if (library.assessments) {
        delete library.assessments[id];
      }

      // ==================================================
      // 4. SAVE UPDATED LIBRARY
      // ==================================================

      writePortableLibrary(
        libraryRoot,
        library
      );

      console.log(
        `🗑️ Portable assessment deleted: Topic ${id}`
      );

      return {
        success: true,
        topicId: Number(id),
      };
    } catch (error) {
      console.error(
        "❌ Portable assessment deletion failed:",
        error
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }
);


  ipcMain.handle(
  "get-active-library",
  () => {
    try {
      const libraryRoot =
        getActiveLibraryRoot();

      if (!libraryRoot) {
        return {
          success: true,
          libraryRoot: null,
        };
      }

      // Folder may have been disconnected/deleted
      if (!fs.existsSync(libraryRoot)) {
        return {
          success: true,
          libraryRoot: null,
        };
      }

      return {
        success: true,
        libraryRoot,
      };
    } catch (error) {
      console.error(
        "❌ Failed to get active library:",
        error
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }
);

ipcMain.handle(
  "set-active-library",
  (_, libraryRoot) => {
    try {
      const root =
        setActiveLibraryRoot(
          libraryRoot
        );

      // Make sure portable structure exists
      createPortableLibrary(root);

      return {
        success: true,
        libraryRoot: root,
      };
    } catch (error) {
      console.error(
        "❌ Failed to set active library:",
        error
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }
);


ipcMain.handle("select-library-folder", async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: [
        "openDirectory",
        "createDirectory",
      ],
      title: "Select Knowe Offline Library",
    });

    if (result.canceled || !result.filePaths.length) {
      return {
        success: true,
        canceled: true,
        libraryRoot: null,
      };
    }

    const selectedFolder = result.filePaths[0];

    const libraryRoot = setActiveLibraryRoot(
      selectedFolder
    );

    createPortableLibrary(libraryRoot);

    console.log(
      "✅ Portable library selected:",
      libraryRoot
    );

    return {
      success: true,
      canceled: false,
      libraryRoot,
    };

  } catch (error) {
    console.error(
      "❌ Failed to select portable library:",
      error
    );

    return {
      success: false,
      error: error.message,
    };
  }
});

  createWindow();

  // Optional: F12 -> Toggle DevTools
  globalShortcut.register("F12", () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      win.webContents.toggleDevTools();
    }
  });

  // Optional: Ctrl + Shift + I -> Toggle DevTools
  globalShortcut.register("CommandOrControl+Shift+I", () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      win.webContents.toggleDevTools();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();

  try {
    if (fs.existsSync(tempDownloadsDir)) {
      fs.rmSync(tempDownloadsDir, {
        recursive: true,
        force: true,
      });

      console.log(
        "🧹 Temporary decrypted content removed."
      );
    }
  } catch (err) {
    console.error(
      "❌ Failed to remove temporary content:",
      err
    );
  }
});