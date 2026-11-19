const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  setCookie: (token) =>
    ipcRenderer.invoke("set-cookie", token),

  downloadExtract: (buffer, meta) =>
    ipcRenderer.invoke("download-extract", {
      buffer,
      meta,
    }),



  downloadSubjectTest: (buffer, meta) =>
    ipcRenderer.invoke(
      "download-subject-test",
      {
        buffer,
        meta,
      }
    ),

  listDownloads: () =>
    ipcRenderer.invoke("list-downloads"),

    getActiveLibrary: () =>
    ipcRenderer.invoke("get-active-library"),

  setActiveLibrary: (libraryRoot) =>
    ipcRenderer.invoke(
      "set-active-library",
      libraryRoot
    ),

  selectLibraryFolder: () =>
    ipcRenderer.invoke("select-library-folder"),

  deleteDownload: (topicId) =>
    ipcRenderer.invoke("delete-download", topicId),

  playDownload: (topicId) =>
    ipcRenderer.invoke("play-download", topicId),

  isContentDownloaded: (topicId) =>
    ipcRenderer.invoke("is-content-downloaded", topicId),

  isSubjectDownloaded: (subjectId) =>
    ipcRenderer.invoke(
      "is-subject-downloaded",
      subjectId
    ),

  isChapterDownloaded: (chapterId) =>
    ipcRenderer.invoke(
      "is-chapter-downloaded",
      chapterId
    ),


  downloadAssessment: (assessment, meta) =>
    ipcRenderer.invoke("download-assessment", {
      assessment,
      meta,
    }),

  getDownloadedAssessment: (topicId) =>
    ipcRenderer.invoke("get-downloaded-assessment", topicId),

  isAssessmentDownloaded: (topicId) =>
    ipcRenderer.invoke("is-assessment-downloaded", topicId),

  deleteDownloadedAssessment: (topicId) =>
    ipcRenderer.invoke("delete-downloaded-assessment", topicId),

});