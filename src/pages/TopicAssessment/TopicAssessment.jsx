import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    ArrowRight,
    CheckCircle,
    Download,
    HelpCircle,
    RotateCcw,
    Sparkles,
    Trophy,
    XCircle,
} from "lucide-react";
import { questionBankAPI } from "../../services/api";

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const OPTION_KEYS = [
    "option_1",
    "option_2",
    "option_3",
    "option_4",
    "option_5",
    "option_6",
];

const CORRECT_OPTION_KEYS = [
    "option_1_is_correct",
    "option_2_is_correct",
    "option_3_is_correct",
    "option_4_is_correct",
    "option_5_is_correct",
    "option_6_is_correct",
];

const isCorrectValue = (value) => {
    if (value === true) return true;

    if (value === false || value === null || value === undefined) {
        return false;
    }

    const normalized = String(value).trim().toLowerCase();

    return (
        normalized === "yes" ||
        normalized === "true" ||
        normalized === "1"
    );
};

const stripHtml = (value) => {
    if (value === null || value === undefined) {
        return "";
    }

    const text = String(value);

    const temp = document.createElement("div");
    temp.innerHTML = text;

    return temp.textContent || temp.innerText || "";
};

const decodeUnicodeEscapes = (value) => {
    if (typeof value !== "string") {
        return value;
    }

    return value
        .replace(/u([0-9a-fA-F]{4})/g, (_, hex) =>
            String.fromCharCode(parseInt(hex, 16))
        )
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
            String.fromCharCode(parseInt(hex, 16))
        );
};

const parseMatchingOption = (value) => {
    if (value === null || value === undefined) {
        return "";
    }

    if (typeof value !== "string") {
        return value;
    }

    const trimmed = value.trim();

    if (!trimmed) {
        return "";
    }

    try {
        const parsed = JSON.parse(trimmed);

        if (typeof parsed === "string") {
            return decodeUnicodeEscapes(parsed);
        }

        return parsed;
    } catch {
        return decodeUnicodeEscapes(trimmed);
    }
};

const formatOption = (option) => {
    if (option === null || option === undefined) {
        return "";
    }

    if (typeof option === "string") {
        return stripHtml(decodeUnicodeEscapes(option));
    }

    if (typeof option === "object") {
        return Object.entries(option)
            .map(([key, value]) => {
                return `${stripHtml(
                    decodeUnicodeEscapes(key)
                )} → ${stripHtml(
                    decodeUnicodeEscapes(String(value))
                )}`;
            })
            .join(" | ");
    }

    return String(option);
};

const normalizeQuestion = (item, index) => {
    const questionType = String(
        item?.question_type || "single_correct"
    )
        .trim()
        .toLowerCase();

    const rawOptions = OPTION_KEYS
        .map((key) => item?.[key])
        .filter(
            (option) =>
                option !== null &&
                option !== undefined &&
                String(option).trim() !== ""
        );

    const correctIndexes = CORRECT_OPTION_KEYS
        .map((key, optionIndex) => ({
            optionIndex,
            correct: isCorrectValue(item?.[key]),
        }))
        .filter((item) => item.correct)
        .map((item) => item.optionIndex);

    const options = rawOptions.map((option) => {
        if (questionType === "matching") {
            return parseMatchingOption(option);
        }

        return option;
    });

    return {
        id: item?.id ?? index + 1,
        question: item?.question_text || "",
        questionType,
        options,
        correctIndexes,
        answer:
            correctIndexes.length > 0
                ? correctIndexes[0]
                : -1,
        raw: item,
    };
};

// --------------------------------------------------
// COMPONENT
// --------------------------------------------------

export default function TopicAssessment() {
    const navigate = useNavigate();
    const { state } = useLocation();

    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [downloading, setDownloading] = useState(false);
    const [isDownloaded, setIsDownloaded] = useState(false);

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
        offline
    } = state || {};

    const [currentQuestion, setCurrentQuestion] = useState(0);

    // Stores selected option for every question.
    // Example:
    // {
    //   0: 2,
    //   1: 0,
    //   2: 1
    // }
    const [selectedAnswers, setSelectedAnswers] = useState({});

    const [submitted, setSubmitted] = useState(false);

    const question = questions[currentQuestion];

    // --------------------------------------------------
    // LOAD QUESTIONS
    // --------------------------------------------------

    // useEffect(() => {
    //     const loadQuestions = async () => {
    //         if (!topicId) {
    //             setError("Topic ID is missing.");
    //             setLoading(false);
    //             return;
    //         }

    //         try {
    //             setLoading(true);
    //             setError("");

    //             // First check whether this assessment is available offline.
    //             const downloaded =
    //                 await window.electronAPI.isAssessmentDownloaded(
    //                     topicId
    //                 );

    //             setIsDownloaded(downloaded);

    //             if (downloaded) {
    //                 const localResult =
    //                     await window.electronAPI.getDownloadedAssessment(
    //                         topicId
    //                     );

    //                 if (
    //                     localResult?.success &&
    //                     Array.isArray(localResult.assessment) &&
    //                     localResult.assessment.length > 0
    //                 ) {
    //                     const normalizedQuestions =
    //                         localResult.assessment.map(
    //                             (item, index) =>
    //                                 normalizeQuestion(item.raw || item, index)
    //                         );

    //                     setQuestions(normalizedQuestions);
    //                     return;
    //                 }

    //                 // If the local file is unavailable/corrupt, fall back
    //                 // to the online question bank.
    //                 setIsDownloaded(false);
    //             }

    //             // No usable local assessment: fetch it from the API.
    //             const response = await questionBankAPI.getByTopic(
    //                 topicId,
    //                 1,
    //                 10
    //             );

    //             const apiQuestions = response.data?.data || [];

    //             const normalizedQuestions = apiQuestions.map(
    //                 (item, index) => normalizeQuestion(item, index)
    //             );

    //             setQuestions(normalizedQuestions);
    //         } catch (error) {
    //             console.error(
    //                 "Failed to load assessment questions:",
    //                 error
    //             );

    //             setError(
    //                 error.response?.data?.message ||
    //                 "Failed to load assessment questions."
    //             );
    //         } finally {
    //             setLoading(false);
    //         }
    //     };

    //     loadQuestions();
    // }, [topicId]);


    useEffect(() => {
        const loadQuestions = async () => {
            if (!topicId) {
                setError("Topic ID is missing.");
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError("");

                // ==================================================
                // OFFLINE MODE
                // ==================================================

                if (offline) {
                    console.log(
                        "📴 OFFLINE MODE: Loading assessment from local storage..."
                    );

                    const localResult =
                        await window.electronAPI.getDownloadedAssessment(
                            String(topicId)
                        );

                    if (
                        !localResult?.success ||
                        !Array.isArray(localResult.assessment) ||
                        localResult.assessment.length === 0
                    ) {
                        throw new Error(
                            localResult?.error ||
                            "Downloaded assessment is not available."
                        );
                    }

                    const normalizedQuestions =
                        localResult.assessment.map(
                            (item, index) =>
                                normalizeQuestion(
                                    item.raw || item,
                                    index
                                )
                        );

                    setQuestions(normalizedQuestions);
                    setIsDownloaded(true);

                    console.log(
                        `✅ Offline assessment loaded: ${normalizedQuestions.length} questions`
                    );

                    return;
                }

                // ==================================================
                // ONLINE MODE
                // ==================================================

                const downloaded =
                    await window.electronAPI.isAssessmentDownloaded(
                        topicId
                    );

                setIsDownloaded(downloaded);

                // --------------------------------------------------
                // If assessment is already downloaded, use local
                // --------------------------------------------------

                if (downloaded) {
                    const localResult =
                        await window.electronAPI.getDownloadedAssessment(
                            String(topicId)
                        );

                    if (
                        localResult?.success &&
                        Array.isArray(localResult.assessment) &&
                        localResult.assessment.length > 0
                    ) {
                        const normalizedQuestions =
                            localResult.assessment.map(
                                (item, index) =>
                                    normalizeQuestion(
                                        item.raw || item,
                                        index
                                    )
                            );

                        setQuestions(
                            normalizedQuestions
                        );

                        return;
                    }

                    // If local copy is unavailable/corrupt,
                    // continue to online API.
                    setIsDownloaded(false);
                }

                // --------------------------------------------------
                // Fetch from online question bank
                // --------------------------------------------------

                const response =
                    await questionBankAPI.getByTopic(
                        topicId,
                        1,
                        10
                    );

                const apiQuestions =
                    response.data?.data || [];

                const normalizedQuestions =
                    apiQuestions.map(
                        (item, index) =>
                            normalizeQuestion(
                                item,
                                index
                            )
                    );

                setQuestions(
                    normalizedQuestions
                );
            } catch (error) {
                console.error(
                    "Failed to load assessment questions:",
                    error
                );

                setError(
                    error?.message ||
                    error?.response?.data?.message ||
                    "Failed to load assessment questions."
                );
            } finally {
                setLoading(false);
            }
        };

        loadQuestions();
    }, [topicId, offline]);

    // --------------------------------------------------
    // DOWNLOAD ASSESSMENT
    // --------------------------------------------------


    const handleDownload = async () => {
        if (
            downloading ||
            isDownloaded ||
            questions.length === 0
        ) {
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
                "📁 Assessment download location:",
                folderResult.libraryRoot
            );

            // ==========================================
            // STEP 2: START DOWNLOAD
            // ==========================================

            setDownloading(true);


            // Save the original API question objects
            // so they can be normalized again offline.
            const assessment = questions.map(
                (question) =>
                    question.raw || question
            );

            // ==========================================
            // STEP 3: SAVE ASSESSMENT
            // ==========================================

            const result =
                await window.electronAPI.downloadAssessment(
                    assessment,
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
                    "Assessment download failed."
                );
            }

            setIsDownloaded(true);

            alert(
                "Assessment downloaded successfully. Available offline."
            );
        } catch (error) {
            console.error(
                "❌ Failed to download assessment:",
                error
            );

            alert(
                error?.message ||
                "Assessment download failed."
            );
        } finally {
            setDownloading(false);
        }
    };

    // --------------------------------------------------
    // SELECT OPTION
    // --------------------------------------------------

    const handleSelectOption = (optionIndex) => {
        if (submitted) return;

        setSelectedAnswers((previous) => ({
            ...previous,
            [currentQuestion]: optionIndex,
        }));
    };

    // --------------------------------------------------
    // PREVIOUS
    // --------------------------------------------------

    const handlePrevious = () => {
        if (currentQuestion > 0) {
            setCurrentQuestion((previous) => previous - 1);
        }
    };

    // --------------------------------------------------
    // NEXT
    // --------------------------------------------------

    const handleNext = () => {
        // Require an answer before moving forward
        if (selectedAnswers[currentQuestion] === undefined) {
            alert("Please select an option before continuing.");
            return;
        }

        if (currentQuestion < questions.length - 1) {
            setCurrentQuestion((previous) => previous + 1);
        }
    };

    // --------------------------------------------------
    // GO DIRECTLY TO QUESTION
    // --------------------------------------------------

    const handleQuestionNavigation = (index) => {
        setCurrentQuestion(index);
    };

    // --------------------------------------------------
    // SUBMIT
    // --------------------------------------------------

    const handleSubmit = () => {
        // Check whether every question has been answered
        const unansweredQuestions = questions.filter(
            (_, index) => selectedAnswers[index] === undefined
        );

        if (unansweredQuestions.length > 0) {
            alert(
                `Please answer all questions before submitting. ${unansweredQuestions.length} question(s) remaining.`
            );
            return;
        }

        setSubmitted(true);
    };

    // --------------------------------------------------
    // CHECK QUESTION ANSWER
    // --------------------------------------------------

    const isQuestionCorrect = (questionItem, selectedAnswer) => {
        if (
            selectedAnswer === undefined ||
            selectedAnswer === null ||
            !questionItem
        ) {
            return false;
        }

        if (
            !questionItem.correctIndexes ||
            questionItem.correctIndexes.length === 0
        ) {
            return false;
        }

        return questionItem.correctIndexes.includes(selectedAnswer);
    };

    // --------------------------------------------------
    // CALCULATE SCORE
    // --------------------------------------------------

    const calculateScore = () => {
        return questions.reduce((score, questionItem, index) => {
            return (
                score +
                (isQuestionCorrect(
                    questionItem,
                    selectedAnswers[index]
                )
                    ? 1
                    : 0)
            );
        }, 0);
    };

    const score = calculateScore();

    const percentage =
        questions.length > 0
            ? Math.round((score / questions.length) * 100)
            : 0;

    const isExcellent = percentage >= 80;
    const isGood = percentage >= 50 && percentage < 80;
    const needsPractice = percentage < 50;

    // --------------------------------------------------
    // RETRY
    // --------------------------------------------------

    const handleRetry = () => {
        setSelectedAnswers({});
        setCurrentQuestion(0);
        setSubmitted(false);
    };

    // --------------------------------------------------
    // RESULT SCREEN
    // --------------------------------------------------

    if (submitted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#EDE9FE] via-[#F5F3FF] to-[#FDF2F8]">

                {/* Header */}
                <div
                    className="bg-gradient-to-br from-violet-600 to-fuchsia-500 p-4"
                    style={{ padding: "0.5rem 1rem" }}
                >
                    <div className="flex items-center justify-between">

                        <button
                            onClick={() => navigate(-1)}
                            className="flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
                            style={{
                                paddingLeft: "1rem",
                                paddingRight: "1rem",
                                paddingTop: "0.5rem",
                                paddingBottom: "0.5rem",
                            }}
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </button>

                        <div className="flex items-center gap-2 text-white">
                            <Trophy className="h-5 w-5" />
                            <span className="font-semibold">
                                Assessment Result
                            </span>
                        </div>

                    </div>

                    <div className="mt-4">
                        <p className="text-sm text-violet-100">
                            {subjectName} → {chapterName}
                        </p>

                        <h1 className="mt-1 text-xl font-bold text-white">
                            {topicName || "Topic Assessment"}
                        </h1>
                    </div>
                </div>

                {/* Result */}
                <div
                    className={`relative mx-auto w-full overflow-hidden rounded-[2rem] text-center shadow-xl ring-1 ${isExcellent
                            ? "bg-white shadow-violet-200/50 ring-violet-100"
                            : isGood
                                ? "bg-white shadow-blue-200/40 ring-blue-100"
                                : "bg-white shadow-slate-200/50 ring-slate-200"
                        }`}
                    style={{
                        padding: "2rem 1rem",
                    }}
                >

                    {/* =====================================================
                        PERFORMANCE BACKGROUND
                    ====================================================== */}

                    {isExcellent ? (
                        <>
                            <div className="pointer-events-none absolute -left-20 -top-20 h-52 w-52 rounded-full bg-gradient-to-br from-violet-300/70 to-indigo-200/30 blur-[2px]" />
                            <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gradient-to-bl from-fuchsia-200/70 to-pink-100/20" />
                            <div className="pointer-events-none absolute -bottom-28 -left-20 h-64 w-64 rounded-full bg-gradient-to-tr from-violet-300/60 to-purple-100/20" />
                            <div className="pointer-events-none absolute -bottom-24 -right-20 h-60 w-60 rounded-full bg-gradient-to-tl from-fuchsia-300/50 to-pink-100/10" />
                            <div className="pointer-events-none absolute left-1/2 top-20 h-44 w-44 -translate-x-1/2 rounded-full bg-violet-200/30 blur-3xl" />

                            <Sparkles
                                className="pointer-events-none absolute left-10 top-44 h-6 w-6 rotate-12 text-amber-400"
                                fill="currentColor"
                            />
                            <Sparkles
                                className="pointer-events-none absolute right-10 top-[60%] h-5 w-5 -rotate-12 text-amber-400"
                                fill="currentColor"
                            />
                            <Sparkles
                                className="pointer-events-none absolute left-[30%] top-20 h-4 w-4 rotate-45 text-violet-500"
                            />
                            <Sparkles
                                className="pointer-events-none absolute right-[28%] top-24 h-4 w-4 -rotate-45 text-fuchsia-400"
                            />

                            <span className="pointer-events-none absolute left-[40%] top-16 h-2.5 w-7 rotate-45 rounded-full bg-violet-500" />
                            <span className="pointer-events-none absolute right-[35%] top-20 h-2.5 w-7 -rotate-45 rounded-full bg-fuchsia-500" />
                            <span className="pointer-events-none absolute left-[35%] top-28 h-2.5 w-6 rotate-[25deg] rounded-full bg-amber-400" />
                        </>
                    ) : needsPractice ? (
                        <>
                            <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-blue-100/70" />
                            <div className="pointer-events-none absolute -right-24 -top-20 h-64 w-64 rounded-full bg-indigo-100/60" />
                            <div className="pointer-events-none absolute -bottom-28 -left-20 h-64 w-64 rounded-full bg-slate-100" />
                            <div className="pointer-events-none absolute -bottom-24 -right-20 h-60 w-60 rounded-full bg-blue-50" />

                            <span className="pointer-events-none absolute left-12 top-28 h-4 w-4 rounded-full border-4 border-blue-200" />
                            <span className="pointer-events-none absolute right-16 top-[45%] h-5 w-5 rounded-full border-4 border-indigo-200" />
                            <span className="pointer-events-none absolute left-[15%] bottom-16 h-3 w-3 rounded-full bg-blue-200" />
                        </>
                    ) : (
                        <>
                            <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-sky-100/70" />
                            <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-violet-100/60" />
                            <div className="pointer-events-none absolute -bottom-24 -right-20 h-60 w-60 rounded-full bg-indigo-50" />
                        </>
                    )}

                    {/* =====================================================
                        MAIN CONTENT
                    ====================================================== */}

                    <div className="relative z-10">

                        {isExcellent ? (
                            <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
                                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-100 via-fuchsia-100 to-amber-100 blur-sm" />

                                <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 via-white to-fuchsia-100 shadow-inner ring-1 ring-violet-100">
                                    <Trophy
                                        className="h-14 w-14 text-amber-400 drop-shadow-[0_5px_8px_rgba(245,158,11,0.35)]"
                                        fill="currentColor"
                                        strokeWidth={1.5}
                                    />
                                </div>

                                <Sparkles
                                    className="absolute -right-1 top-1 h-5 w-5 text-violet-500"
                                    fill="currentColor"
                                />
                            </div>
                        ) : needsPractice ? (
                            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-blue-50 ring-8 ring-blue-50/60">
                                <HelpCircle
                                    className="h-12 w-12 text-blue-500"
                                    strokeWidth={1.8}
                                />
                            </div>
                        ) : (
                            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-indigo-50 ring-8 ring-indigo-50/60">
                                <CheckCircle
                                    className="h-12 w-12 text-indigo-500"
                                    strokeWidth={1.8}
                                />
                            </div>
                        )}

                        <h2
                            className={`mt-5 text-3xl font-extrabold tracking-tight ${isExcellent
                                    ? "text-indigo-950"
                                    : isGood
                                        ? "text-indigo-900"
                                        : "text-slate-800"
                                }`}
                        >
                            {isExcellent
                                ? "Excellent Work!"
                                : isGood
                                    ? "Good Job!"
                                    : "Keep Practicing!"}
                        </h2>

                        <p className="mt-2 text-base text-slate-500">
                            {isExcellent
                                ? "You have done really well on this assessment."
                                : isGood
                                    ? "You have a good understanding of this topic."
                                    : "Don't worry. Review the topic and try the assessment again."}
                        </p>

                        <div
                            className="mx-auto mt-7 flex w-full max-w-xl items-center justify-center gap-8"
                            style={{ margin: "1.2rem auto" }}
                        >

                            <div className="flex items-center gap-3">
                                <div
                                    className={`flex h-14 w-14 items-center justify-center rounded-full ${isExcellent
                                            ? "bg-emerald-50 ring-8 ring-emerald-50/50"
                                            : needsPractice
                                                ? "bg-blue-50 ring-8 ring-blue-50/50"
                                                : "bg-indigo-50 ring-8 ring-indigo-50/50"
                                        }`}
                                >
                                    <CheckCircle
                                        className={`h-7 w-7 ${isExcellent
                                                ? "text-emerald-500"
                                                : needsPractice
                                                    ? "text-blue-500"
                                                    : "text-indigo-500"
                                            }`}
                                    />
                                </div>

                                <div className="text-left">
                                    <p className="text-4xl font-extrabold leading-none text-violet-600">
                                        {score}/{questions.length}
                                    </p>

                                    <p className="mt-2 text-sm font-medium text-slate-500">
                                        Correct Answers
                                    </p>
                                </div>
                            </div>

                            <div className="h-14 w-px bg-slate-200" />

                            <div className="flex items-center gap-3">
                                <div
                                    className={`flex h-14 w-14 items-center justify-center rounded-full ${isExcellent
                                            ? "bg-fuchsia-50 ring-8 ring-fuchsia-50/50"
                                            : needsPractice
                                                ? "bg-blue-50 ring-8 ring-blue-50/50"
                                                : "bg-indigo-50 ring-8 ring-indigo-50/50"
                                        }`}
                                >
                                    <span
                                        className={`text-xl font-extrabold ${isExcellent
                                                ? "text-fuchsia-500"
                                                : needsPractice
                                                    ? "text-blue-500"
                                                    : "text-indigo-500"
                                            }`}
                                    >
                                        %
                                    </span>
                                </div>

                                <div className="text-left">
                                    <p
                                        className={`text-4xl font-extrabold leading-none ${isExcellent
                                                ? "text-fuchsia-500"
                                                : needsPractice
                                                    ? "text-blue-500"
                                                    : "text-indigo-500"
                                            }`}
                                    >
                                        {percentage}%
                                    </p>

                                    <p className="mt-2 text-sm font-medium text-slate-500">
                                        Score
                                    </p>
                                </div>
                            </div>

                        </div>

                        <div className="mt-7 flex flex-wrap justify-center gap-3">

                            <button
                                onClick={handleRetry}
                                className="flex cursor-pointer items-center gap-2 rounded-full border-2 border-violet-100 bg-white px-7 py-3 text-sm font-semibold text-indigo-900 shadow-sm transition-all duration-200 hover:border-violet-200 hover:bg-violet-50 hover:shadow-md"
                                style={{
                                    paddingLeft: "1.5rem",
                                    paddingRight: "1.5rem",
                                    paddingTop: "0.6rem",
                                    paddingBottom: "0.6rem",
                                }}
                            >
                                <RotateCcw className="h-5 w-5" />
                                Retry
                            </button>

                            <button
                                onClick={() => navigate(-1)}
                                className="flex cursor-pointer items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-500 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-300/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-300/50"
                                style={{
                                    paddingLeft: "1.5rem",
                                    paddingRight: "1.5rem",
                                    paddingTop: "0.6rem",
                                    paddingBottom: "0.6rem",
                                }}
                            >
                                <ArrowLeft className="h-5 w-5" />
                                Back to Content
                            </button>

                        </div>

                    </div>

                    {/* =====================================================
                        ANSWER REVIEW
                    ====================================================== */}

                    <div
                        className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
                        style={{
                            paddingLeft: "1rem",
                            paddingRight: "1rem",
                            paddingTop: "0.8rem",
                            paddingBottom: "0.8rem",
                            marginTop: "2rem",
                        }}
                    >

                        {/* Review heading */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h3
                                    className="text-lg font-bold text-slate-800"
                                    style={{ marginLeft: "-9.4rem" }}
                                >
                                    Answer Review
                                </h3>

                                <p className="mt-1 text-xs text-slate-500">
                                    Review your answers and see the correct responses.
                                </p>
                            </div>

                            <div
                                className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-600"
                                style={{ padding: "0.5rem 1rem" }}
                            >
                                {score}/{questions.length} Correct
                            </div>
                        </div>

                        {/* Questions */}
                        <div
                            className="mt-4 space-y-3"
                            style={{ marginTop: "0.7rem" }}
                        >

                            {questions.map((item, index) => {

                                const userAnswer =
                                    selectedAnswers[index];

                                const correct =
                                    isQuestionCorrect(
                                        item,
                                        userAnswer
                                    );

                                const correctAnswer =
                                    item.correctIndexes?.[0];

                                return (
                                    <div
                                        key={item.id}
                                        className={`rounded-xl border p-4 transition-all ${correct
                                                ? "border-emerald-200 bg-emerald-50"
                                                : "border-rose-200 bg-rose-50"
                                            }`}
                                        style={{
                                            marginTop: "0.7rem",
                                            padding: "0.7rem",
                                        }}
                                    >

                                        <div className="flex items-start gap-3">

                                            {/* Correct / Wrong icon */}
                                            <div className="mt-0.5 flex-shrink-0">

                                                {correct ? (
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                                                        <CheckCircle
                                                            className="h-5 w-5 text-emerald-500"
                                                            fill="currentColor"
                                                            stroke="white"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-100">
                                                        <XCircle className="h-5 w-5 text-rose-500" />
                                                    </div>
                                                )}

                                            </div>

                                            {/* Question content */}
                                            <div className="min-w-0 flex-1">

                                                {/* Question */}
                                                <p className="font-semibold leading-relaxed text-slate-800">
                                                    <span className="mr-1 text-slate-500">
                                                        Q{index + 1}.
                                                    </span>

                                                    {stripHtml(
                                                        item.question
                                                    )}
                                                </p>

                                                {/* Your answer */}
                                                <div className="mt-2">

                                                    <p className="text-sm text-slate-600">
                                                        Your answer:
                                                    </p>

                                                    <div
                                                        className={`mt-1 rounded-lg px-3 py-2 text-sm font-semibold ${correct
                                                                ? "bg-emerald-100 text-emerald-700"
                                                                : "bg-rose-100 text-rose-700"
                                                            }`}
                                                    >
                                                        {userAnswer !==
                                                            undefined ? (
                                                            <>
                                                                {String.fromCharCode(
                                                                    65 +
                                                                    userAnswer
                                                                )}
                                                                .{" "}
                                                                {formatOption(
                                                                    item
                                                                        .options[
                                                                    userAnswer
                                                                    ]
                                                                )}
                                                            </>
                                                        ) : (
                                                            "Not answered"
                                                        )}
                                                    </div>

                                                </div>

                                                {/* Correct answer */}
                                                {!correct && (
                                                    <div className="mt-2">

                                                        <p className="text-sm text-slate-600">
                                                            Correct answer:
                                                        </p>

                                                        <div className="mt-1 rounded-lg bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-700">
                                                            {correctAnswer !==
                                                                undefined &&
                                                                correctAnswer !==
                                                                -1 ? (
                                                                <>
                                                                    {String.fromCharCode(
                                                                        65 +
                                                                        correctAnswer
                                                                    )}
                                                                    .{" "}
                                                                    {formatOption(
                                                                        item
                                                                            .options[
                                                                        correctAnswer
                                                                        ]
                                                                    )}
                                                                </>
                                                            ) : (
                                                                "Correct answer unavailable"
                                                            )}
                                                        </div>

                                                    </div>
                                                )}

                                            </div>

                                        </div>

                                    </div>
                                );
                            })}

                        </div>

                    </div>

                </div>
            </div>
        );
    }

    // --------------------------------------------------
    // LOADING
    // --------------------------------------------------

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#F7F7FB]">
                <div className="text-center">
                    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
                    <p className="mt-4 text-sm font-medium text-slate-600">
                        Loading assessment...
                    </p>
                </div>
            </div>
        );
    }

    // --------------------------------------------------
    // ERROR
    // --------------------------------------------------

    if (error) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#F7F7FB]">
                <div className="text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50">
                        <XCircle className="h-8 w-8 text-rose-500" />
                    </div>

                    <h2 className="mt-4 text-xl font-bold text-slate-800">
                        Unable to Load Assessment
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                        {error}
                    </p>

                    <button
                        onClick={() => navigate(-1)}
                        className="mt-5 flex mx-auto items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-90 cursor-pointer"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </button>
                </div>
            </div>
        );
    }

    // --------------------------------------------------
    // NO QUESTIONS
    // --------------------------------------------------

    if (questions.length === 0) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#F7F7FB]">
                <div className="text-center flex flex-col items-center justify-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-violet-50">
                        <HelpCircle className="h-8 w-8 text-violet-500" />
                    </div>

                    <h2 className="mt-4 text-xl font-bold text-slate-800">
                        No Questions Available
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                        There are no assessment questions available for this topic.
                    </p>

                    <button
                        onClick={() => navigate(-1)}
                        className="mt-5 flex mx-auto items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-90 cursor-pointer"
                        style={{ padding: "0.75rem 1rem", marginTop: "1.25rem" }}
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </button>
                </div>
            </div>
        );
    }

    // --------------------------------------------------
    // MAIN ASSESSMENT SCREEN
    // --------------------------------------------------

    return (
        <div className="flex min-h-screen flex-col bg-[#F7F7FB]">

            {/* Header */}
            <div
                className="flex-shrink-0 bg-gradient-to-br from-violet-600 to-fuchsia-500 p-4"
                style={{
                    paddingLeft: "1rem",
                    paddingRight: "1rem",
                    paddingTop: "0.5rem",
                    paddingBottom: "0.5rem",
                }}
            >

                <div className="flex items-center justify-between">

                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20 cursor-pointer"
                        style={{
                            paddingLeft: "1rem",
                            paddingRight: "1rem",
                            paddingTop: "0.5rem",
                            paddingBottom: "0.5rem",
                        }}
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </button>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 text-white">
                            <HelpCircle className="h-5 w-5" />
                            <span className="font-semibold">
                                Assessment
                            </span>
                        </div>

                        <button
                            onClick={handleDownload}
                            disabled={
                                downloading ||
                                isDownloaded ||
                                questions.length === 0
                            }
                            className={`flex items-center gap-2 rounded-xl border border-white/25 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition ${isDownloaded
                                    ? "cursor-default bg-white/20"
                                    : "cursor-pointer bg-white/10 hover:bg-white/20"
                                }`}
                            style={{
                                paddingLeft: "1rem",
                                paddingRight: "1rem",
                                paddingTop: "0.5rem",
                                paddingBottom: "0.5rem",
                            }}
                        >
                            {isDownloaded ? (
                                <>
                                    <CheckCircle className="h-4 w-4 text-green-300" />
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
                                            <Download className="h-4 w-4" />
                                            Download
                                        </div>
                                    )}
                                </>
                            )}
                        </button>
                    </div>

                </div>

                <div className="mt-4">

                    <p className="text-sm text-violet-100">
                        {subjectName} → {chapterName}
                    </p>

                    <h1 className="mt-1 text-xl font-bold text-white">
                        {topicName || "Topic Assessment"}
                    </h1>

                    <p className="mt-1 text-sm text-violet-100">
                        Multiple Choice Questions
                    </p>

                </div>

            </div>

            {/* Main */}
            <div className="flex-1 overflow-y-auto bg-gradient-to-br from-[#EDE9FE] via-[#F5F3FF] to-[#FDF2F8] p-4 sm:p-6">

                <div
                    className="mx-auto w-full"
                    style={{
                        paddingLeft: "1rem",
                        paddingRight: "1rem",
                        paddingTop: "0.5rem",
                        paddingBottom: "0.5rem",
                    }}
                >

                    {/* Progress */}
                    <div
                        className="mb-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
                        style={{
                            paddingLeft: "1rem",
                            paddingRight: "1rem",
                            paddingTop: "0.5rem",
                            paddingBottom: "0.5rem",
                        }}
                    >

                        <div className="flex items-center justify-between">

                            <div>
                                <p className="text-sm font-semibold text-slate-800">
                                    Question {currentQuestion + 1} of{" "}
                                    {questions.length}
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                    {
                                        Object.keys(
                                            selectedAnswers
                                        ).length
                                    }{" "}
                                    answered
                                </p>
                            </div>

                            <div className="text-sm font-bold text-violet-600">
                                {Math.round(
                                    ((currentQuestion + 1) /
                                        questions.length) *
                                    100
                                )}
                                %
                            </div>

                        </div>

                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">

                            <div
                                className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 transition-all duration-300"
                                style={{
                                    width: `${((currentQuestion + 1) /
                                            questions.length) *
                                        100
                                        }%`,
                                }}
                            />

                        </div>

                    </div>

                    <div
                        className="grid gap-5 lg:grid-cols-[1fr_220px]"
                        style={{ marginTop: "1rem" }}
                    >

                        {/* Question */}
                        <div
                            className="rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200"
                            style={{
                                paddingLeft: "1rem",
                                paddingRight: "1rem",
                                paddingTop: "0.5rem",
                                paddingBottom: "0.5rem",
                            }}
                        >

                            <div className="flex items-start gap-3">

                                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-violet-100 text-sm font-bold text-violet-600">
                                    {currentQuestion + 1}
                                </div>

                                <div>

                                    <p className="text-xs font-semibold uppercase tracking-wide text-violet-500">
                                        Question {currentQuestion + 1}
                                    </p>

                                    <h2 className="mt-1 text-lg font-bold leading-relaxed text-slate-800">
                                        {stripHtml(question.question)}
                                    </h2>

                                </div>

                            </div>

                            {/* Options */}
                            <div
                                className="mt-7 space-y-3"
                                style={{ marginTop: "0.7rem" }}
                            >

                                {question.options.map(
                                    (option, index) => {

                                        const selected =
                                            selectedAnswers[
                                            currentQuestion
                                            ] === index;

                                        return (
                                            <button
                                                key={index}
                                                onClick={() =>
                                                    handleSelectOption(
                                                        index
                                                    )
                                                }
                                                className={`group flex w-full cursor-pointer items-center gap-3 rounded-xl border p-4 text-left transition-all ${selected
                                                        ? "border-violet-500 bg-violet-50 shadow-sm"
                                                        : "border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/50"
                                                    }`}
                                                style={{
                                                    marginTop: "0.7rem",
                                                    padding: "0.5rem",
                                                }}
                                            >

                                                <div
                                                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border text-sm font-bold ${selected
                                                            ? "border-violet-500 bg-violet-600 text-white"
                                                            : "border-slate-300 bg-slate-50 text-slate-600 group-hover:border-violet-300"
                                                        }`}
                                                >
                                                    {String.fromCharCode(
                                                        65 + index
                                                    )}
                                                </div>

                                                <span
                                                    className={`text-sm font-medium ${selected
                                                            ? "text-violet-700"
                                                            : "text-slate-700"
                                                        }`}
                                                >
                                                    {formatOption(option)}
                                                </span>

                                                {selected && (
                                                    <CheckCircle className="ml-auto h-5 w-5 flex-shrink-0 text-violet-600" />
                                                )}

                                            </button>
                                        );
                                    }
                                )}

                            </div>

                            {/* Previous / Next */}
                            <div
                                className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5"
                                style={{ marginTop: "0.7rem" }}
                            >

                                <button
                                    onClick={handlePrevious}
                                    disabled={currentQuestion === 0}
                                    className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition ${currentQuestion === 0
                                            ? "cursor-not-allowed bg-slate-100 text-slate-400"
                                            : "cursor-pointer border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
                                        }`}
                                    style={{
                                        paddingLeft: "1rem",
                                        paddingRight: "1rem",
                                        paddingTop: "0.5rem",
                                        paddingBottom: "0.5rem",
                                    }}
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    Previous
                                </button>

                                {currentQuestion ===
                                    questions.length - 1 ? (
                                    <button
                                        onClick={handleSubmit}
                                        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-90 cursor-pointer"
                                        style={{
                                            paddingLeft: "1rem",
                                            paddingRight: "1rem",
                                            paddingTop: "0.5rem",
                                            paddingBottom: "0.5rem",
                                        }}
                                    >
                                        <CheckCircle className="h-4 w-4" />
                                        Submit Assessment
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleNext}
                                        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-90 cursor-pointer"
                                        style={{
                                            paddingLeft: "1rem",
                                            paddingRight: "1rem",
                                            paddingTop: "0.5rem",
                                            paddingBottom: "0.5rem",
                                        }}
                                    >
                                        Next
                                        <ArrowRight className="h-4 w-4" />
                                    </button>
                                )}

                            </div>

                        </div>

                        {/* Question Navigation */}
                        <div
                            className="h-fit rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
                            style={{
                                paddingLeft: "1rem",
                                paddingRight: "1rem",
                                paddingTop: "0.5rem",
                                paddingBottom: "0.5rem",
                            }}
                        >

                            <h3 className="text-sm font-bold text-slate-800">
                                Questions
                            </h3>

                            <p className="mt-1 text-xs text-slate-500">
                                Click a question to navigate
                            </p>

                            <div
                                className="mt-4 grid grid-cols-4 gap-2 lg:grid-cols-3"
                                style={{ marginTop: "0.7rem" }}
                            >

                                {questions.map((_, index) => {

                                    const answered =
                                        selectedAnswers[index] !==
                                        undefined;

                                    const active =
                                        currentQuestion === index;

                                    return (
                                        <button
                                            key={index}
                                            onClick={() =>
                                                handleQuestionNavigation(
                                                    index
                                                )
                                            }
                                            className={`relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-xs font-bold transition ${active
                                                    ? "bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-md"
                                                    : answered
                                                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                }`}
                                        >
                                            {index + 1}

                                            {answered &&
                                                !active && (
                                                    <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                                                )}
                                        </button>
                                    );
                                })}

                            </div>

                            {/* Legend */}
                            <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">

                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <span className="h-3 w-3 rounded bg-gradient-to-r from-violet-600 to-fuchsia-500" />
                                    Current
                                </div>

                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <span className="h-3 w-3 rounded bg-emerald-100" />
                                    Answered
                                </div>

                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <span className="h-3 w-3 rounded bg-slate-100" />
                                    Not answered
                                </div>

                            </div>

                        </div>

                    </div>

                </div>

            </div>

        </div>
    );
}