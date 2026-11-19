import { HashRouter, Routes, Route } from "react-router-dom";

import Login from "../pages/Login/Login";
import Boards from "../pages/Boards/Boards";
import Classes from "../pages/Classes/Classes";
import Subjects from "../pages/Subjects/Subjects";
import Chapters from "../pages/Chapters/Chapters";
import Topics from "../pages/Topics/Topics";
import Content from "../pages/Content/Content";
import Downloads from "../pages/Downloads/Downloads";
import TopicAssessment from "../pages/TopicAssessment/TopicAssessment";
import OfflineAssessment from "../pages/OfflineAssessment/OfflineAssessment";
import AppLayout from "../layouts/AppLayout";

export default function AppRoutes() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        <Route element={<AppLayout />}>
          <Route path="/boards" element={<Boards />} />
          <Route path="/classes" element={<Classes />} />
          <Route path="/subjects" element={<Subjects />} />
          <Route path="/chapters" element={<Chapters />} />
          <Route path="/topics" element={<Topics />} />
          <Route path="/content" element={<Content />} />
          <Route path="/assessment" element={<TopicAssessment />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="/offline-assessment" element={<OfflineAssessment />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}