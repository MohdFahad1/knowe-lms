import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { contentAPI } from "../../services/api";
import {
  ArrowLeft,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  PlayCircle,
  Sparkles,
  RefreshCw,
  Download,
} from "lucide-react";

const ACCENTS = [
  "from-violet-600 to-fuchsia-500",
  "from-sky-500 to-indigo-500",
  "from-amber-400 to-orange-500",
  "from-emerald-500 to-teal-500",
  "from-rose-500 to-pink-500",
];

function getContentIcon(item) {
  const type = `${item.lms_subject_topic_data_type || ""} ${item.lms_subject_topic_data_kind || ""
    }`.toLowerCase();

  if (type.includes("quiz") || type.includes("test")) return HelpCircle;
  if (type.includes("video") || type.includes("animation")) return PlayCircle;
  if (type.includes("image")) return ImageIcon;
  if (type.includes("pdf") || type.includes("doc")) return FileText;
  return Sparkles;
}

export default function Content() {
  const navigate = useNavigate();
  const { state } = useLocation();

  const {
    boardId,
    boardName,
    classId,
    className,
    subjectId,
    subjectName,
    chapterId,
    chapterName,
    topicId,
    topicName,
  } = state;

  const [contents, setContents] = useState([]);
  const [selectedContent, setSelectedContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [downloading, setDownloading] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);


  useEffect(() => {
    fetchContent();
  }, []);

  useEffect(() => {
    const checkDownloadStatus = async () => {
      try {
        const downloaded =
          await window.electronAPI.isContentDownloaded(
            topicId
          );

        setIsDownloaded(downloaded);

        console.log(
          "DOWNLOAD STATUS:",
          topicId,
          downloaded
        );
      } catch (error) {
        console.error(
          "Failed to check download status:",
          error
        );
      }
    };

    checkDownloadStatus();
  }, [topicId]);

  const fetchContent = async () => {
    setLoading(true);
    setErrorMsg("");

    try {
      const response = await contentAPI.getAll(
        classId,
        subjectId,
        chapterId,
        topicId
      );

      if (response.data.success) {
        const data = response.data.data || [];

        setContents(data);

        if (data.length > 0) {
          setSelectedContent(data[0]);
        }
      }
    } catch (err) {
      console.log(err);
      setErrorMsg("Failed to load content");
    } finally {
      setLoading(false);
    }
  };



  const handleDownload = async () => {
    if (downloading || isDownloaded) {
      return;
    }

    try {
      // ==========================================
      // STEP 1: ASK USER FOR DOWNLOAD LOCATION
      // ==========================================

      const folderResult =
        await window.electronAPI.selectLibraryFolder();

      if (!folderResult?.success) {
        alert(
          folderResult?.error ||
          "Unable to select download location."
        );
        return;
      }

      // User cancelled the folder picker
      if (folderResult.canceled) {
        return;
      }

      if (!folderResult.libraryRoot) {
        throw new Error(
          "No download location was selected."
        );
      }

      console.log(
        "📁 Content download location:",
        folderResult.libraryRoot
      );

      // ==========================================
      // STEP 2: START DOWNLOAD
      // ==========================================

      setDownloading(true);

      const response = await contentAPI.download(
        classId,
        subjectId,
        chapterId,
        topicId
      );

      // ==========================================
      // STEP 3: CONVERT RESPONSE TO ARRAYBUFFER
      // ==========================================

      const blob = new Blob([response.data]);

      const arrayBuffer =
        await blob.arrayBuffer();

      // ==========================================
      // STEP 4: SAVE INTO SELECTED LIBRARY
      // ==========================================

      const result =
        await window.electronAPI.downloadExtract(
          arrayBuffer,
          {
            topicId,
            topicName,
            chapterId,
            chapterName,
            subjectId,
            subjectName,
            classId,
            className,
            boardId,
            boardName,
          }
        );

      if (!result?.success) {
        throw new Error(
          result?.error ||
          "Content download failed."
        );
      }

      setIsDownloaded(true);

      alert(
        "Download completed. Available offline in Downloads."
      );
    } catch (error) {
      console.error(
        "❌ Content download failed:",
        error
      );

      alert(
        error?.message ||
        "Download failed."
      );
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-xl">
        Loading Content...
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#F7F7FB]">
      {/* Top bar */}
      <div className="flex flex-shrink-0 flex-col border-b border-slate-200">
        <div
          className="relative overflow-hidden bg-gradient-to-br from-violet-600 to-fuchsia-500 p-4"
          style={{ padding: "0.8rem" }}
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />

          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              style={{ paddingLeft: "1rem", paddingRight: "1rem", paddingTop: "0.5rem", paddingBottom: "0.5rem" }}
              className="group flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
              Back
            </button>

            <div className="flex items-center gap-2 ">
              <button
                onClick={() =>
                  navigate("/assessment", {
                    state: {
                      boardId,
                      boardName,
                      classId,
                      className,
                      subjectId,
                      subjectName,
                      chapterId,
                      chapterName,
                      topicId,
                      topicName,
                    },
                  })
                }
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
                style={{ paddingLeft: "1rem", paddingRight: "1rem", paddingTop: "0.5rem", paddingBottom: "0.5rem" }}
              >
                <HelpCircle className="h-4 w-4" />
                Assessment
              </button>

              <button
                onClick={handleDownload}
                disabled={downloading || isDownloaded}
                style={{
                  paddingLeft: "1rem",
                  paddingRight: "1rem",
                  paddingTop: "0.5rem",
                  paddingBottom: "0.5rem",
                }}
                className={`flex items-center gap-2 rounded-xl border border-white/25 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm transition ${isDownloaded
                  ? "cursor-default bg-white/20"
                  : "cursor-pointer bg-white/10 hover:bg-white/20"
                  }`}
              >
                {isDownloaded ? (
                  <>
                    <span className="text-green-300">✓</span>
                    Downloaded
                  </>
                ) : (
                  <>
                    {downloading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Downloading...
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                      <Download size={16} />
                      <p>Download</p>
                      </div>
                    )}
                  </>
                )}
              </button>
            </div>
          </div>




          <h1 className="mt-3 font-display text-xl font-bold leading-tight text-white" style={{ marginTop: "0.75rem" }}>
            {topicName}
          </h1>

          <p className="mt-1 flex items-center gap-1.5 text-sm text-violet-100/85">
            <Sparkles className="h-3.5 w-3.5" />
            Learning content
          </p>
        </div>

        {/* Tab row */}
        <div className="flex flex-wrap gap-2 p-3">
          {loading &&
            Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-7 w-24 animate-pulse rounded-full bg-slate-100"
              />
            ))}

          {!loading && errorMsg && (
            <div className="flex w-full flex-col items-center px-5 py-6 text-center" style={{ padding: "1rem"}}>
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50">
                <RefreshCw className="h-5 w-5 text-rose-500" />
              </div>
              <p className="mb-1 text-sm font-semibold text-slate-900">
                {errorMsg}
              </p>
              <button
                onClick={fetchContent}
                className="mt-3 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-2 text-xs font-semibold text-white shadow-sm cursor-pointer"
                style={{ padding: "0.5rem 1rem", marginTop: "1rem"}}
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !errorMsg && contents.length === 0 && (
            <div className="flex w-full flex-col items-center px-5 py-6 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-violet-50">
                <Sparkles className="h-5 w-5 text-violet-500" />
              </div>
              <p className="text-sm font-semibold text-slate-900">
                No content here yet
              </p>
            </div>
          )}

          {!loading &&
            !errorMsg &&
            contents.map((item, i) => {
              const active =
                selectedContent?.lms_subject_topic_data_id ===
                item.lms_subject_topic_data_id;
              const Icon = getContentIcon(item);
              const accent = ACCENTS[i % ACCENTS.length];

              return (
                <div
                  key={item.lms_subject_topic_data_id}
                  onClick={() => setSelectedContent(item)}
                  style={{ animationDelay: `${i * 40}ms`, marginTop: "0.5rem", marginBottom: "0.5rem", marginLeft: "0.5rem", padding: "0.5rem 1rem" }}
                  className={`flex animate-[fadeInUp_0.35s_ease-out_backwards] cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${active
                    ? "bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-md"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                >
                  <div
                    className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${active ? "bg-white/20" : `bg-gradient-to-br ${accent}`
                      }`}
                  >
                    <Icon className="h-3 w-3 text-white" strokeWidth={2.25} />
                  </div>

                  <span className="max-w-[120px] truncate">
                    {item.lms_subject_topic_data_file_code_name ||
                      item.lms_subject_topic_data_kind ||
                      "Content"}
                  </span>
                </div>
              );
            })}
        </div>
      </div>

      {/* Player */}
      <div className="relative overflow-x-hidden h-screen py-10 bg-gradient-to-br from-[#EDE9FE] via-[#F5F3FF] to-[#FDF2F8]" style={{ padding: "2rem" }}>
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-violet-300/25 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-72 w-72 rounded-full bg-fuchsia-300/20 blur-3xl" />

        {loading ? (
          <div className="relative flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
              <p className="text-sm font-medium text-slate-500">
                Loading content...
              </p>
            </div>
          </div>
        ) : selectedContent ? (
          <div
            key={selectedContent.lms_subject_topic_data_id}
            className="relative h-full w-full animate-[fadeIn_0.3s_ease-out] p-4 sm:p-6"
          >
            <div className="h-full w-full overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
              {selectedContent.lms_subject_topic_data_type === "VIDEO" ? (
                <video
                  className="h-full w-full"
                  controls
                  autoPlay
                >
                  <source
                    src={videoSrc}
                    type="video/mp4"
                  />
                  Your browser does not support the video tag.
                </video>
              ) : (
                <iframe
                  title="content-player"
                  src={
                    selectedContent.html5_file_name_app ||
                    selectedContent.html5_file_name
                  }
                  className="h-full w-full border-0"
                  allowFullScreen
                />
              )}
            </div>
          </div>
        ) : (
          <div className="relative flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-md">
              <Sparkles className="h-7 w-7 text-violet-400" />
            </div>
            <h2 className="font-display text-xl font-bold text-slate-700">
              No Content Available
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Nothing to show for this topic yet.
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>

  );
}