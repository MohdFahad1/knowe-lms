import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  FileQuestion,
  FolderOpen,
  Sparkles,
  Trash2,
} from "lucide-react";
import Header from "../../components/Header";
import { useNavigate } from "react-router-dom";

// Renders the board > class > subject > chapter breadcrumb above a topic name.
function Breadcrumb({ item, className = "" }) {
  const parts = [
    item.boardName,
    item.className,
    item.subjectName,
    item.chapterName,
  ].filter(Boolean);

  if (parts.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-1 text-xs text-slate-400 ${className}`}
    >
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && (
            <ChevronRight className="h-3 w-3 text-slate-300" />
          )}

          <span className="max-w-[110px] truncate">
            {part}
          </span>
        </span>
      ))}
    </div>
  );
}

export default function OfflineAssessment() {
  const navigate = useNavigate();

  const [assessments, setAssessments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  const [libraryRoot, setLibraryRoot] = useState(null);

  useEffect(() => {
    initializeOfflineAssessments();
  }, []);

  const initializeOfflineAssessments = async () => {
    try {
      const result =
        await window.electronAPI.getActiveLibrary();

      if (result?.success) {
        setLibraryRoot(result.libraryRoot || null);
      }

      await fetchDownloadedAssessments();
    } catch (error) {
      console.error(
        "Failed to initialize offline assessments:",
        error
      );
    }
  };

  const fetchDownloadedAssessments = async () => {
    try {
      const data =
        await window.electronAPI.listDownloads();

      setAssessments(data?.assessments || []);
    } catch (error) {
      console.error(
        "Failed to load downloaded assessments:",
        error
      );

      setAssessments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLibrary = async () => {
    try {
      const result =
        await window.electronAPI.selectLibraryFolder();

      if (!result?.success) {
        alert(
          result?.error ||
            "Unable to select library folder."
        );
        return;
      }

      if (result.canceled) {
        return;
      }

      setLibraryRoot(
        result.libraryRoot || null
      );

      setSelected(null);

      setLoading(true);

      await fetchDownloadedAssessments();
    } catch (error) {
      console.error(
        "Failed to select library:",
        error
      );

      alert(
        "Unable to select library folder."
      );
    }
  };

  const handleOpenAssessment = async (item) => {
    try {
      const result =
        await window.electronAPI.getDownloadedAssessment(
          String(item.topicId)
        );

      if (!result?.success) {
        alert(
          result?.error ||
            "Unable to open downloaded assessment."
        );
        return;
      }

      setSelected({
        ...item,
        assessment: result.assessment,
        meta: result.meta,
      });
    } catch (error) {
      console.error(
        "Offline assessment error:",
        error
      );

      alert(
        "Unable to open downloaded assessment."
      );
    }
  };

  const handleDelete = async (e, topicId) => {
    e.stopPropagation();

    try {
      const result =
        await window.electronAPI.deleteDownloadedAssessment(
          String(topicId)
        );

      if (!result?.success) {
        alert(
          result?.error ||
            "Unable to delete assessment."
        );
        return;
      }

      if (selected?.topicId === topicId) {
        setSelected(null);
      }

      fetchDownloadedAssessments();
    } catch (error) {
      console.error(
        "Failed to delete assessment:",
        error
      );

      alert(
        "Unable to delete downloaded assessment."
      );
    }
  };

  const handleStartAssessment = () => {
    if (!selected) return;

    navigate("/assessment", {
      state: {
        topicId: selected.topicId,
        topicName: selected.topicName,
        boardId: selected.boardId,
        boardName: selected.boardName,
        classId: selected.classId,
        className: selected.className,
        subjectId: selected.subjectId,
        subjectName: selected.subjectName,
        chapterId: selected.chapterId,
        chapterName: selected.chapterName,
        offline: true,
      },
    });
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        Loading Offline Assessments...
      </div>
    );
  }

  if (selected) {
    const questionCount = Array.isArray(
      selected.assessment
    )
      ? selected.assessment.length
      : 0;

    return (
      <div className="min-h-screen w-full bg-[#F7F7FB] px-6 py-10 sm:px-10 lg:px-16">
        <Header
          title={
            selected.topicName ||
            "Assessment"
          }
        />

        <button
          onClick={() => setSelected(null)}
          className="mb-6 mt-6 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 cursor-pointer"
          style={{
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            margin: "1rem",
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Assessments
        </button>

        <div
          className="mx-auto mt-8 max-w-3xl px-6"
          style={{ padding: "1rem" }}
        >
          <div
            className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-100"
            style={{
              padding: "2rem",
              borderRadius: "1rem",
              boxShadow:
                "0 1px 3px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500">
              <FileQuestion className="h-7 w-7 text-white" />
            </div>

            <h2
              className="font-display text-2xl font-bold text-slate-900"
              style={{ margin: "0.5rem 0" }}
            >
              {selected.topicName}
            </h2>

            <Breadcrumb
              item={selected}
              className="mt-2"
            />

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div
                className="rounded-xl bg-violet-50 p-4"
                style={{ padding: "0.5rem" }}
              >
                <p className="text-xs font-medium text-violet-500">
                  Questions
                </p>

                <p className="mt-1 text-2xl font-bold text-violet-700">
                  {questionCount}
                </p>
              </div>

              <div
                className="rounded-xl bg-emerald-50 p-4"
                style={{ padding: "0.5rem" }}
              >
                <p className="text-xs font-medium text-emerald-500">
                  Status
                </p>

                <p className="mt-1 text-lg font-bold text-emerald-700">
                  Available Offline
                </p>
              </div>
            </div>

            {selected.downloadedAt && (
              <p
                className="mt-5 text-xs text-slate-400"
                style={{ marginTop: "0.5rem" }}
              >
                Downloaded on{" "}
                {new Date(
                  selected.downloadedAt
                ).toLocaleDateString()}
              </p>
            )}

            <button
              onClick={handleStartAssessment}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 cursor-pointer"
              style={{
                padding: "0.75rem 1rem",
              }}
            >
              Start Assessment

              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#F7F7FB] px-6 py-10 sm:px-10 lg:px-16">
      <Header title="Offline Assessments" />

      {/* Portable Library Location */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0" style={{ padding: "1.5rem"}}>
            <p className="text-sm font-bold text-slate-900">
              Offline Library Location
            </p>

            <p
              className="mt-1 break-all text-xs text-slate-500"
              title={
                libraryRoot ||
                "No location selected"
              }
            >
              {libraryRoot ||
                "No location selected"}
            </p>
          </div>

          <button
            onClick={handleSelectLibrary}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 cursor-pointer"
            style={{ padding: "0.5rem 1rem", marginRight: "1rem"}}
          >
            <FolderOpen className="h-4 w-4" />

            {libraryRoot
              ? "Change Location"
              : "Select Location"}
          </button>
        </div>
      </div>

      {assessments.length === 0 ? (
        <div className="mt-10 flex h-[60vh] flex-col items-center justify-center px-6 py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-200">
            <FileQuestion className="h-6 w-6 text-violet-500" />
          </div>

          <p className="mb-1 font-display text-lg font-bold text-slate-900">
            No assessments downloaded yet
          </p>

          <p className="text-sm text-slate-500">
            Assessments you download will be available offline here.
          </p>
        </div>
      ) : (
        <div
          className="mt-10 grid grid-cols-1 gap-6 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          style={{ padding: "1.5rem" }}
        >
          {assessments.map((item) => (
            <div
              key={item.topicId}
              onClick={() =>
                handleOpenAssessment(item)
              }
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
                  handleDelete(
                    e,
                    item.topicId
                  )
                }
                className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
                aria-label="Delete assessment"
              >
                <Trash2 className="h-4 w-4" />
              </button>

              <div>
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500">
                  <FileQuestion className="h-5 w-5 text-white" />
                </div>

                <h2 className="font-display text-lg font-bold text-slate-900">
                  {item.topicName}
                </h2>

                <Breadcrumb
                  item={item}
                  className="mt-2"
                />
              </div>

              <div className="mt-5">
                <p className="flex items-center gap-1 text-xs text-slate-500">
                  <Sparkles className="h-3.5 w-3.5" />
                  Available offline
                </p>

                {item.downloadedAt && (
                  <p className="mt-2 text-[11px] text-slate-400">
                    {new Date(
                      item.downloadedAt
                    ).toLocaleDateString()}
                  </p>
                )}

                <div className="mt-4 flex items-center text-sm font-semibold text-violet-600">
                  Open Assessment

                  <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}