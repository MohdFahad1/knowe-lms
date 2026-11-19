import { useEffect, useState } from "react";
import { PlayCircle, FolderOpen, Sparkles, Trash2, ChevronRight, ArrowLeft } from "lucide-react";
import Header from "../../components/Header";

// Renders the board > class > subject > chapter breadcrumb above a topic name.
// Any missing piece (older downloads made before this metadata was captured)
// is simply skipped rather than showing a blank/undefined.
function Breadcrumb({ item, className = "" }) {
  const parts = [item.boardName, item.className, item.subjectName, item.chapterName].filter(
    Boolean
  );

  if (parts.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1 text-xs text-slate-400 ${className}`}>
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 text-slate-300" />}
          <span className="truncate max-w-[110px]">{part}</span>
        </span>
      ))}
    </div>
  );
}

export default function Downloads() {
  const [downloads, setDownloads] = useState({
    subjects: [],
    individual: [],
  });

  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);

  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  const [libraryRoot, setLibraryRoot] = useState(null);

  useEffect(() => {
    initializeDownloadsPage();
  }, []);

  const initializeDownloadsPage = async () => {
    try {
      const result = await window.electronAPI.getActiveLibrary();

      if (result?.success) {
        setLibraryRoot(result.libraryRoot || null);
      }

      await fetchDownloaded();
    } catch (error) {
      console.error("❌ Failed to initialize Downloads page:", error);
    }
  };

  const handleOpenSubject = (subject) => {
    setSelectedSubject(subject);
    setSelectedChapter(null);
  };

  // const fetchDownloaded = async () => {
  //   try {
  //     const list = await window.electronAPI.listDownloads();
  //     setDownloads(list);
  //   } catch (err) {
  //     console.log(err);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const fetchDownloaded = async () => {
    try {
      const data = await window.electronAPI.listDownloads();

      setDownloads({
        subjects: data?.subjects || [],
        individual: data?.individual || [],
      });
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLibrary = async () => {
    try {
      const result = await window.electronAPI.selectLibraryFolder();

      if (!result?.success) {
        alert(result?.error || "Unable to select library folder.");
        return;
      }

      if (result.canceled) {
        return;
      }

      setLibraryRoot(result.libraryRoot || null);

      // Close any currently opened content/subject view.
      setSelected(null);
      setSelectedSubject(null);
      setSelectedChapter(null);

      // Refresh downloads from the newly selected folder.
      setLoading(true);
      await fetchDownloaded();
    } catch (error) {
      console.error("❌ Failed to select library:", error);
      alert("Unable to select library folder.");
    }
  };

  const handleDelete = async (e, topicId) => {
    e.stopPropagation();
    await window.electronAPI.deleteDownload(String(topicId));
    if (selected?.topicId === topicId) setSelected(null);
    fetchDownloaded();
  };

  const handlePlay = async (item) => {
    try {
      const result = await window.electronAPI.playDownload(
        String(item.topicId)
      );

      if (!result.success) {
        alert(result.error || "Unable to play downloaded content.");
        return;
      }

      setSelected({
        ...item,
        entryUrl: result.entryUrl,
      });
    } catch (err) {
      console.error("Offline playback error:", err);
      alert("Unable to play downloaded content.");
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        Loading Downloads...
      </div>
    );
  }

  if (selected) {
    return (
      <div className="flex h-screen flex-col bg-[#F7F7FB]">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white p-4">
          <button
            onClick={() => setSelected(null)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
            style={{ padding: "0.5rem 1rem", fontSize: "0.875rem", margin: "1rem" }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex flex-col items-center">
            <h1 className="font-display text-lg font-bold text-slate-900">
              {selected.topicName}
            </h1>

            <Breadcrumb
              item={selected}
              className="mt-0.5 justify-center"
            />
          </div>

          <div className="w-20" />
        </div>

        <div className="flex-1 p-4">
          {selected.entryUrl ? (
            <iframe
              key={selected.entryUrl}
              title="offline-player"
              src={selected.entryUrl}
              className="h-full w-full rounded-2xl border-0 bg-white shadow-xl"
              allowFullScreen
              onLoad={() => {
                console.log(
                  "✅ OFFLINE IFRAME LOADED:",
                  selected.entryUrl
                );
              }}
              onError={(error) => {
                console.error(
                  "❌ OFFLINE IFRAME ERROR:",
                  error
                );
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-500">
              No playable file found.
            </div>
          )}
        </div>
      </div>
    );
  }

  if (selectedSubject) {
    const chapters = Object.values(
      selectedSubject.chapters || {}
    );

    return (
      <div className="min-h-screen w-full bg-[#F7F7FB] px-6 py-10 sm:px-10 lg:px-16">

        {/* <Header title={selectedSubject.subjectName} /> */}

        <Header title="Downloaded Content" />

        {/* Back button */}
        <button
          onClick={() => {
            if (selectedChapter) {
              setSelectedChapter(null);
            } else {
              setSelectedSubject(null);
            }
          }}
          className="mb-6 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 cursor-pointer"
          style={{ padding: "0.5rem 1rem", fontSize: "0.875remm", marginTop: "1.5rem", marginLeft: "1.5rem" }}
        >
          <ArrowLeft className="h-4 w-4" />

          {selectedChapter
            ? "Back to Chapters"
            : "Back to Downloads"}
        </button>

        {!selectedChapter ? (
          <div style={{ padding: "1.5rem" }}>
            <h2 className="mb-5 text-xl font-bold text-slate-900">
              Chapters
            </h2>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" style={{ marginTop: "1rem" }}>

              {chapters.map((chapter) => {
                const topics = Object.values(
                  chapter.topics || {}
                );

                return (
                  <div
                    key={chapter.chapterId}
                    onClick={() =>
                      setSelectedChapter(chapter)
                    }
                    className="group cursor-pointer rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-1 hover:shadow-lg"
                    style={{ padding: "1rem" }}
                  >

                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500">
                      <FolderOpen className="h-5 w-5 text-white" />
                    </div>

                    <h3 className="font-display text-lg font-bold text-slate-900">
                      {chapter.chapterName}
                    </h3>

                    <p className="mt-2 text-xs text-slate-500">
                      {topics.length}{" "}
                      {topics.length === 1
                        ? "Topic"
                        : "Topics"}
                    </p>

                    <div className="mt-4 flex items-center text-sm font-semibold text-violet-600">
                      Open Chapter
                      <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>

                  </div>
                );
              })}

            </div>
          </div>
        ) : (
          <div style={{ padding: "1.5rem" }}>
            <h2 className="mb-5 text-xl font-bold text-slate-900">
              {selectedChapter.chapterName}
            </h2>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" style={{ marginTop: "0.5rem" }}>

              {Object.values(
                selectedChapter.topics || {}
              ).map((topic) => (
                <div
                  key={topic.topicId}
                  onClick={() => handlePlay(topic)}
                  className="group relative flex cursor-pointer flex-col justify-between rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-1 hover:shadow-xl"
                  style={{
                    padding: "1.5rem",
                    borderRadius: "1rem",
                    boxShadow:
                      "0 1px 3px rgba(0, 0, 0, 0.1)",
                  }}
                >

                  <div>
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500">
                      <PlayCircle className="h-5 w-5 text-white" />
                    </div>

                    <h3 className="font-display text-lg font-bold text-slate-900">
                      {topic.topicName}
                    </h3>
                  </div>

                  <p className="mt-4 flex items-center gap-1 text-xs text-slate-500">
                    <Sparkles className="h-3.5 w-3.5" />
                    Available offline
                  </p>

                </div>
              ))}

            </div>
          </div>
        )}

      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#F7F7FB] px-6 py-10 sm:px-10 lg:px-16">
      <Header title="Downloaded Content" />

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0" style={{ padding: "1.5rem"}}>
            <p className="text-sm font-bold text-slate-900">
              Offline Library Location
            </p>

            <p
              className="mt-1 break-all text-xs text-slate-500"
              title={libraryRoot || "No location selected"}
            >
              {libraryRoot || "No location selected"}
            </p>
          </div>

          <button
            onClick={handleSelectLibrary}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 cursor-pointer"
            style={{ padding: "0.5rem 1rem", marginRight: "1rem" }}
          >
            <FolderOpen className="h-4 w-4" />

            {libraryRoot ? "Change Location" : "Select Location"}
          </button>
        </div>
      </div>

      {downloads.subjects.length === 0 &&
        downloads.individual.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center  px-6 py-20 text-center h-[60vh]">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-200">
            <FolderOpen className="h-6 w-6 text-violet-500" />
          </div>
          <p className="mb-1 font-display text-lg font-bold text-slate-900">
            Nothing downloaded yet
          </p>
          <p className="text-sm text-slate-500">
            Content you download will be playable offline here.
          </p>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-2 w-full gap-6  p-5" style={{ padding: "1.5rem" }}>
          {downloads.subjects.length > 0 && (
            <section>
              <h2 className="mb-4 px-1 text-sm font-bold uppercase tracking-wider text-slate-500">
                Downloaded Subjects
              </h2>

              <div className="grid grid-cols-1 gap-6 max-h-[70vh] overflow-y-auto">
                {downloads.subjects.map((subject) => {
                  const chapters = Object.values(
                    subject.chapters || {}
                  );

                  const topicCount = chapters.reduce(
                    (total, chapter) =>
                      total +
                      Object.keys(chapter.topics || {}).length,
                    0
                  );

                  return (
                    <div
                      key={subject.subjectId}
                      className="group relative flex flex-col justify-between rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-1 hover:shadow-xl"
                      style={{
                        padding: "1.5rem",
                        borderRadius: "1rem",
                        boxShadow:
                          "0 1px 3px rgba(0, 0, 0, 0.1)",
                      }}
                    >
                      <div>
                        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500">
                          <FolderOpen className="h-5 w-5 text-white" />
                        </div>

                        <h2 className="font-display text-lg font-bold text-slate-900">
                          {subject.subjectName}
                        </h2>

                        <p className="mt-2 text-xs text-slate-500">
                          {chapters.length}{" "}
                          {chapters.length === 1
                            ? "Chapter"
                            : "Chapters"}{" "}
                          • {topicCount}{" "}
                          {topicCount === 1
                            ? "Topic"
                            : "Topics"}
                        </p>
                      </div>

                      <button
                        className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 cursor-pointer"
                        style={{ padding: "0.5rem 1rem", fontSize: "0.875rem", marginTop: "0.5rem"}}
                        onClick={() => handleOpenSubject(subject)}
                      >
                        Open Subject
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}


          {downloads.individual.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-4 px-1 text-sm font-bold uppercase tracking-wider text-slate-500">
                Individual Downloads
              </h2>

              <div className="grid grid-cols-1 gap-6 max-h-[70vh] overflow-y-auto">
                {downloads.individual.map((item) => (
                  <div
                    key={item.topicId}
                    onClick={() => handlePlay(item)}
                    className="group relative flex cursor-pointer flex-col justify-between rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-1 hover:shadow-xl"
                    style={{
                      padding: "1.5rem",
                      borderRadius: "1rem",
                      boxShadow:
                        "0 1px 3px rgba(0, 0, 0, 0.1)",
                    }}
                  >
                    <button
                      onClick={(e) =>
                        handleDelete(e, item.topicId)
                      }
                      className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>

                    <div>
                      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500">
                        <PlayCircle className="h-5 w-5 text-white" />
                      </div>

                      <h2 className="font-display text-lg font-bold text-slate-900">
                        {item.topicName}
                      </h2>
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center justify-between gap-5">
                        <p className="flex items-center gap-1 text-xs text-slate-500">
                          <Sparkles className="h-3.5 w-3.5" />
                          Available offline
                        </p>

                        {item.downloadedAt && (
                          <p className="text-[11px] text-slate-400">
                            {new Date(
                              item.downloadedAt
                            ).toLocaleDateString()}
                          </p>
                        )}
                      </div>

                      <Breadcrumb
                        item={item}
                        className="mt-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>
      )}
    </div>
  );
}